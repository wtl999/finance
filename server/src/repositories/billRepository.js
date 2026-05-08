// Bill repository: CRUD and query helpers for monthly ledger data.
const { db } = require('../db');
const { buildId, normalizeBillInput } = require('../lib');
const { normalizeBillCategories } = require('../../miniprogram/utils/category');
const { formatDate, formatMonth } = require('../../miniprogram/utils/format');

const listBillsForUser = (userId, filters = {}) => {
  const clauses = ['userId = ?'];
  const params = [userId];

  if (filters.year) {
    const year = String(filters.year).slice(0, 4);
    clauses.push('date >= ? AND date <= ?');
    params.push(`${year}-01-01`, `${year}-12-31`);
  } else if (filters.month) {
    const month = String(filters.month).slice(0, 7);
    clauses.push('month = ?');
    params.push(month);
  }

  if (filters.date) {
    clauses.push('date = ?');
    params.push(String(filters.date).slice(0, 10));
  }

  if (filters.type && filters.type !== 'all') {
    clauses.push('type = ?');
    params.push(filters.type);
  }

  const where = clauses.join(' AND ');
  return db.prepare(`SELECT * FROM bills WHERE ${where} ORDER BY date DESC, createdAt DESC`).all(...params);
};

const saveBill = (userId, data = {}) => {
  const now = new Date().toISOString();
  const bill = normalizeBillInput(data);
  const existing = data._id ? db.prepare('SELECT * FROM bills WHERE id = ? AND userId = ?').get(data._id, userId) : null;
  const record = {
    id: existing?.id || buildId('bill'),
    userId,
    ...bill,
    aiParsedJson: bill.aiParsed ? JSON.stringify(bill.aiParsed) : existing?.aiParsedJson || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    db.prepare(`
      UPDATE bills SET
        type = @type,
        amount = @amount,
        category = @category,
        merchant = @merchant,
        remark = @remark,
        date = @date,
        month = @month,
        year = @year,
        source = @source,
        aiParsedJson = @aiParsedJson,
        updatedAt = @updatedAt
      WHERE id = @id AND userId = @userId
    `).run(record);
  } else {
    db.prepare(`
      INSERT INTO bills (
        id, userId, type, amount, category, merchant, remark, date, month, year, source, aiParsedJson, createdAt, updatedAt
      ) VALUES (
        @id, @userId, @type, @amount, @category, @merchant, @remark, @date, @month, @year, @source, @aiParsedJson, @createdAt, @updatedAt
      )
    `).run(record);
  }

  return record;
};

const deleteBill = (userId, billId) => {
  db.prepare('DELETE FROM bills WHERE id = ? AND userId = ?').run(billId, userId);
};

const serializeBill = (row) => ({
  ...row,
  _id: row.id,
  aiParsed: row.aiParsedJson ? JSON.parse(row.aiParsedJson) : null,
});

module.exports = {
  deleteBill,
  listBillsForUser,
  saveBill,
  serializeBill,
};

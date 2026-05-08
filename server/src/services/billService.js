// Bill service: CRUD and aggregation for ledger entries.
const { buildReportInsight, summarizeBills } = require('../lib');
const { listBillsForUser, saveBill, deleteBill, serializeBill } = require('../repositories/billRepository');
const { buildUserView } = require('../lib');

const listBills = (userId, filters = {}) => {
  const bills = listBillsForUser(userId, filters).map(serializeBill);
  return {
    list: bills,
    total: bills.length,
  };
};

const createBill = (userId, data = {}) => {
  const bill = saveBill(userId, data);
  return serializeBill(bill);
};

const updateBill = (userId, data = {}) => {
  const bill = saveBill(userId, data);
  return serializeBill(bill);
};

const removeBill = (userId, billId) => {
  deleteBill(userId, billId);
  return { success: true };
};

const getBillSummary = (userId, filters = {}) => {
  const bills = listBillsForUser(userId, filters).map(serializeBill);
  return summarizeBills(bills, '');
};

const getReportInsight = (user, filters = {}) => {
  const bills = listBillsForUser(user.id, filters).map(serializeBill);
  return buildReportInsight({
    bills,
    month: filters.month,
    year: filters.year,
    categories: user?.billCategoriesJson ? JSON.parse(user.billCategoriesJson) : null,
  });
};

module.exports = {
  createBill,
  getBillSummary,
  getReportInsight,
  listBills,
  removeBill,
  updateBill,
};

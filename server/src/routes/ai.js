// AI routes: classification and analysis stay isolated from billing CRUD.
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { analyzeBills, classifyBillText, parseBillText } = require('../services/aiService');
const { listBillsForUser, serializeBill } = require('../repositories/billRepository');
const { buildDateRange, buildId, nowIso } = require('../lib');
const { db } = require('../db');

const router = express.Router();

router.post('/aiClassify', requireAuth, (req, res) => {
  const text = String(req.body?.data?.text || '');
  res.json({ success: true, data: classifyBillText(text) });
});

router.post('/deepseekParse', requireAuth, (req, res) => {
  const text = String(req.body?.data?.text || '');
  const source = String(req.body?.data?.source || 'ocr');
  res.json({
    success: true,
    data: {
      bill: parseBillText(text, source),
      raw: text,
      provider: 'fallback',
      model: 'local-parser',
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    },
  });
});

router.post('/aiAnalyze', requireAuth, (req, res) => {
  const data = req.body?.data || {};
  const range = buildDateRange(data);
  const currentBills = listBillsForUser(req.user.id, range).map(serializeBill);
  const previousBills = listBillsForUser(req.user.id, {
    ...range,
    month: range.periodType === 'month' ? range.prevStartDate.slice(0, 7) : '',
    year: range.periodType === 'year' ? String(Number(range.year) - 1) : '',
  }).map(serializeBill);

  const result = analyzeBills({
    currentBills,
    previousBills,
    range,
  });

  db.prepare(`
    INSERT INTO ai_logs (id, userId, taskType, model, source, inputJson, outputJson, tokenUsageJson, status, errorMessage, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    buildId('ailog'),
    req.user.id,
    'spending_analysis',
    'local-parser',
    'bill_analysis',
    JSON.stringify(data),
    JSON.stringify(result.analysis),
    JSON.stringify({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    'success',
    '',
    nowIso(),
  );

  res.json({ success: true, data: result });
});

module.exports = router;

// Bill routes: create, list, update, delete, and summary live together.
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { createBill, getBillSummary, listBills, removeBill, updateBill } = require('../services/billService');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const action = req.body?.action || 'list';
  const data = req.body?.data || {};

  if (action === 'create') {
    const bill = createBill(req.user.id, data);
    return res.json({ success: true, data: { _id: bill._id, ...bill } });
  }

  if (action === 'list') {
    const pageSize = Number(data.pageSize || data.limit || 20);
    const page = Number(data.page || 1);
    const result = listBills(req.user.id, data);
    const total = result.total;
    const start = Math.max(page - 1, 0) * pageSize;
    const pageBills = Number(data.limit)
      ? result.list.slice(0, Number(data.limit))
      : result.list.slice(start, start + pageSize);

    return res.json({
      success: true,
      data: {
        list: pageBills,
        total,
        page,
        pageSize,
        hasMore: Number(data.limit) ? false : page * pageSize < total,
      },
    });
  }

  if (action === 'update') {
    if (!data._id) {
      return res.json({ success: false, message: 'missing _id' });
    }
    const bill = updateBill(req.user.id, data);
    return res.json({ success: true, data: { _id: bill._id, ...bill } });
  }

  if (action === 'delete') {
    if (!data._id) {
      return res.json({ success: false, message: 'missing _id' });
    }
    return res.json({ success: true, data: removeBill(req.user.id, data._id) });
  }

  if (action === 'summary') {
    return res.json({
      success: true,
      data: {
        periodType: data.year ? 'year' : 'month',
        year: data.year ? String(data.year).slice(0, 4) : '',
        month: data.month ? String(data.month).slice(0, 7) : '',
        ...getBillSummary(req.user.id, data),
      },
    });
  }

  return res.status(400).json({ success: false, message: 'unknown action' });
});

module.exports = router;

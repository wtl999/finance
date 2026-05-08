// Category routes: one account's bill categories stay independent.
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { getCategories, resetCategories, saveCategories } = require('../services/categoryService');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const action = req.body?.action || 'get';
  const data = req.body?.data || {};

  if (action === 'get') {
    return res.json({ success: true, data: getCategories(req.user) });
  }

  if (action === 'save') {
    return res.json({ success: true, data: saveCategories(req.user, data.categories || {}) });
  }

  if (action === 'reset') {
    return res.json({ success: true, data: resetCategories(req.user) });
  }

  return res.status(400).json({ success: false, message: 'unknown action' });
});

module.exports = router;

// Report routes: monthly and yearly insight generation belongs here.
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { getReportInsight } = require('../services/billService');

const router = express.Router();

router.post('/', requireAuth, (req, res) => {
  const data = req.body?.data || {};
  const insight = getReportInsight(req.user, data);

  return res.json({
    success: true,
    data: {
      ...insight,
      prompt: data.prompt || '',
    },
  });
});

module.exports = router;

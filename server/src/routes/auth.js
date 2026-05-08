// Auth routes: login and current-user sync are isolated in one module.
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { login, syncCurrentUser, updateProfile } = require('../services/authService');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const profile = req.body?.data || {};
    const phoneCode = String(req.body?.phoneCode || '').trim();
    const mode = String(req.body?.mode || 'wechat').trim();
    const wxLoginCode = String(req.body?.wxLoginCode || profile.wxLoginCode || '').trim();
    const result = await login({
      currentUser: null,
      profile,
      phoneCode,
      mode,
      wxLoginCode,
    });

    if (!result.user) {
      return res.status(400).json({
        success: false,
        message: result.message || 'login failed',
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'login failed',
      detail: error?.stack || error?.message || String(error),
    });
  }
});

router.post('/userSync', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: syncCurrentUser(req.user),
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: syncCurrentUser(req.user),
  });
});

router.post('/updateProfile', requireAuth, (req, res) => {
  try {
    const profile = req.body?.data || {};
    const phoneCode = String(req.body?.phoneCode || '').trim();
    const result = updateProfile({
      currentUser: req.user,
      profile,
      phoneCode,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'update profile failed',
      detail: error?.stack || error?.message || String(error),
    });
  }
});

module.exports = router;

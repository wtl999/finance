const cloud = require('wx-server-sdk');
const { ensureUserMembership } = require('../shared/membership');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const getContext = () => cloud.getWXContext();

const syncProfile = async (profile = {}) => {
  const { OPENID, APPID, UNIONID } = getContext();
  const now = new Date();
  const serverNow = db.serverDate();

  const result = await ensureUserMembership({
    db,
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
    profile,
    now,
    serverNow,
  });

  return {
    success: true,
    data: {
      user: result.user,
    },
  };
};

exports.main = async (event) => {
  const action = event.action || 'login';
  const profile = event.data || {};

  if (action === 'login' || action === 'updateProfile') {
    return syncProfile(profile);
  }

  if (action === 'sync') {
    return syncProfile({});
  }

  return {
    success: false,
    message: 'unknown action',
  };
};

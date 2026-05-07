const cloud = require('wx-server-sdk');
const {
  ensureUsersCollection,
  upsertUserProfile,
} = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const getContext = () => cloud.getWXContext();

const syncProfile = async (profile = {}, phoneCode = '') => {
  const { OPENID, APPID, UNIONID } = getContext();
  const now = new Date();
  const serverNow = db.serverDate();

  await ensureUsersCollection(db);

  const result = await upsertUserProfile({
    db,
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
    profile,
    phoneCode,
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
  const phoneCode = event.phoneCode || profile.phoneCode || '';

  if (action === 'login' || action === 'updateProfile') {
    return syncProfile(profile, phoneCode);
  }

  if (action === 'sync') {
    return syncProfile({});
  }

  return {
    success: false,
    message: 'unknown action',
  };
};

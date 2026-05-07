const cloud = require('wx-server-sdk');
const {
  ensureUsersCollection,
  syncUserMembership,
  upsertUserProfile,
} = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event) => {
  const action = event.action || 'sync';
  const profile = event.data || {};
  const phoneCode = event.phoneCode || profile.phoneCode || '';
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();
  const now = new Date();
  const serverNow = db.serverDate();

  await ensureUsersCollection(db);

  if (action === 'sync' || action === 'refresh') {
    const result = await syncUserMembership({ db, openid: OPENID, now, serverNow });
    if (result) {
      return {
        success: true,
        data: { user: result.user },
      };
    }
  }

  if (action === 'updateProfile') {
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
  }

  const result = await upsertUserProfile({
    db,
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
    profile: {},
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

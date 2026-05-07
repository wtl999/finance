const cloud = require('wx-server-sdk');
const { ensureUserMembership, syncUserMembership } = require('../shared/membership');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const getContext = () => cloud.getWXContext();

const syncCurrentUser = async (profile = null) => {
  const { OPENID, APPID, UNIONID } = getContext();
  const now = new Date();
  const serverNow = db.serverDate();

  if (profile) {
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
  }

  const result = await syncUserMembership({
    db,
    openid: OPENID,
    now,
    serverNow,
  });

  if (result) {
    return {
      success: true,
      data: {
        user: result.user,
      },
    };
  }

  const created = await ensureUserMembership({
    db,
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
    profile: {},
    now,
    serverNow,
  });

  return {
    success: true,
    data: {
      user: created.user,
    },
  };
};

exports.main = async (event) => {
  const action = event.action || 'sync';
  const profile = event.data || {};

  if (action === 'sync' || action === 'refresh') {
    return syncCurrentUser(profile);
  }

  if (action === 'updateProfile') {
    return syncCurrentUser(profile);
  }

  return {
    success: false,
    message: 'unknown action',
  };
};

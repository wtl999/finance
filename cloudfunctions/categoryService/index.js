const cloud = require('wx-server-sdk');
const {
  DEFAULT_BILL_CATEGORIES,
  normalizeBillCategories,
  buildViewUser,
} = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const getOpenId = () => cloud.getWXContext().OPENID;

const ensureUsersCollection = async () => {
  try {
    await db.createCollection('users');
  } catch (error) {
    const errMsg = String(error?.errMsg || error?.message || error || '');
    if (/resourceexist|already exists|table exist|collection already exists|宸插瓨鍦▅exist/i.test(errMsg)) {
      return;
    }

    throw error;
  }
};

const getUserByOpenId = async (openid) => {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
};

const getCategories = async () => {
  await ensureUsersCollection();
  const user = await getUserByOpenId(getOpenId());
  const categories = normalizeBillCategories(user?.billCategories || DEFAULT_BILL_CATEGORIES);

  return {
    success: true,
    data: {
      categories,
      user: user ? buildViewUser(user, new Date()) : null,
    },
  };
};

const saveCategories = async (categories = {}) => {
  await ensureUsersCollection();
  const user = await getUserByOpenId(getOpenId());

  if (!user) {
    return {
      success: false,
      message: '请先登录',
    };
  }

  const now = db.serverDate();
  const normalized = normalizeBillCategories(categories);

  await db.collection('users').doc(user._id).update({
    data: {
      billCategories: normalized,
      updatedAt: now,
    },
  });

  return {
    success: true,
    data: {
      categories: normalized,
      user: buildViewUser(
        {
          ...user,
          billCategories: normalized,
          updatedAt: now,
        },
        new Date(),
      ),
    },
  };
};

const resetCategories = async () => saveCategories(DEFAULT_BILL_CATEGORIES);

exports.main = async (event) => {
  const action = event.action || 'get';
  const data = event.data || {};

  if (action === 'get') return getCategories();
  if (action === 'save') return saveCategories(data.categories || {});
  if (action === 'reset') return resetCategories();

  return {
    success: false,
    message: 'unknown action',
  };
};

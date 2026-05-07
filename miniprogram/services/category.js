const { callFunction } = require('./cloud');
const auth = require('./auth');
const storage = require('../utils/storage');
const { STORAGE_KEYS, CLOUD_FUNCTIONS } = require('../utils/config');

const syncCachedUser = (user) => {
  if (!user) return;
  storage.set(STORAGE_KEYS.USER_PROFILE, user);
};

const getBillCategories = async () =>
  callFunction(CLOUD_FUNCTIONS.CATEGORY_SERVICE, {
    action: 'get',
    data: {},
  }).then((result) => {
    if (result?.success && result.data?.user) {
      syncCachedUser(result.data.user);
    }
    return result;
  });

const saveBillCategories = async (categories = {}) =>
  callFunction(CLOUD_FUNCTIONS.CATEGORY_SERVICE, {
    action: 'save',
    data: { categories },
  }).then((result) => {
    if (result?.success && result.data?.user) {
      syncCachedUser(result.data.user);
    }
    return result;
  });

const resetBillCategories = async () =>
  callFunction(CLOUD_FUNCTIONS.CATEGORY_SERVICE, {
    action: 'reset',
    data: {},
  }).then((result) => {
    if (result?.success && result.data?.user) {
      syncCachedUser(result.data.user);
    }
    return result;
  });

module.exports = {
  getBillCategories,
  resetBillCategories,
  saveBillCategories,
};

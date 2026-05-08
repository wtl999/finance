const { requestApi } = require('./http');
const storage = require('../utils/storage');
const { STORAGE_KEYS } = require('../utils/config');

const syncCachedUser = (user) => {
  if (!user) return;
  storage.set(STORAGE_KEYS.USER_PROFILE, user);
};

const getBillCategories = async () =>
  requestApi({
    path: '/api/functions/categoryService',
    data: { action: 'get', data: {} },
  }).then((result) => {
    if (result?.success && result.data?.user) {
      syncCachedUser(result.data.user);
    }
    return result;
  });

const saveBillCategories = async (categories = {}) =>
  requestApi({
    path: '/api/functions/categoryService',
    data: { action: 'save', data: { categories } },
  }).then((result) => {
    if (result?.success && result.data?.user) {
      syncCachedUser(result.data.user);
    }
    return result;
  });

const resetBillCategories = async () =>
  requestApi({
    path: '/api/functions/categoryService',
    data: { action: 'reset', data: {} },
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

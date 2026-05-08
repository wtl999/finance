// Category service: each account owns its own bill taxonomy.
const { DEFAULT_BILL_CATEGORIES, normalizeBillCategories } = require('../../miniprogram/utils/category');
const { buildUserView } = require('../lib');
const { saveUser } = require('../repositories/userRepository');

const getCategories = (user) => ({
  categories: normalizeBillCategories(user?.billCategoriesJson ? JSON.parse(user.billCategoriesJson) : DEFAULT_BILL_CATEGORIES),
  user: buildUserView(user),
});

const saveCategories = (user, categories = {}) => {
  const nextUser = saveUser({
    ...user,
    billCategories: normalizeBillCategories(categories),
  });

  return {
    categories: normalizeBillCategories(categories),
    user: buildUserView(nextUser),
  };
};

const resetCategories = (user) => saveCategories(user, DEFAULT_BILL_CATEGORIES);

module.exports = {
  getCategories,
  resetCategories,
  saveCategories,
};

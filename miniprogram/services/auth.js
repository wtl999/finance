const { callFunction } = require('./cloud');
const storage = require('../utils/storage');
const { STORAGE_KEYS, CLOUD_FUNCTIONS } = require('../utils/config');

const isLoggedIn = () => Boolean(storage.get(STORAGE_KEYS.LOGIN_FLAG, false));

const getCachedUser = () => storage.get(STORAGE_KEYS.USER_PROFILE, null);

const login = async (profile = {}, phoneCode = '') => {
  const result = await callFunction(CLOUD_FUNCTIONS.LOGIN, {
    action: 'login',
    data: profile,
    phoneCode,
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.LOGIN_FLAG, true);
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
  }

  return result;
};

const refreshUserState = async () => {
  const result = await callFunction(CLOUD_FUNCTIONS.USER_SYNC, {
    action: 'sync',
    data: {},
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
  }

  return result;
};

const updateProfile = async (profile = {}, phoneCode = '') => {
  const result = await callFunction(CLOUD_FUNCTIONS.LOGIN, {
    action: 'updateProfile',
    data: profile,
    phoneCode,
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
  }

  return result;
};

const logout = () => {
  storage.remove(STORAGE_KEYS.LOGIN_FLAG);
  storage.remove(STORAGE_KEYS.USER_PROFILE);
};

module.exports = {
  isLoggedIn,
  getCachedUser,
  login,
  refreshUserState,
  updateProfile,
  logout,
};

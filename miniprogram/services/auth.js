const { requestApi } = require('./http');
const storage = require('../utils/storage');
const { STORAGE_KEYS } = require('../utils/config');

const isLoggedIn = () => Boolean(storage.get(STORAGE_KEYS.LOGIN_FLAG, false));

const getCachedUser = () => storage.get(STORAGE_KEYS.USER_PROFILE, null);

const login = async (profile = {}, phoneCode = '') => {
  const result = await requestApi({
    path: '/api/functions/login',
    data: {
      action: 'login',
      data: profile,
      phoneCode,
    },
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.LOGIN_FLAG, true);
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
    if (result.data.token) {
      storage.set(STORAGE_KEYS.AUTH_TOKEN, result.data.token);
    }
  }

  return result;
};

const refreshUserState = async () => {
  const result = await requestApi({
    path: '/api/functions/userSync',
    data: {
      action: 'sync',
      data: {},
    },
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
  }

  return result;
};

const updateProfile = async (profile = {}, phoneCode = '') => {
  const result = await requestApi({
    path: '/api/functions/login',
    data: {
      action: 'updateProfile',
      data: profile,
      phoneCode,
    },
  });

  if (result && result.success) {
    storage.set(STORAGE_KEYS.USER_PROFILE, result.data.user);
  }

  return result;
};

const logout = () => {
  storage.remove(STORAGE_KEYS.LOGIN_FLAG);
  storage.remove(STORAGE_KEYS.USER_PROFILE);
  storage.remove(STORAGE_KEYS.AUTH_TOKEN);
};

module.exports = {
  isLoggedIn,
  getCachedUser,
  login,
  refreshUserState,
  updateProfile,
  logout,
};

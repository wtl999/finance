const { API_BASE_URL, STORAGE_KEYS } = require('./utils/config');
const auth = require('./services/auth');
const storage = require('./utils/storage');

const resolveApiBaseUrl = () => {
  const fromStorage = String(storage.get(STORAGE_KEYS.API_BASE_URL, '') || '').trim();
  return fromStorage || String(API_BASE_URL || '').trim();
};

const resolvedApiBaseUrl = resolveApiBaseUrl();

App({
  globalData: {
    env: '',
    apiBaseUrl: resolvedApiBaseUrl,
    isLoggedIn: false,
    userInfo: null,
  },

  onLaunch() {
    if (!resolvedApiBaseUrl) {
      console.warn('[app] Backend URL is not configured.');
    }

    this.syncLoginState();
    if (this.globalData.isLoggedIn && resolvedApiBaseUrl) {
      auth.refreshUserState().catch(() => null);
    }
  },

  syncLoginState() {
    const isLoggedIn = Boolean(storage.get(STORAGE_KEYS.LOGIN_FLAG, false));
    const userInfo = storage.get(STORAGE_KEYS.USER_PROFILE, null);

    this.globalData.isLoggedIn = isLoggedIn;
    this.globalData.userInfo = userInfo;

    return { isLoggedIn, userInfo };
  },

  setLoginState(userInfo) {
    storage.set(STORAGE_KEYS.LOGIN_FLAG, true);
    storage.set(STORAGE_KEYS.USER_PROFILE, userInfo);
    this.globalData.isLoggedIn = true;
    this.globalData.userInfo = userInfo;
  },

  clearLoginState() {
    storage.remove(STORAGE_KEYS.LOGIN_FLAG);
    storage.remove(STORAGE_KEYS.USER_PROFILE);
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
  },
});

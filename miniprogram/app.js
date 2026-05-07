const { CLOUD_ENV, STORAGE_KEYS } = require('./utils/config');
const auth = require('./services/auth');
const storage = require('./utils/storage');

App({
  globalData: {
    env: CLOUD_ENV,
    isLoggedIn: false,
    userInfo: null,
  },

  onLaunch() {
    if (wx.cloud) {
      const initOptions = CLOUD_ENV ? { env: CLOUD_ENV } : {};
      wx.cloud.init({
        ...initOptions,
        traceUser: true,
      });
    }

    this.syncLoginState();
    if (this.globalData.isLoggedIn) {
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

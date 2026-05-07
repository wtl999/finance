const { CLOUD_ENV, STORAGE_KEYS } = require('./utils/config');
const { envList } = require('./envList');
const auth = require('./services/auth');
const storage = require('./utils/storage');

const resolveCloudEnv = () => {
  if (CLOUD_ENV) return CLOUD_ENV;
  const firstEnv = Array.isArray(envList) ? envList[0] : null;
  return firstEnv?.envId || firstEnv?.env || '';
};

const resolvedEnv = resolveCloudEnv();

App({
  globalData: {
    env: resolvedEnv,
    isLoggedIn: false,
    userInfo: null,
  },

  onLaunch() {
    if (wx.cloud) {
      const initOptions = resolvedEnv ? { env: resolvedEnv } : {};
      wx.cloud.init({
        ...initOptions,
        traceUser: true,
      });
    }

    if (!resolvedEnv) {
      console.warn('[app] Cloud env is not configured. Set miniprogram/utils/config.js CLOUD_ENV or miniprogram/envList.js.');
    }

    this.syncLoginState();
    if (this.globalData.isLoggedIn && resolvedEnv) {
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

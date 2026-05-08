const app = getApp();
const auth = require('../../services/auth');
const { ROUTES, go } = require('../../utils/route');
const { APP_NAME } = require('../../utils/config');

const DEFAULT_AVATAR = '/images/avatar.png';

const wxLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });

const wxGetUserProfile = () =>
  new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善头像和昵称',
      success: resolve,
      fail: reject,
    });
  });

Page({
  data: {
    appName: APP_NAME,
    loading: false,
    loginMode: 'wechat',
    wxLoginCode: '',
    agree: true,
    avatarPreview: DEFAULT_AVATAR,
    profile: {
      avatarUrl: '',
      nickname: '',
      phoneNumber: '',
      phoneCountryCode: '',
      password: '',
    },
  },

  onShow() {
    if (auth.isLoggedIn()) {
      go(ROUTES.home, 'switchTab');
    }
  },

  setProfile(nextProfile = {}) {
    const profile = {
      ...this.data.profile,
      ...nextProfile,
    };

    this.setData({
      profile,
      avatarPreview: profile.avatarUrl || DEFAULT_AVATAR,
    });
  },

  handlePhoneInput(event) {
    this.setProfile({
      phoneNumber: String(event.detail.value || '').trim(),
    });
  },

  handlePasswordInput(event) {
    this.setProfile({
      password: String(event.detail.value || ''),
    });
  },

  toggleMode() {
    this.setData({
      loginMode: this.data.loginMode === 'wechat' ? 'password' : 'wechat',
    });
  },

  toggleAgree() {
    this.setData({
      agree: !this.data.agree,
    });
  },

  async ensureWxCode() {
    if (this.data.wxLoginCode) {
      return this.data.wxLoginCode;
    }

    const result = await wxLogin();
    const code = result?.code || '';
    this.setData({ wxLoginCode: code });
    return code;
  },

  async fetchWxProfile() {
    try {
      const profileRes = await wxGetUserProfile();
      const profile = profileRes.userInfo || {};
      this.setProfile({
        avatarUrl: profile.avatarUrl || this.data.profile.avatarUrl,
        nickname: profile.nickName || this.data.profile.nickname,
      });
      return profile;
    } catch (error) {
      const errMsg = error?.errMsg || '';
      if (errMsg.includes('cancel')) {
        wx.showToast({ title: '已取消授权', icon: 'none' });
      }
      return null;
    }
  },

  async handleWechatLogin() {
    if (this.data.loading) return;
    if (!this.data.agree) {
      wx.showToast({ title: '请先同意协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const wxLoginCode = await this.ensureWxCode();
      if (!wxLoginCode) {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        return;
      }

      const profile = await this.fetchWxProfile();
      const result = await auth.login({
        mode: 'wechat',
        wxLoginCode,
        profile: {
          ...this.data.profile,
          ...(profile || {}),
        },
      });

      if (result.success) {
        app.setLoginState(result.data.user);
        go(ROUTES.home, 'switchTab');
        return;
      }

      wx.showToast({ title: result.message || '登录失败', icon: 'none' });
    } catch (error) {
      console.error('[login] wechat login failed:', error);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handlePasswordLogin() {
    if (this.data.loading) return;

    if (!this.data.profile.phoneNumber) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await auth.login({
        mode: 'password',
        profile: {
          phoneNumber: this.data.profile.phoneNumber,
          password: this.data.profile.password,
          nickname: this.data.profile.nickname,
          avatarUrl: this.data.profile.avatarUrl,
        },
      });

      if (result.success) {
        app.setLoginState(result.data.user);
        go(ROUTES.home, 'switchTab');
        return;
      }

      wx.showToast({ title: result.message || '登录失败', icon: 'none' });
    } catch (error) {
      console.error('[login] password login failed:', error);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});

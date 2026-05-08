const app = getApp();
const auth = require('../../services/auth');
const { ROUTES, go } = require('../../utils/route');
const { APP_NAME } = require('../../utils/config');

const DEFAULT_AVATAR = '/images/avatar.png';

Page({
  data: {
    appName: APP_NAME,
    loading: false,
    avatarPreview: DEFAULT_AVATAR,
    profile: {
      avatarUrl: '',
      nickname: '',
      phoneCode: '',
      phoneNumber: '',
      phoneCountryCode: '',
      phoneBound: false,
    },
  },

  onShow() {
    if (auth.isLoggedIn()) {
      go(ROUTES.home, 'switchTab');
    }
  },

  syncPreview(nextProfile = {}) {
    const profile = {
      ...this.data.profile,
      ...nextProfile,
    };

    this.setData({
      avatarPreview: profile.avatarUrl || DEFAULT_AVATAR,
      profile: {
        ...profile,
        phoneBound: Boolean(profile.phoneCode || profile.phoneNumber),
      },
    });
  },

  handleNicknameInput(event) {
    this.syncPreview({
      nickname: String(event.detail.value || '').trim(),
    });
  },

  handleChooseAvatar(event) {
    this.syncPreview({
      avatarUrl: event.detail?.avatarUrl || '',
    });
  },

  handlePhoneNumber(event) {
    const code = event.detail?.code || '';

    if (!code) {
      wx.showToast({
        title: '手机号授权被取消了',
        icon: 'none',
      });
      return;
    }

    this.syncPreview({
      phoneCode: code,
    });

    wx.showToast({
      title: '手机号已授权',
      icon: 'success',
    });
  },

  async fetchWxProfile() {
    try {
      const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善头像和昵称',
          success: resolve,
          fail: reject,
        });
      });

      const profile = profileRes.userInfo || {};
      this.syncPreview({
        avatarUrl: profile.avatarUrl || this.data.profile.avatarUrl,
        nickname: profile.nickName || this.data.profile.nickname,
      });

      return profile;
    } catch (error) {
      const errMsg = error?.errMsg || '';
      if (errMsg.includes('cancel')) {
        wx.showToast({
          title: '已取消微信资料授权',
          icon: 'none',
        });
      }
      return null;
    }
  },

  async handleLogin() {
    if (this.data.loading) return;

    if (!app.globalData.apiBaseUrl) {
      wx.showToast({
        title: '请先配置后端地址',
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      if (!this.data.profile.avatarUrl || !this.data.profile.nickname) {
        await this.fetchWxProfile();
      }

      const nickname = String(this.data.profile.nickname || '').trim();
      if (!nickname) {
        wx.showToast({
          title: '请先填写昵称',
          icon: 'none',
        });
        return;
      }

      const result = await auth.login(
        {
          nickName: nickname,
          avatarUrl: this.data.profile.avatarUrl || '',
        },
        this.data.profile.phoneCode || '',
      );

      if (result.success) {
        app.setLoginState(result.data.user);
        wx.showToast({
          title: '登录成功',
          icon: 'success',
        });
        go(ROUTES.home, 'switchTab');
        return;
      }

      wx.showToast({
        title: result.message || '登录失败',
        icon: 'none',
      });
    } catch (error) {
      const errMsg = error?.errMsg || error?.message || '';
      console.error('[login] login failed:', error);

      if (errMsg.includes('timeout')) {
        wx.showToast({
          title: '登录超时，请检查后端服务',
          icon: 'none',
        });
      } else {
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none',
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  handleContinueWithoutPhone() {
    this.handleLogin();
  },
});

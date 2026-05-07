const app = getApp();
const auth = require('../../services/auth');
const { ROUTES, go } = require('../../utils/route');
const { APP_NAME } = require('../../utils/config');

Page({
  data: {
    appName: APP_NAME,
    loading: false,
  },

  onShow() {
    if (auth.isLoggedIn()) {
      go(ROUTES.home, 'switchTab');
    }
  },

  async handleLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于创建记账用户资料',
          success: resolve,
          fail: reject,
        });
      });

      const result = await auth.login(profile.userInfo || {});

      if (result.success) {
        app.setLoginState(result.data.user);
        wx.showToast({ title: '登录成功', icon: 'success' });
        go(ROUTES.home, 'switchTab');
        return;
      }

      wx.showToast({ title: '登录失败', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '已取消登录', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});

const ROUTES = {
  login: '/pages/login/index',
  home: '/pages/index/index',
  add: '/pages/add/index',
  bills: '/pages/bills/index',
  stats: '/pages/stats/index',
  profile: '/pages/profile/index',
  report: '/pages/ai-report/index',
};

const go = (url, method = 'navigateTo') => {
  const launcher =
    method === 'switchTab'
      ? wx.switchTab
      : method === 'reLaunch'
      ? wx.reLaunch
      : method === 'redirectTo'
      ? wx.redirectTo
      : wx.navigateTo;

  launcher({ url });
};

module.exports = {
  ROUTES,
  go,
};

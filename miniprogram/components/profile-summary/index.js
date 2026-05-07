Component({
  properties: {
    user: {
      type: Object,
      value: {},
    },
  },

  data: {
    initial: 'U',
    quotaText: '剩余 0 次',
    statusText: 'free',
  },

  observers: {
    user(user) {
      const name = String(user?.nickname || '微信用户').trim();
      const quotaText = user?.aiUnlimited
        ? '无限额度'
        : `剩余 ${user?.aiQuotaRemainingText || user?.aiQuotaRemaining || 0} 次`;
      const statusText =
        user?.memberStatus === 'active'
          ? '有效会员'
          : user?.memberStatus === 'expired'
          ? '已过期'
          : '免费用户';

      this.setData({
        initial: name.slice(0, 1).toUpperCase(),
        quotaText,
        statusText,
      });
    },
  },
});

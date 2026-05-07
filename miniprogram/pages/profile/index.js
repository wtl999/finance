const app = getApp();
const auth = require('../../services/auth');
const billService = require('../../services/bill');
const { ROUTES, go } = require('../../utils/route');
const { formatMonth, formatMoney } = require('../../utils/format');

const CURRENT_MONTH = formatMonth(new Date());
const DEFAULT_USER = {
  nickname: '微信用户',
  avatarUrl: '',
  memberLabel: '免费',
  memberStatus: 'free',
  aiQuotaRemainingText: '0',
  aiUnlimited: false,
};

const escapeCsv = (value) =>
  `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')}"`;

const buildCsv = (bills = []) => {
  const rows = [
    ['日期', '类型', '金额', '分类', '商户', '备注', '来源'].join(','),
    ...bills.map((bill) =>
      [
        escapeCsv(bill.date || ''),
        escapeCsv(bill.type === 'income' ? '收入' : '支出'),
        escapeCsv(formatMoney(bill.amount || 0)),
        escapeCsv(bill.category || '其他'),
        escapeCsv(bill.merchant || ''),
        escapeCsv(bill.remark || ''),
        escapeCsv(bill.source || ''),
      ].join(','),
    ),
  ];

  return rows.join('\n');
};

const saveTextFile = (fileName, content) => {
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};

const shareFile = (options) =>
  new Promise((resolve, reject) => {
    wx.shareFileMessage({
      ...options,
      success: resolve,
      fail: reject,
    });
  });

const copyText = (text) =>
  new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: text,
      success: resolve,
      fail: reject,
    });
  });

Page({
  data: {
    loading: false,
    userInfo: DEFAULT_USER,
    month: CURRENT_MONTH,
    monthSummary: {
      totalCount: 0,
      totalExpense: 0,
      totalIncome: 0,
    },
    profileCards: [],
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    this.loadProfile();
  },

  async loadProfile(silent = false) {
    if (!silent) {
      this.setData({ loading: true });
    }

    try {
      const [userResult, summaryResult] = await Promise.all([
        auth.refreshUserState().catch(() => null),
        billService.getBillSummary({
          month: this.data.month,
        }).catch(() => null),
      ]);

      const nextUser = userResult?.success
        ? userResult.data.user
        : auth.getCachedUser() || DEFAULT_USER;
      const summary = summaryResult?.data || this.data.monthSummary;

      if (userResult?.success && app.setLoginState) {
        app.setLoginState(nextUser);
      }

      this.setData({
        userInfo: {
          ...DEFAULT_USER,
          ...nextUser,
          memberLabel: nextUser.memberLabel || (nextUser.aiUnlimited ? '会员' : '免费'),
        },
        monthSummary: summary,
        profileCards: [
          {
            label: 'AI 剩余额度',
            value: nextUser.aiUnlimited ? '无限' : String(nextUser.aiQuotaRemainingText ?? nextUser.aiQuotaRemaining ?? 0),
            desc: nextUser.aiUnlimited ? '会员无限 AI' : '本月可用次数',
          },
          {
            label: '本月账单',
            value: String(summary.totalCount || 0),
            desc: '当前月累计记录',
          },
          {
            label: '会员状态',
            value: nextUser.memberLabel || '免费',
            desc: nextUser.vipExpireTime ? `到期 ${String(nextUser.vipExpireTime).slice(0, 10)}` : '未开通会员',
          },
        ],
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      if (!silent) {
        this.setData({ loading: false });
      }
    }
  },

  handleSettings() {
    wx.showActionSheet({
      itemList: ['同步会员状态', '清理本地缓存'],
      success: async ({ tapIndex }) => {
        if (tapIndex === 0) {
          await this.loadProfile(true);
          wx.showToast({
            title: '已同步',
            icon: 'success',
          });
          return;
        }

        if (tapIndex === 1) {
          auth.logout();
          if (app.clearLoginState) {
            app.clearLoginState();
          }
          wx.showToast({
            title: '已清理',
            icon: 'success',
          });
          go(ROUTES.login, 'reLaunch');
        }
      },
    });
  },

  handleAbout() {
    wx.showModal({
      title: '关于',
      content: 'AI 记账助手 MVP\n微信云开发 + DeepSeek + 原生小程序',
      showCancel: false,
    });
  },

  async handleExport() {
    try {
      wx.showLoading({
        title: '导出中',
      });

      const result = await billService.getBillPage({
        month: this.data.month,
        page: 1,
        pageSize: 500,
      });

      const bills = result.data?.list || [];
      const csv = buildCsv(bills);
      const fileName = `bills-${this.data.month}.csv`;
      const filePath = saveTextFile(fileName, csv);

      try {
        await shareFile({
          filePath,
          fileName,
        });
      } catch (shareError) {
        await copyText(csv);
      }

      wx.showToast({
        title: '已导出',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },
});

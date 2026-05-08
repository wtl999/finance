const app = getApp();
const auth = require('../../services/auth');
const billService = require('../../services/bill');
const reportService = require('../../services/report');
const ocrService = require('../../services/ocr');
const { ROUTES, go } = require('../../utils/route');
const { APP_NAME } = require('../../utils/config');
const { formatDate, formatMonth, formatMoney } = require('../../utils/format');
const { getOcrSourceMeta } = require('../../utils/ocr');
const { getBillCategories } = require('../../utils/category');

Page({
  data: {
    appName: APP_NAME,
    userInfo: null,
    month: formatMonth(new Date()),
    today: formatDate(new Date()),
    loading: false,
    summaryCards: [],
    todayBills: [],
    ocrLoading: false,
    ocrSource: 'wechat',
    ocrResult: null,
    ocrError: '',
    categories: getBillCategories(auth.getCachedUser()),
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    const user = auth.getCachedUser();
    this.setData({
      userInfo: user,
      categories: getBillCategories(user),
    });

    this.loadDashboard();
  },

  async loadDashboard() {
    this.setData({ loading: true });

    try {
      const [summaryRes, todayRes] = await Promise.all([
        billService.getBillSummary({ month: this.data.month }),
        billService.listBills({ date: this.data.today, limit: 5 }),
      ]);

      const summary = summaryRes.data || {};
      this.setData({
        summaryCards: [
          { label: '本月支出', value: `¥${formatMoney(summary.totalExpense)}`, desc: `${summary.expenseCount || 0} 笔` },
          { label: '本月收入', value: `¥${formatMoney(summary.totalIncome)}`, desc: `${summary.incomeCount || 0} 笔` },
          { label: '月度结余', value: `¥${formatMoney(summary.netAmount)}`, desc: '收入 - 支出' },
          { label: '今日消费', value: `¥${formatMoney(summary.todayExpense)}`, desc: `${summary.todayCount || 0} 笔` },
        ],
        todayBills: (todayRes.data?.list || []).map((bill) => ({
          ...bill,
          dateText: bill.date || '',
          amountText: formatMoney(bill.amount),
        })),
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleQuickAction(event) {
    const { action } = event.detail || {};

    if (action === 'add') go(ROUTES.add, 'navigateTo');
    if (action === 'upload') {
      this.handleUploadScreenshot();
    }
    if (action === 'bills') go(ROUTES.bills, 'navigateTo');
    if (action === 'report') go(ROUTES.report, 'navigateTo');
    if (action === 'stats') go(ROUTES.stats, 'navigateTo');
  },

  handleOpenCategories() {
    go(ROUTES.categories, 'navigateTo');
  },

  async handleUploadScreenshot() {
    if (this.data.ocrLoading) return;

    try {
      const chooseResult = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });

      const filePath = chooseResult.tempFiles[0].tempFilePath;
      this.setData({
        ocrLoading: true,
        ocrError: '',
        ocrResult: null,
      });

      const result = await ocrService.uploadRecognizeAndSave({
        filePath,
        source: this.data.ocrSource,
      });

      if (!result.success) {
        this.setData({
          ocrError: result.message || '识别失败',
        });
        wx.showToast({
          title: '识别失败',
          icon: 'none',
        });
        return;
      }

      const sourceMeta = getOcrSourceMeta(this.data.ocrSource);
      this.setData({
        ocrResult: {
          ...result.data.ocr,
          bill: result.data.bill || null,
          sourceLabel: sourceMeta.label,
        },
      });

      wx.showToast({
        title: '识别并记账成功',
        icon: 'success',
      });

      this.loadDashboard();
      if (result.data?.bill) {
        wx.showModal({
          title: '已记账',
          content: `${result.data.bill.type === 'income' ? '收入' : '支出'} ${result.data.bill.amount || 0} 元\n${result.data.bill.category || '其他'}\n${result.data.bill.date || ''}`,
          showCancel: false,
          confirmText: '查看账单',
          success: () => {
            go(ROUTES.bills, 'switchTab');
          },
        });
      }
    } catch (error) {
      const message = error?.errMsg || error?.message || '上传失败';
      this.setData({
        ocrError: message,
      });
      wx.showToast({
        title: '上传失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        ocrLoading: false,
      });
    }
  },
});

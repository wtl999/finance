const app = getApp();
const auth = require('../../services/auth');
const billService = require('../../services/bill');
const reportService = require('../../services/report');
const ocrService = require('../../services/ocr');
const { ROUTES, go } = require('../../utils/route');
const { APP_NAME, OCR_SOURCES } = require('../../utils/config');
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
    aiPrompt: '',
    aiReport: null,
    summaryCards: [],
    todayBills: [],
    ocrLoading: false,
    ocrSource: 'wechat',
    ocrResult: null,
    ocrError: '',
    ocrSources: OCR_SOURCES,
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

  handlePromptInput(event) {
    this.setData({
      aiPrompt: event.detail.value,
    });
  },

  async handleAiAnalyze() {
    if (!this.data.aiPrompt.trim()) {
      wx.showToast({
        title: '请输入分析内容',
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await reportService.generateMonthlyReport({
        month: this.data.month,
        prompt: this.data.aiPrompt,
      });

      this.setData({
        aiReport: result.data || null,
      });
    } catch (error) {
      wx.showToast({
        title: 'AI 分析失败',
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

  handleGoReport() {
    go(ROUTES.report, 'navigateTo');
  },

  handleOpenCategories() {
    go(ROUTES.categories, 'navigateTo');
  },

  handleSelectOcrSource(event) {
    this.setData({
      ocrSource: event.currentTarget.dataset.value,
    });
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
        title: '识别成功',
        icon: 'success',
      });
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

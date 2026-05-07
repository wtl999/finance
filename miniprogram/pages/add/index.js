const auth = require('../../services/auth');
const billService = require('../../services/bill');
const aiService = require('../../services/ai');
const { ROUTES, go } = require('../../utils/route');
const { formatDate } = require('../../utils/format');
const { validateBillForm } = require('../../utils/validators');
const { BILL_CATEGORIES } = require('../../utils/config');

Page({
  data: {
    categories: BILL_CATEGORIES,
    loading: false,
    aiLoading: false,
    form: {
      amount: '',
      category: '',
      merchant: '',
      remark: '',
      date: formatDate(new Date()),
      type: 'expense',
    },
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
    }
  },

  handleInput(event) {
    const { field, value } = event.detail;
    this.setData({
      [`form.${field}`]: value,
    });
  },

  handleTypeChange(event) {
    this.setData({
      'form.type': event.detail.type,
    });
  },

  handleDateChange(event) {
    this.setData({
      'form.date': event.detail.value,
    });
  },

  handleCategoryTap(event) {
    this.setData({
      'form.category': event.detail.value,
    });
  },

  async handleAiClassify() {
    const { merchant, remark } = this.data.form;
    const text = `${merchant} ${remark}`.trim();

    if (!text) {
      wx.showToast({
        title: '请先输入商户或备注',
        icon: 'none',
      });
      return;
    }

    this.setData({ aiLoading: true });

    try {
      const result = await aiService.classifyBillText({ text });
      if (result.success && result.data) {
        this.setData({
          'form.category': result.data.category || this.data.form.category,
          'form.type': result.data.type || this.data.form.type,
        });
        wx.showToast({
          title: '已自动识别',
          icon: 'success',
        });
      }
    } catch (error) {
      wx.showToast({
        title: '识别失败',
        icon: 'none',
      });
    } finally {
      this.setData({ aiLoading: false });
    }
  },

  async handleSubmit() {
    const check = validateBillForm(this.data.form);
    if (!check.ok) {
      wx.showToast({
        title: check.message,
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const payload = {
        ...this.data.form,
        amount: Number(this.data.form.amount),
      };

      const result = await billService.createBill(payload);

      if (result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success',
        });
        this.setData({
          form: {
            amount: '',
            category: '',
            merchant: '',
            remark: '',
            date: formatDate(new Date()),
            type: 'expense',
          },
        });
        go(ROUTES.bills, 'switchTab');
        return;
      }

      wx.showToast({
        title: '保存失败',
        icon: 'none',
      });
    } catch (error) {
      wx.showToast({
        title: '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});

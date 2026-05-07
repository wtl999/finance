const app = getApp();
const auth = require('../../services/auth');
const billService = require('../../services/bill');
const aiService = require('../../services/ai');
const categoryService = require('../../services/category');
const { ROUTES, go } = require('../../utils/route');
const { formatDate } = require('../../utils/format');
const { validateBillForm } = require('../../utils/validators');
const { getBillCategories, resolveCategoryValue } = require('../../utils/category');

const makeEmptyForm = (categories = null) => {
  const categoryGroups = categories || getBillCategories(auth.getCachedUser());
  return {
    amount: '',
    category: resolveCategoryValue(categoryGroups, 'expense', ''),
    merchant: '',
    remark: '',
    date: formatDate(new Date()),
    type: 'expense',
  };
};

Page({
  data: {
    categories: getBillCategories(auth.getCachedUser()),
    loading: false,
    aiLoading: false,
    form: makeEmptyForm(),
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    const user = auth.getCachedUser();
    if (user?.billCategories) {
      this.setData({
        categories: getBillCategories(user),
      });
    } else {
      const result = await categoryService.getBillCategories().catch(() => null);
      if (result?.success && result.data?.user) {
        this.setData({
          categories: getBillCategories(result.data.user),
        });
        if (app.setLoginState) {
          app.setLoginState(result.data.user);
        }
      }
    }

    this.setData({
      form: makeEmptyForm(this.data.categories),
    });
  },

  handleInput(event) {
    const { field, value } = event.detail;
    this.setData({
      [`form.${field}`]: value,
    });
  },

  handleTypeChange(event) {
    const type = event.detail.type;
    const nextCategory = resolveCategoryValue(this.data.categories, type, this.data.form.category);
    this.setData({
      'form.type': type,
      'form.category': nextCategory,
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
      const result = await aiService.classifyBillText({
        text,
        categories: this.data.categories,
      });

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
          form: makeEmptyForm(this.data.categories),
        });
        go(ROUTES.bills, 'navigateTo');
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

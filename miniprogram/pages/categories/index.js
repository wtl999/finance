const app = getApp();
const auth = require('../../services/auth');
const categoryService = require('../../services/category');
const { ROUTES, go } = require('../../utils/route');
const {
  buildValue,
  cloneBillCategories,
  getBillCategories,
  getCategoryTypes,
  normalizeBillCategories,
} = require('../../utils/category');

const makeInitialState = (user = null) => cloneBillCategories(getBillCategories(user));

Page({
  data: {
    loading: false,
    saving: false,
    currentType: 'expense',
    categories: makeInitialState(auth.getCachedUser()),
    draftLabel: '',
    types: getCategoryTypes(),
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    this.setData({
      categories: makeInitialState(auth.getCachedUser()),
      draftLabel: '',
    });
  },

  getCurrentList() {
    return this.data.categories[this.data.currentType] || [];
  },

  handleSwitchType(event) {
    this.setData({
      currentType: event.currentTarget.dataset.type,
      draftLabel: '',
    });
  },

  handleDraftInput(event) {
    this.setData({
      draftLabel: event.detail.value,
    });
  },

  handleCategoryLabelInput(event) {
    const { index } = event.currentTarget.dataset;
    const label = event.detail.value;
    const nextCategories = cloneBillCategories(this.data.categories);
    nextCategories[this.data.currentType][index] = {
      ...nextCategories[this.data.currentType][index],
      label,
      keywords: [label],
    };
    this.setData({ categories: nextCategories });
  },

  handleDeleteCategory(event) {
    const { index } = event.currentTarget.dataset;
    const nextCategories = cloneBillCategories(this.data.categories);
    const currentList = nextCategories[this.data.currentType];

    if (currentList.length <= 1) {
      wx.showToast({
        title: '至少保留 1 个分类',
        icon: 'none',
      });
      return;
    }

    currentList.splice(index, 1);
    this.setData({ categories: nextCategories });
  },

  handleAddCategory() {
    const label = String(this.data.draftLabel || '').trim();
    if (!label) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none',
      });
      return;
    }

    const currentList = this.getCurrentList();
    const exists = currentList.some((item) => item.label === label);
    if (exists) {
      wx.showToast({
        title: '分类已存在',
        icon: 'none',
      });
      return;
    }

    const nextCategories = cloneBillCategories(this.data.categories);
    nextCategories[this.data.currentType].push({
      value: buildValue(label, this.data.currentType),
      label,
      tone: nextCategories[this.data.currentType].length % 2 === 0 ? 'cyan' : 'violet',
      keywords: [label],
    });

    this.setData({
      categories: nextCategories,
      draftLabel: '',
    });
  },

  async handleSave() {
    if (this.data.saving) return;

    const normalized = normalizeBillCategories(this.data.categories);
    const expenseLabels = new Set();
    const incomeLabels = new Set();

    for (const item of normalized.expense) {
      const label = String(item.label || '').trim();
      if (!label) {
        wx.showToast({ title: '支出分类名称不能为空', icon: 'none' });
        return;
      }
      if (expenseLabels.has(label)) {
        wx.showToast({ title: '支出分类不能重复', icon: 'none' });
        return;
      }
      expenseLabels.add(label);
    }

    for (const item of normalized.income) {
      const label = String(item.label || '').trim();
      if (!label) {
        wx.showToast({ title: '收入分类名称不能为空', icon: 'none' });
        return;
      }
      if (incomeLabels.has(label)) {
        wx.showToast({ title: '收入分类不能重复', icon: 'none' });
        return;
      }
      incomeLabels.add(label);
    }

    this.setData({ saving: true });

    try {
      const result = await categoryService.saveBillCategories(normalized);
      if (result.success) {
        const user = result.data?.user || auth.getCachedUser();
        if (app.setLoginState && user) {
          app.setLoginState(user);
        }
        this.setData({
          categories: makeInitialState(user),
          draftLabel: '',
        });
        wx.showToast({
          title: '分类已保存',
          icon: 'success',
        });
        return;
      }

      wx.showToast({
        title: result.message || '保存失败',
        icon: 'none',
      });
    } catch (error) {
      wx.showToast({
        title: '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ saving: false });
    }
  },

  handleReset() {
    this.setData({
      categories: makeInitialState(auth.getCachedUser()),
      draftLabel: '',
    });
  },
});

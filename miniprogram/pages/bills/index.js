const auth = require('../../services/auth');
const billService = require('../../services/bill');
const { ROUTES, go } = require('../../utils/route');
const { formatDate, formatMoney, formatMonth, formatDateTime } = require('../../utils/format');
const { groupBillsByDate } = require('../../utils/bill');
const { validateBillForm } = require('../../utils/validators');
const { BILL_CATEGORIES } = require('../../utils/config');

const PAGE_SIZE = 10;

const makeEmptyForm = () => ({
  amount: '',
  category: '',
  merchant: '',
  remark: '',
  date: formatDate(new Date()),
  type: 'expense',
});

Page({
  data: {
    loading: false,
    refreshing: false,
    loadingMore: false,
    month: formatMonth(new Date()),
    type: 'all',
    page: 1,
    pageSize: PAGE_SIZE,
    hasMore: true,
    bills: [],
    billGroups: [],
    showEditor: false,
    editingBillId: '',
    form: makeEmptyForm(),
    categories: BILL_CATEGORIES,
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      go(ROUTES.login, 'reLaunch');
      return;
    }

    this.resetAndLoad();
  },

  onPullDownRefresh() {
    this.resetAndLoad(true);
  },

  onReachBottom() {
    if (this.data.loadingMore || !this.data.hasMore || this.data.loading) {
      return;
    }

    this.loadBills(this.data.page + 1);
  },

  async resetAndLoad(fromPullDown = false) {
    this.setData({
      page: 1,
      hasMore: true,
      bills: [],
      billGroups: [],
      loading: true,
      refreshing: fromPullDown,
    });

    await this.loadBills(1);
  },

  async loadBills(page = 1) {
    if (page === 1) {
      this.setData({ loading: true });
    } else {
      this.setData({ loadingMore: true });
    }

    try {
      const result = await billService.getBillPage({
        month: this.data.month,
        type: this.data.type === 'all' ? '' : this.data.type,
        page,
        pageSize: this.data.pageSize,
      });

      const incoming = (result.data?.list || []).map((bill) => ({
        ...bill,
        dateText: bill.date || formatDate(new Date()),
        createdAtText: bill.createdAt ? formatDateTime(bill.createdAt) : '',
        amountText: formatMoney(bill.amount),
      }));

      const mergedBills = page === 1 ? incoming : this.data.bills.concat(incoming);
      const billGroups = groupBillsByDate(mergedBills);

      this.setData({
        bills: mergedBills,
        billGroups,
        page,
        hasMore: Boolean(result.data?.hasMore),
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        loading: false,
        loadingMore: false,
      });
      if (this.data.refreshing) {
        this.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      }
    }
  },

  handleMonthChange(event) {
    this.setData({
      month: event.detail.value,
    });
    this.resetAndLoad();
  },

  handleTypeChange(event) {
    this.setData({
      type: event.detail.type,
    });
    this.resetAndLoad();
  },

  handleAdd() {
    go(ROUTES.add, 'switchTab');
  },

  handleFilterCurrentMonth() {
    this.setData({
      month: formatMonth(new Date()),
    });
    this.resetAndLoad();
  },

  handleEdit(event) {
    const bill = event.detail.bill;
    this.setData({
      editingBillId: bill._id,
      showEditor: true,
      form: {
        amount: String(bill.amount || ''),
        category: bill.category || '',
        merchant: bill.merchant || '',
        remark: bill.remark || '',
        date: bill.date || formatDate(new Date()),
        type: bill.type || 'expense',
      },
    });
  },

  handleCloseEditor() {
    this.setData({
      showEditor: false,
      editingBillId: '',
      form: makeEmptyForm(),
    });
  },

  handleFieldChange(event) {
    const { field, value } = event.detail;
    this.setData({
      [`form.${field}`]: value,
    });
  },

  handleTypeChangeEditor(event) {
    this.setData({
      'form.type': event.detail.type,
    });
  },

  handleCategoryChange(event) {
    this.setData({
      'form.category': event.detail.value,
    });
  },

  handleDateChange(event) {
    this.setData({
      'form.date': event.detail.value,
    });
  },

  async handleSaveEdit() {
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
      const result = await billService.updateBill({
        _id: this.data.editingBillId,
        ...this.data.form,
        amount: Number(this.data.form.amount),
      });

      if (result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success',
        });
        this.handleCloseEditor();
        this.resetAndLoad();
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none',
        });
      }
    } catch (error) {
      wx.showToast({
        title: '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleDelete(event) {
    const { id } = event.detail;

    const confirm = await new Promise((resolve) => {
      wx.showModal({
        title: '删除账单',
        content: '确认删除这条账单吗？',
        confirmText: '删除',
        confirmColor: '#f43f5e',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      });
    });

    if (!confirm) {
      return;
    }

    try {
      const result = await billService.deleteBill(id);
      if (result.success) {
        wx.showToast({
          title: '已删除',
          icon: 'success',
        });
        this.resetAndLoad();
      }
    } catch (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'none',
      });
    }
  },
});

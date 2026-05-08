const { getCategoryOptions, resolveCategoryValue } = require('../../utils/category');

Component({
  properties: {
    form: {
      type: Object,
      value: {
        amount: '',
        category: '',
        merchant: '',
        remark: '',
        date: '',
        type: 'expense',
      },
    },
    categories: {
      type: Object,
      value: {
        expense: [],
        income: [],
      },
    },
    loading: {
      type: Boolean,
      value: false,
    },
    aiLoading: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    currentCategories: [],
  },

  observers: {
    'form.type, form.category, categories'(type, category, categories) {
      const normalizedCategories = getCategoryOptions(categories, type || 'expense');
      const resolvedCategory = resolveCategoryValue(categories, type || 'expense', category || '');
      const hasCurrent = normalizedCategories.some((item) => item.value === category || item.label === category);
      const currentCategories = hasCurrent || !resolvedCategory
        ? normalizedCategories
        : [{ value: category, label: category, tone: 'gray' }].concat(normalizedCategories);

      this.setData({
        currentCategories,
      });
    },
  },

  methods: {
    emitField(field, value) {
      this.triggerEvent('fieldchange', { field, value });
    },

    handleAmountInput(event) {
      this.emitField('amount', event.detail.value);
    },

    handleMerchantInput(event) {
      this.emitField('merchant', event.detail.value);
    },

    handleRemarkInput(event) {
      this.emitField('remark', event.detail.value);
    },

    handleTypeChange(event) {
      this.triggerEvent('typechange', {
        type: event.currentTarget.dataset.type,
      });
    },

    handleCategoryTap(event) {
      this.triggerEvent('categorychange', {
        value: event.currentTarget.dataset.value,
      });
    },

    handleDateChange(event) {
      this.triggerEvent('datechange', {
        value: event.detail.value,
      });
    },

    handleAiClassify() {
      this.triggerEvent('aiclassify');
    },

    handleManageCategories() {
      this.triggerEvent('managecategories');
    },

    handleSubmit() {
      this.triggerEvent('submit');
    },
  },
});

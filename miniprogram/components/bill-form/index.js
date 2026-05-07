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
      type: Array,
      value: [],
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

    handleSubmit() {
      this.triggerEvent('submit');
    },
  },
});

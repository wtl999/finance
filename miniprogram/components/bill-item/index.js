const { formatDate, formatMoney } = require('../../utils/format');
const { getCategoryMeta, getBillCategories } = require('../../utils/category');

Component({
  properties: {
    bill: {
      type: Object,
      value: {},
    },
    categories: {
      type: Object,
      value: null,
    },
    showDelete: {
      type: Boolean,
      value: false,
    },
    showEdit: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    handleDelete() {
      this.triggerEvent('delete', {
        id: this.data.bill._id,
      });
    },

    handleEdit() {
      this.triggerEvent('edit', {
        bill: this.data.normalizedBill,
      });
    },
  },

  observers: {
    'bill, categories'(bill, categories) {
      if (!bill) return;
      const categoryMeta = bill.categoryMeta || getCategoryMeta(bill.category, categories || getBillCategories(), bill.type);
      this.setData({
        normalizedBill: {
          ...bill,
          dateText: bill.dateText || formatDate(bill.date),
          amountText: formatMoney(bill.amount),
          categoryMeta,
          iconText: categoryMeta.label ? categoryMeta.label.slice(0, 1) : '账',
        },
      });
    },
  },

  data: {
    normalizedBill: {
      categoryMeta: {
        label: '未分类',
        tone: 'gray',
      },
      iconText: '账',
    },
  },
});

const { formatDate, formatMoney } = require('../../utils/format');
const { getCategoryMeta } = require('../../utils/bill');

Component({
  properties: {
    bill: {
      type: Object,
      value: {},
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
    bill(bill) {
      if (!bill) return;
      const categoryMeta = bill.categoryMeta || getCategoryMeta(bill.category);
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

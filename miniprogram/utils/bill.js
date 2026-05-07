const { BILL_CATEGORIES } = require('./config');
const { formatDate, formatMoney } = require('./format');

const getCategoryMeta = (category) => {
  const found = BILL_CATEGORIES.find((item) => item.value === category);
  return (
    found || {
      label: category || '其他',
      value: category || '其他',
      tone: 'gray',
    }
  );
};

const groupBillsByDate = (list = []) => {
  const groups = [];
  const map = new Map();

  list.forEach((bill) => {
    const key = bill.date || formatDate(new Date());
    if (!map.has(key)) {
      const group = {
        date: key,
        dateText: key,
        totalAmount: 0,
        count: 0,
        bills: [],
      };
      map.set(key, group);
      groups.push(group);
    }

    const group = map.get(key);
    group.count += 1;
    group.totalAmount += Number(bill.amount || 0);
    group.bills.push({
      ...bill,
      amountText: formatMoney(bill.amount),
      categoryMeta: getCategoryMeta(bill.category),
    });
  });

  return groups;
};

const getTypeLabel = (type) => (type === 'income' ? '收入' : '支出');

module.exports = {
  getCategoryMeta,
  groupBillsByDate,
  getTypeLabel,
};

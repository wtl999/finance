const normalizeMonth = (value) => {
  if (!value) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const stringValue = String(value);
  if (/^\d{4}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  return stringValue.slice(0, 7);
};

const normalizeDate = (value) => {
  if (!value) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
};

const normalizeBillInput = (data = {}) => {
  const date = normalizeDate(data.date);

  return {
    type: data.type === 'income' ? 'income' : 'expense',
    amount: Number(data.amount || 0),
    category: data.category || '其他',
    merchant: data.merchant || '',
    remark: data.remark || '',
    date,
    month: normalizeMonth(date),
    source: data.source || 'manual',
    aiParsed: data.aiParsed || null,
  };
};

const summarizeBills = (list = [], today = '') => {
  const summary = {
    totalExpense: 0,
    totalIncome: 0,
    netAmount: 0,
    expenseCount: 0,
    incomeCount: 0,
    totalCount: list.length,
    todayExpense: 0,
    todayCount: 0,
    topCategories: [],
  };

  const categoryMap = new Map();

  list.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    if (bill.type === 'income') {
      summary.totalIncome += amount;
      summary.incomeCount += 1;
    } else {
      summary.totalExpense += amount;
      summary.expenseCount += 1;
    }

    const categoryKey = bill.category || '其他';
    categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + amount);

    if (today && bill.date === today && bill.type !== 'income') {
      summary.todayExpense += amount;
      summary.todayCount += 1;
    }
  });

  summary.netAmount = summary.totalIncome - summary.totalExpense;
  summary.topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return summary;
};

module.exports = {
  normalizeMonth,
  normalizeDate,
  normalizeBillInput,
  summarizeBills,
  ...require('./membership'),
  ...require('./middleware'),
};

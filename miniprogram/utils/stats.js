const { formatDate, formatMonth, formatMoney } = require('./format');
const { getCategoryMeta } = require('./bill');

const pad = (value) => String(value).padStart(2, '0');

const toDate = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getMonthRange = (month) => {
  const [yearStr, monthStr] = String(month || formatMonth(new Date())).split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start, end };
};

const getDateKey = (date) => {
  const d = toDate(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getWeekRangeEnd = (month) => {
  const { end } = getMonthRange(month);
  return end;
};

const getSummary = (bills = []) => {
  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    netAmount: 0,
    incomeCount: 0,
    expenseCount: 0,
    totalCount: bills.length,
  };

  bills.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    if (bill.type === 'income') {
      summary.totalIncome += amount;
      summary.incomeCount += 1;
    } else {
      summary.totalExpense += amount;
      summary.expenseCount += 1;
    }
  });

  summary.netAmount = summary.totalIncome - summary.totalExpense;
  return summary;
};

const getCategoryStats = (bills = []) => {
  const map = new Map();

  bills.forEach((bill) => {
    if (bill.type === 'income') return;
    const key = bill.category || '其他';
    map.set(key, (map.get(key) || 0) + Number(bill.amount || 0));
  });

  const items = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      const meta = getCategoryMeta(name);
      return {
        name: meta.label,
        value: Number(value.toFixed(2)),
        tone: meta.tone,
      };
    });

  const total = items.reduce((sum, item) => sum + item.value, 0);
  return {
    items,
    total,
  };
};

const buildTrendBuckets = (startDate, endDate) => {
  const buckets = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    buckets.push(getDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return buckets;
};

const getTrendSeries = (bills = [], startDate, endDate) => {
  const buckets = buildTrendBuckets(startDate, endDate);
  const expenseMap = new Map(buckets.map((key) => [key, 0]));
  const incomeMap = new Map(buckets.map((key) => [key, 0]));

  bills.forEach((bill) => {
    const key = bill.date || formatDate(new Date());
    const amount = Number(bill.amount || 0);
    if (!expenseMap.has(key)) return;

    if (bill.type === 'income') {
      incomeMap.set(key, incomeMap.get(key) + amount);
    } else {
      expenseMap.set(key, expenseMap.get(key) + amount);
    }
  });

  return {
    xAxis: buckets.map((key) => key.slice(5)),
    expense: buckets.map((key) => Number(expenseMap.get(key).toFixed(2))),
    income: buckets.map((key) => Number(incomeMap.get(key).toFixed(2))),
  };
};

const getMonthlyTrend = (bills = [], month) => {
  const { start, end } = getMonthRange(month);
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(getDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  const expenseMap = new Map(days.map((key) => [key, 0]));
  const incomeMap = new Map(days.map((key) => [key, 0]));

  bills.forEach((bill) => {
    const key = bill.date || formatDate(new Date());
    const amount = Number(bill.amount || 0);
    if (!expenseMap.has(key)) return;

    if (bill.type === 'income') {
      incomeMap.set(key, incomeMap.get(key) + amount);
    } else {
      expenseMap.set(key, expenseMap.get(key) + amount);
    }
  });

  return {
    xAxis: days.map((key) => key.slice(5)),
    expense: days.map((key) => Number(expenseMap.get(key).toFixed(2))),
    income: days.map((key) => Number(incomeMap.get(key).toFixed(2))),
  };
};

const buildInsights = ({ summary, categoryStats, weeklyTrend }) => {
  const topCategory = categoryStats.items[0];
  const lastExpense = weeklyTrend.expense.slice(-1)[0] || 0;
  const prevExpense = weeklyTrend.expense.slice(-2, -1)[0] || 0;
  const delta = lastExpense - prevExpense;
  const trendText = delta > 0 ? '最近支出有上升' : '最近支出较稳定';

  return {
    title: 'AI 消费洞察',
    summaryText: `本月共 ${summary.totalCount} 笔，支出 ¥${formatMoney(summary.totalExpense)}，收入 ¥${formatMoney(summary.totalIncome)}。`,
    adviceText: topCategory
      ? `主要支出集中在「${topCategory.name}」，建议优先关注这个分类。`
      : '本月分类数据较少，建议继续记录更多账单。',
    trendText: trendText,
    tagText: topCategory ? `${topCategory.name} · 占比高` : '暂无明显集中分类',
  };
};

const aggregateStats = (bills = [], month = formatMonth(new Date())) => {
  const summary = getSummary(bills);
  const categoryStats = getCategoryStats(bills);
  const weekEnd = getWeekRangeEnd(month);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  const weeklyTrend = getTrendSeries(bills, weekStart, weekEnd);
  const monthlyTrend = getMonthlyTrend(bills, month);

  return {
    summary,
    categoryStats,
    weeklyTrend,
    monthlyTrend,
    insights: buildInsights({
      summary,
      categoryStats,
      weeklyTrend,
    }),
    summaryCards: [
      {
        label: '本月收入',
        value: `¥${formatMoney(summary.totalIncome)}`,
        desc: `${summary.incomeCount} 笔`,
      },
      {
        label: '本月支出',
        value: `¥${formatMoney(summary.totalExpense)}`,
        desc: `${summary.expenseCount} 笔`,
      },
      {
        label: '净收入',
        value: `¥${formatMoney(summary.netAmount)}`,
        desc: '收入 - 支出',
      },
      {
        label: '账单总数',
        value: `${summary.totalCount}`,
        desc: '本月记录',
      },
    ],
    categoryList: categoryStats.items,
  };
};

module.exports = {
  aggregateStats,
  getSummary,
  getCategoryStats,
  getTrendSeries,
  getMonthlyTrend,
  getMonthRange,
};

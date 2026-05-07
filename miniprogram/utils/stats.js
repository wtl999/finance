const { formatDate, formatMonth, formatMoney } = require('./format');
const { getCategoryMeta, getBillCategories } = require('./category');

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

const getYearRange = (year) => {
  const y = Number(year || new Date().getFullYear());
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  };
};

const getDateKey = (date) => {
  const d = toDate(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildDailyBuckets = (startDate, endDate) => {
  const buckets = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    buckets.push(getDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return buckets;
};

const buildMonthlyBuckets = (year) => Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);

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

const getCategoryStats = (bills = [], categories = null) => {
  const map = new Map();
  const normalizedCategories = categories || getBillCategories();

  bills.forEach((bill) => {
    if (bill.type === 'income') return;
    const key = bill.category || '其他';
    map.set(key, (map.get(key) || 0) + Number(bill.amount || 0));
  });

  const items = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      const meta = getCategoryMeta(name, normalizedCategories, 'expense');
      return {
        name: meta.label,
        value: Number(value.toFixed(2)),
        tone: meta.tone,
      };
    });

  const total = items.reduce((sum, item) => sum + item.value, 0);
  return { items, total };
};

const buildTrendSeries = (bills = [], buckets = [], keyGetter) => {
  const expenseMap = new Map(buckets.map((key) => [key, 0]));
  const incomeMap = new Map(buckets.map((key) => [key, 0]));

  bills.forEach((bill) => {
    const key = keyGetter(bill);
    const amount = Number(bill.amount || 0);
    if (!expenseMap.has(key)) return;

    if (bill.type === 'income') {
      incomeMap.set(key, incomeMap.get(key) + amount);
    } else {
      expenseMap.set(key, expenseMap.get(key) + amount);
    }
  });

  return {
    xAxis: buckets.map((key) => (key.length > 5 ? key.slice(5) : key)),
    expense: buckets.map((key) => Number(expenseMap.get(key).toFixed(2))),
    income: buckets.map((key) => Number(incomeMap.get(key).toFixed(2))),
  };
};

const buildInsights = ({ summary, categoryStats, trend, periodLabel }) => {
  const topCategory = categoryStats.items[0];
  const lastExpense = trend.expense.slice(-1)[0] || 0;
  const prevExpense = trend.expense.slice(-2, -1)[0] || 0;
  const delta = lastExpense - prevExpense;
  const trendText = delta > 0 ? '最近支出有所上升' : '最近支出较为平稳';

  return {
    title: 'AI 消费洞察',
    summaryText: `${periodLabel}共 ${summary.totalCount} 笔，支出 ¥${formatMoney(summary.totalExpense)}，收入 ¥${formatMoney(summary.totalIncome)}。`,
    adviceText: topCategory
      ? `主要支出集中在 ${topCategory.name}，建议优先关注这个分类。`
      : `${periodLabel}分类数据较少，建议继续记录更多账单。`,
    trendText,
    tagText: topCategory ? `${topCategory.name} · 占比高` : '暂无明显集中分类',
  };
};

const aggregateStats = (bills = [], period = {}) => {
  const periodType = period.periodType === 'year' ? 'year' : 'month';
  const summary = getSummary(bills);
  const categoryStats = getCategoryStats(bills, period.categories);

  const periodKey = periodType === 'year' ? String(period.year || new Date().getFullYear()) : period.month || formatMonth(new Date());
  const range = periodType === 'year' ? getYearRange(periodKey) : getMonthRange(periodKey);
  const dailyBuckets = buildDailyBuckets(range.start, range.end);
  const periodBuckets = periodType === 'year' ? buildMonthlyBuckets(periodKey) : dailyBuckets;

  const trend = buildTrendSeries(
    bills,
    dailyBuckets.slice(-7).length >= 7 ? dailyBuckets.slice(-7) : dailyBuckets,
    (bill) => String(bill.date || '').slice(0, 10),
  );

  const periodTrend = buildTrendSeries(
    bills,
    periodBuckets,
    (bill) => (periodType === 'year' ? String(bill.month || '').slice(0, 7) : String(bill.date || '').slice(0, 10)),
  );

  const periodLabel = periodType === 'year' ? `${periodKey}年` : `${periodKey}月`;

  return {
    summary,
    categoryStats,
    trend,
    periodTrend,
    insights: buildInsights({
      summary,
      categoryStats,
      trend: periodType === 'year' ? periodTrend : trend,
      periodLabel,
    }),
    summaryCards: [
      {
        label: `${periodLabel}收入`,
        value: `¥${formatMoney(summary.totalIncome)}`,
        desc: `${summary.incomeCount} 笔`,
      },
      {
        label: `${periodLabel}支出`,
        value: `¥${formatMoney(summary.totalExpense)}`,
        desc: `${summary.expenseCount} 笔`,
      },
      {
        label: '净收支',
        value: `¥${formatMoney(summary.netAmount)}`,
        desc: '收入 - 支出',
      },
      {
        label: '账单总数',
        value: `${summary.totalCount}`,
        desc: periodLabel,
      },
    ],
    categoryList: categoryStats.items,
  };
};

module.exports = {
  aggregateStats,
  getSummary,
  getCategoryStats,
  getMonthRange,
};

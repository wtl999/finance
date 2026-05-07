const { ANALYSIS_CATEGORIES, HFR_KEYWORDS } = require('./constants');

const pad = (value) => String(value).padStart(2, '0');

const toDate = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatDate = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatMonth = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

const formatYear = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}`;
};

const getDateRangeForPeriod = ({ periodType = 'month', month = '', year = '' } = {}) => {
  const now = new Date();

  if (periodType === 'week') {
    const end = new Date(now);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);

    return {
      periodType,
      startDate: formatDate(start),
      endDate: formatDate(end),
      startMonth: formatMonth(start),
      endMonth: formatMonth(end),
      prevStartDate: formatDate(prevStart),
      prevEndDate: formatDate(prevEnd),
      label: `${formatDate(start)} 至 ${formatDate(end)}`,
    };
  }

  if (periodType === 'year') {
    const selectedYear = /^\d{4}$/.test(String(year)) ? String(year) : `${now.getFullYear()}`;
    const start = new Date(Number(selectedYear), 0, 1);
    const end = new Date(Number(selectedYear), 11, 31);
    const prevStart = new Date(Number(selectedYear) - 1, 0, 1);
    const prevEnd = new Date(Number(selectedYear) - 1, 11, 31);

    return {
      periodType: 'year',
      year: selectedYear,
      startDate: formatDate(start),
      endDate: formatDate(end),
      startMonth: formatMonth(start),
      endMonth: formatMonth(end),
      prevStartDate: formatDate(prevStart),
      prevEndDate: formatDate(prevEnd),
      label: `${selectedYear} 年`,
    };
  }

  const selected = /^\d{4}-\d{2}$/.test(String(month)) ? String(month) : formatMonth(now);
  const [yearStr, monthStr] = selected.split('-');
  const yearNumber = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(yearNumber, monthIndex, 1);
  const end = new Date(yearNumber, monthIndex + 1, 0);
  const prevStart = new Date(yearNumber, monthIndex - 1, 1);
  const prevEnd = new Date(yearNumber, monthIndex, 0);

  return {
    periodType: 'month',
    month: selected,
    year: String(yearNumber),
    startDate: formatDate(start),
    endDate: formatDate(end),
    startMonth: formatMonth(start),
    endMonth: formatMonth(end),
    prevStartDate: formatDate(prevStart),
    prevEndDate: formatDate(prevEnd),
    label: `${selected} 月`,
  };
};

const getRangeMonths = (range) => {
  const months = new Set();
  if (range.startMonth) months.add(range.startMonth);
  if (range.endMonth) months.add(range.endMonth);
  if (range.periodType === 'month' && range.month) months.add(range.month);
  if (range.periodType === 'year' && range.year) {
    for (let i = 1; i <= 12; i += 1) {
      months.add(`${range.year}-${pad(i)}`);
    }
  }
  return [...months];
};

const isExpense = (bill) => bill && bill.type !== 'income';

const getSummary = (bills = []) => {
  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    netAmount: 0,
    incomeCount: 0,
    expenseCount: 0,
    billCount: bills.length,
    avgBillAmount: 0,
    avgDailyExpense: 0,
    maxExpense: 0,
  };

  bills.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    if (bill.type === 'income') {
      summary.totalIncome += amount;
      summary.incomeCount += 1;
    } else {
      summary.totalExpense += amount;
      summary.expenseCount += 1;
      summary.maxExpense = Math.max(summary.maxExpense, amount);
    }
  });

  const totalAmount = summary.totalIncome + summary.totalExpense;
  summary.netAmount = summary.totalIncome - summary.totalExpense;
  summary.avgBillAmount = summary.billCount > 0 ? totalAmount / summary.billCount : 0;
  summary.avgDailyExpense = summary.totalExpense / Math.max(1, new Set(bills.map((bill) => bill.date)).size);

  return summary;
};

const buildDailyBuckets = (startDate, endDate) => {
  const buckets = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    buckets.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return buckets;
};

const buildMonthlyBuckets = (year) => {
  return Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);
};

const buildTrendSeries = (bills = [], startDate, endDate, periodType = 'month') => {
  const buckets = periodType === 'year' ? buildMonthlyBuckets(String(startDate).slice(0, 4)) : buildDailyBuckets(startDate, endDate);
  const expenseMap = new Map(buckets.map((key) => [key, 0]));
  const incomeMap = new Map(buckets.map((key) => [key, 0]));

  bills.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    const key = periodType === 'year' ? String(bill.month || '').slice(0, 7) : String(bill.date || '').slice(0, 10);
    if (!expenseMap.has(key)) return;

    if (bill.type === 'income') {
      incomeMap.set(key, incomeMap.get(key) + amount);
    } else {
      expenseMap.set(key, expenseMap.get(key) + amount);
    }
  });

  return {
    xAxis: periodType === 'year' ? buckets.map((key) => key.slice(5)) : buckets.map((key) => key.slice(5)),
    dates: buckets,
    expense: buckets.map((key) => Number(expenseMap.get(key).toFixed(2))),
    income: buckets.map((key) => Number(incomeMap.get(key).toFixed(2))),
  };
};

const getCategoryLabel = (category) => {
  const found = ANALYSIS_CATEGORIES.find((item) => item === category);
  return found || '其他';
};

const buildCategoryTotals = (bills = []) => {
  const map = new Map();

  bills.forEach((bill) => {
    if (!isExpense(bill)) return;
    const key = getCategoryLabel(bill.category || '其他');
    map.set(key, (map.get(key) || 0) + Number(bill.amount || 0));
  });

  const items = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return {
    items,
    total: Number(total.toFixed(2)),
  };
};

const buildCategoryChanges = (currentBills = [], previousBills = []) => {
  const current = buildCategoryTotals(currentBills).items;
  const previous = buildCategoryTotals(previousBills).items;
  const previousMap = new Map(previous.map((item) => [item.name, item.value]));

  const items = current
    .map((item) => {
      const prevValue = previousMap.get(item.name) || 0;
      const delta = item.value - prevValue;
      const changeRate = prevValue > 0 ? delta / prevValue : item.value > 0 ? 1 : 0;

      return {
        category: item.name,
        current: item.value,
        previous: Number(prevValue.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        changeRate: Number(changeRate.toFixed(2)),
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  return items;
};

const buildHighFrequency = (bills = []) => {
  const map = new Map();

  bills.forEach((bill) => {
    const text = `${bill.category || ''} ${bill.merchant || ''} ${bill.remark || ''}`.toLowerCase();
    HFR_KEYWORDS.forEach((rule) => {
      if (rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
        const existing = map.get(rule.label) || {
          label: rule.label,
          count: 0,
          amount: 0,
        };

        existing.count += 1;
        existing.amount += Number(bill.amount || 0);
        map.set(rule.label, existing);
      }
    });
  });

  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      amount: Number(item.amount.toFixed(2)),
    }));
};

const buildAnomalies = (bills = [], summary = {}) => {
  const threshold = Math.max(99, summary.avgBillAmount * 3, summary.avgDailyExpense * 1.8);
  return bills
    .filter((bill) => isExpense(bill) && Number(bill.amount || 0) >= threshold)
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)
    .map((bill) => ({
      date: bill.date,
      amount: Number(Number(bill.amount || 0).toFixed(2)),
      merchant: bill.merchant || '',
      category: bill.category || '其他',
      reason: `单笔金额 ${Number(bill.amount || 0).toFixed(2)} 元，高于常规阈值 ${threshold.toFixed(2)} 元。`,
    }));
};

const buildBudgetForecast = ({ summary = {}, range = {}, currentBills = [] }) => {
  const currentDayCount = Math.max(1, buildDailyBuckets(range.startDate, range.endDate).length);
  const monthDays = range.periodType === 'year' ? 365 : new Date(Number(range.endDate.slice(0, 4)), Number(range.endDate.slice(5, 7)), 0).getDate();
  const dailyAvgExpense = summary.totalExpense / currentDayCount;
  const forecastExpense = Number((dailyAvgExpense * monthDays).toFixed(2));
  const pressureRate = forecastExpense > 0 ? forecastExpense / Math.max(1, summary.totalExpense) : 0;

  let pressure = 'low';
  if (pressureRate >= 1.3) pressure = 'high';
  else if (pressureRate >= 1.05) pressure = 'medium';

  const sampleCategories = buildCategoryTotals(currentBills).items.slice(0, 3).map((item) => item.name).join('、');

  return {
    forecastExpense,
    dailyAvgExpense: Number(dailyAvgExpense.toFixed(2)),
    pressure,
    confidence: range.periodType === 'month' ? 0.82 : range.periodType === 'year' ? 0.74 : 0.64,
    suggestion:
      pressure === 'high'
        ? '当前消费节奏偏快，建议优先压低高频小额支出。'
        : '按当前节奏看，本期预算压力可控。',
    referenceCategories: sampleCategories,
  };
};

const buildAnalysisSeed = ({ currentBills = [], previousBills = [], range = {} }) => {
  const summary = getSummary(currentBills);
  const dayCount = buildDailyBuckets(range.startDate, range.endDate).length;
  summary.avgDailyExpense = summary.totalExpense / Math.max(1, dayCount);
  const trend = buildTrendSeries(currentBills, range.startDate, range.endDate, range.periodType);
  const previousTrend = buildTrendSeries(previousBills, range.prevStartDate, range.prevEndDate, range.periodType);
  const categoryTotals = buildCategoryTotals(currentBills);
  const categoryChanges = buildCategoryChanges(currentBills, previousBills);
  const highFrequency = buildHighFrequency(currentBills);
  const anomalies = buildAnomalies(currentBills, summary);
  const budgetForecast = buildBudgetForecast({
    summary,
    range,
    currentBills,
  });

  return {
    range,
    summary,
    trend,
    previousTrend,
    categoryTotals,
    categoryChanges,
    highFrequency,
    anomalies,
    budgetForecast,
    currentBillCount: currentBills.length,
    previousBillCount: previousBills.length,
  };
};

const buildPromptSeed = (seed) => ({
  range: seed.range,
  summary: seed.summary,
  trend: {
    xAxis: seed.trend.xAxis,
    expense: seed.trend.expense,
    income: seed.trend.income,
  },
  categoryTotals: seed.categoryTotals,
  categoryChanges: seed.categoryChanges,
  anomalies: seed.anomalies,
  highFrequency: seed.highFrequency,
  budgetForecast: seed.budgetForecast,
});

module.exports = {
  buildAnalysisSeed,
  buildPromptSeed,
  getDateRangeForPeriod,
  getRangeMonths,
};

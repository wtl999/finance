const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const command = db.command;
const getOpenId = () => cloud.getWXContext().OPENID;

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

const normalizeYear = (value) => {
  if (!value) {
    return String(new Date().getFullYear());
  }

  const stringValue = String(value);
  if (/^\d{4}$/.test(stringValue)) {
    return stringValue;
  }

  return stringValue.slice(0, 4);
};

const ensureBillsCollection = async () => {
  try {
    await db.createCollection('bills');
  } catch (error) {
    const errMsg = String(error?.errMsg || error?.message || error || '');
    if (/resourceexist|already exists|table exist|collection already exists|exist/i.test(errMsg)) {
      return;
    }
    throw error;
  }
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

const buildAdvice = (summary, label) => {
  if ((summary.totalExpense || 0) > (summary.totalIncome || 0)) {
    return `${label}支出高于收入，优先控制高频小额消费。`;
  }

  if ((summary.totalCount || 0) < 5) {
    return `${label}记录较少，建议继续保持手动记账习惯。`;
  }

  return `${label}现金流健康，可以继续观察分类占比。`;
};

const buildWhere = (filters = {}) => {
  const clauses = [{ openid: getOpenId() }];
  let periodType = 'month';

  if (filters.year) {
    const year = normalizeYear(filters.year);
    periodType = 'year';
    clauses.push({ date: command.gte(`${year}-01-01`) });
    clauses.push({ date: command.lte(`${year}-12-31`) });
  } else {
    clauses.push({ month: normalizeMonth(filters.month || normalizeDate(new Date()).slice(0, 7)) });
  }

  return {
    periodType,
    where: clauses.length === 1 ? clauses[0] : command.and(...clauses),
    year: filters.year ? normalizeYear(filters.year) : '',
    month: filters.month ? normalizeMonth(filters.month) : '',
  };
};

const generate = async (data = {}) => {
  await ensureBillsCollection();
  const period = buildWhere(data);
  const result = await db.collection('bills').where(period.where).get();

  const today = normalizeDate(new Date());
  const summary = summarizeBills(result.data || [], today);
  const topNames = summary.topCategories.map((item) => item.name).join('、') || '暂无';
  const label = period.periodType === 'year' ? `${period.year}年` : `${period.month}月`;

  return {
    success: true,
    data: {
      periodType: period.periodType,
      year: period.year,
      month: period.month,
      summaryText: `${label}共 ${summary.totalCount} 笔，支出 ¥${summary.totalExpense.toFixed(2)}，收入 ¥${summary.totalIncome.toFixed(2)}。`,
      adviceText: buildAdvice(summary, label),
      tagsText: topNames,
      detail: summary,
      prompt: data.prompt || '',
    },
  };
};

exports.main = async (event) => {
  const action = event.action || 'generate';
  const data = event.data || {};

  if (action === 'generate') return generate(data);

  return {
    success: false,
    message: 'unknown action',
  };
};

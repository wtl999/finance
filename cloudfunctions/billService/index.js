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

const normalizeBillInput = (data = {}) => {
  const date = normalizeDate(data.date);
  const year = normalizeYear(date);

  return {
    type: data.type === 'income' ? 'income' : 'expense',
    amount: Number(data.amount || 0),
    category: data.category || '其他',
    merchant: data.merchant || '',
    remark: data.remark || '',
    date,
    month: normalizeMonth(date),
    year,
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

const buildWhere = (filters = {}) => {
  const clauses = [{ openid: getOpenId() }];

  if (filters.year) {
    const year = normalizeYear(filters.year);
    clauses.push({ date: command.gte(`${year}-01-01`) });
    clauses.push({ date: command.lte(`${year}-12-31`) });
  } else if (filters.month) {
    clauses.push({ month: normalizeMonth(filters.month) });
  }

  if (filters.type && filters.type !== 'all') {
    clauses.push({ type: filters.type });
  }

  if (filters.date) {
    clauses.push({ date: normalizeDate(filters.date) });
  }

  return clauses.length === 1 ? clauses[0] : command.and(...clauses);
};

const buildListQuery = (filters = {}) => {
  const pageSize = Number(filters.pageSize || filters.limit || 20);
  const page = Number(filters.page || 1);
  const skip = Math.max(page - 1, 0) * pageSize;

  return {
    page,
    pageSize,
    skip,
    usePagination: !filters.limit,
  };
};

const createBill = async (data = {}) => {
  await ensureBillsCollection();
  const payload = normalizeBillInput(data);
  const now = db.serverDate();

  const result = await db.collection('bills').add({
    data: {
      ...payload,
      openid: getOpenId(),
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    success: true,
    data: {
      _id: result._id,
      ...payload,
    },
  };
};

const listBills = async (filters = {}) => {
  await ensureBillsCollection();
  const where = buildWhere(filters);
  const { page, pageSize, skip, usePagination } = buildListQuery(filters);
  const collection = db.collection('bills').where(where).orderBy('date', 'desc').orderBy('createdAt', 'desc');
  const totalResult = await collection.count();
  const query = usePagination ? collection.skip(skip).limit(pageSize) : collection.limit(Number(filters.limit || pageSize));
  const result = await query.get();

  return {
    success: true,
    data: {
      list: result.data || [],
      total: totalResult.total,
      page,
      pageSize,
      hasMore: usePagination ? page * pageSize < totalResult.total : false,
    },
  };
};

const updateBill = async (data = {}) => {
  await ensureBillsCollection();
  if (!data._id) {
    return { success: false, message: 'missing _id' };
  }

  const payload = normalizeBillInput(data);
  const now = db.serverDate();

  await db
    .collection('bills')
    .where({
      _id: data._id,
      openid: getOpenId(),
    })
    .update({
      data: {
        ...payload,
        updatedAt: now,
      },
    });

  return {
    success: true,
    data: {
      _id: data._id,
      ...payload,
    },
  };
};

const deleteBill = async (data = {}) => {
  await ensureBillsCollection();
  if (!data._id) {
    return { success: false, message: 'missing _id' };
  }

  await db
    .collection('bills')
    .where({
      _id: data._id,
      openid: getOpenId(),
    })
    .remove();

  return {
    success: true,
  };
};

const summaryBills = async (filters = {}) => {
  await ensureBillsCollection();
  const where = buildWhere(filters);
  const result = await db.collection('bills').where(where).get();
  const today = normalizeDate(new Date());
  const summary = summarizeBills(result.data || [], today);

  return {
    success: true,
    data: {
      periodType: filters.year ? 'year' : 'month',
      year: filters.year ? normalizeYear(filters.year) : '',
      month: filters.month ? normalizeMonth(filters.month) : '',
      ...summary,
    },
  };
};

exports.main = async (event) => {
  const action = event.action || 'list';
  const data = event.data || {};

  if (action === 'create') return createBill(data);
  if (action === 'list') return listBills(data);
  if (action === 'update') return updateBill(data);
  if (action === 'delete') return deleteBill(data);
  if (action === 'summary') return summaryBills(data);

  return {
    success: false,
    message: 'unknown action',
  };
};

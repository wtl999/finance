const cloud = require('wx-server-sdk');
const { normalizeBillInput, normalizeDate, summarizeBills } = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const getOpenId = () => cloud.getWXContext().OPENID;

const buildWhere = (filters = {}) => {
  const where = { openid: getOpenId() };

  if (filters.month) where.month = filters.month;
  if (filters.type && filters.type !== 'all') where.type = filters.type;
  if (filters.date) where.date = filters.date;

  return where;
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
  const where = buildWhere(filters);
  const { page, pageSize, skip, usePagination } = buildListQuery(filters);
  const collection = db.collection('bills').where(where).orderBy('date', 'desc').orderBy('createdAt', 'desc');
  const totalResult = await collection.count();
  const query = usePagination
    ? collection.skip(skip).limit(pageSize)
    : collection.limit(Number(filters.limit || pageSize));
  const result = await query
    .get();

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
  if (!data._id) {
    return { success: false, message: 'missing _id' };
  }

  const payload = normalizeBillInput(data);
  const now = db.serverDate();

  await db.collection('bills').where({
    _id: data._id,
    openid: getOpenId(),
  }).update({
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
  if (!data._id) {
    return { success: false, message: 'missing _id' };
  }

  await db.collection('bills').where({
    _id: data._id,
    openid: getOpenId(),
  }).remove();

  return {
    success: true,
  };
};

const summaryBills = async (filters = {}) => {
  const month = filters.month || normalizeDate(new Date()).slice(0, 7);
  const result = await db.collection('bills').where({
    openid: getOpenId(),
    month,
  }).get();

  const today = normalizeDate(new Date());
  const summary = summarizeBills(result.data || [], today);

  return {
    success: true,
    data: {
      month,
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

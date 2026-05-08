const { requestApi } = require('./http');

const createBill = (data) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'create', data },
  });

const listBills = (query = {}) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'list', data: query },
  });

const updateBill = (data) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'update', data },
  });

const deleteBill = (_id) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'delete', data: { _id } },
  });

const getBillSummary = (query = {}) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'summary', data: query },
  });

const getBillPage = (query = {}) =>
  requestApi({
    path: '/api/functions/billService',
    data: { action: 'list', data: query },
  });

module.exports = {
  createBill,
  listBills,
  getBillPage,
  updateBill,
  deleteBill,
  getBillSummary,
};

const { callFunction } = require('./cloud');
const { CLOUD_FUNCTIONS } = require('../utils/config');

const createBill = (data) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'create',
    data,
  });

const listBills = (query = {}) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'list',
    data: query,
  });

const updateBill = (data) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'update',
    data,
  });

const deleteBill = (_id) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'delete',
    data: { _id },
  });

const getBillSummary = (query = {}) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'summary',
    data: query,
  });

const getBillPage = (query = {}) =>
  callFunction(CLOUD_FUNCTIONS.BILL_SERVICE, {
    action: 'list',
    data: query,
  });

module.exports = {
  createBill,
  listBills,
  getBillPage,
  updateBill,
  deleteBill,
  getBillSummary,
};

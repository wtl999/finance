const { callFunction } = require('./cloud');
const { CLOUD_FUNCTIONS } = require('../utils/config');

const generateMonthlyReport = (query = {}) =>
  callFunction(CLOUD_FUNCTIONS.REPORT_SERVICE, {
    action: 'generate',
    data: query,
  });

module.exports = {
  generateMonthlyReport,
};

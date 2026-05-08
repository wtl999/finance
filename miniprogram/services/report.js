const { requestApi } = require('./http');

const generateMonthlyReport = (query = {}) =>
  requestApi({
    path: '/api/functions/reportService',
    data: { action: 'generate', data: query },
  });

module.exports = {
  generateMonthlyReport,
};

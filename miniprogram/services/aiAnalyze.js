const { requestApi } = require('./http');

const analyzeBills = (data = {}) =>
  requestApi({
    path: '/api/functions/aiAnalyze',
    data: { action: 'analyze', data },
  });

module.exports = {
  analyzeBills,
};

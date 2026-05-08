const { requestApi } = require('./http');

const classifyBillText = (data = {}) =>
  requestApi({
    path: '/api/functions/aiClassify',
    data: { action: 'classify', data },
  });

module.exports = {
  classifyBillText,
};

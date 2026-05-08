const { requestApi } = require('./http');

const parseBillText = (data = {}) =>
  requestApi({
    path: '/api/functions/deepseekParse',
    data: { action: 'parse', data },
  });

module.exports = {
  parseBillText,
};

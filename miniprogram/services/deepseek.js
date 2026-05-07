const { callFunction } = require('./cloud');
const { CLOUD_FUNCTIONS } = require('../utils/config');

const parseBillText = (data = {}) =>
  callFunction(CLOUD_FUNCTIONS.DEEPSEEK_BILL_PARSE, {
    action: 'parse',
    data,
  });

module.exports = {
  parseBillText,
};

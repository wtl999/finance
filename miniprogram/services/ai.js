const { callFunction } = require('./cloud');
const { CLOUD_FUNCTIONS } = require('../utils/config');

const classifyBillText = (data = {}) =>
  callFunction(CLOUD_FUNCTIONS.AI_CLASSIFY, {
    action: 'classify',
    data,
  });

module.exports = {
  classifyBillText,
};

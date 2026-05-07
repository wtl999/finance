const { callFunction } = require('./cloud');
const { CLOUD_FUNCTIONS } = require('../utils/config');

const analyzeBills = (data = {}) =>
  callFunction(CLOUD_FUNCTIONS.AI_ANALYZE, {
    action: 'analyze',
    data,
  });

module.exports = {
  analyzeBills,
};

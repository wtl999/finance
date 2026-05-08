const { requestApi, getBaseUrl } = require('./http');

const callFunction = (name, data = {}) => {
  const baseUrl = getBaseUrl();
  if (baseUrl) {
    return requestApi({
      path: `/api/functions/${name}`,
      data,
    });
  }

  return Promise.reject(new Error('API base url is not configured'));
};

module.exports = {
  callFunction,
};

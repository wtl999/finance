const callFunction = (name, data = {}) => {
  if (!wx.cloud) {
    return Promise.reject(new Error('wx.cloud is unavailable'));
  }

  return wx.cloud.callFunction({ name, data }).then((response) => response.result || {});
};

module.exports = {
  callFunction,
};

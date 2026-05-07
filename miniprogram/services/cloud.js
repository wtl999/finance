const callFunction = (name, data = {}) => {
  if (!wx.cloud) {
    return Promise.reject(new Error('wx.cloud is unavailable'));
  }

  return wx.cloud.callFunction({ name, data })
    .then((response) => {
      console.log('[cloud.callFunction] raw response', { name, response });
      if (!response || typeof response.result === 'undefined') {
        console.warn('[cloud.callFunction] empty result', { name, response });
      }
      return response.result || {};
    })
    .catch((error) => {
      console.error('[cloud.callFunction] failed', { name, data, error });
      throw error;
    });
};

module.exports = {
  callFunction,
};

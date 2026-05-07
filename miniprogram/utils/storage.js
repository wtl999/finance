const get = (key, fallback = null) => {
  try {
    const value = wx.getStorageSync(key);
    return value === '' || typeof value === 'undefined' ? fallback : value;
  } catch (error) {
    return fallback;
  }
};

const set = (key, value) => {
  wx.setStorageSync(key, value);
};

const remove = (key) => {
  wx.removeStorageSync(key);
};

const clear = () => {
  wx.clearStorageSync();
};

module.exports = {
  get,
  set,
  remove,
  clear,
};

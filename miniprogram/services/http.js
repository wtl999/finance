const storage = require('../utils/storage');
const { STORAGE_KEYS, API_BASE_URL } = require('../utils/config');

const getBaseUrl = () => {
  try {
    const fromStorage = String(storage.get(STORAGE_KEYS.API_BASE_URL, '') || '').trim();
    if (fromStorage) return fromStorage.replace(/\/+$/, '');
  } catch (error) {
    void error;
  }

  return String(API_BASE_URL || '').trim().replace(/\/+$/, '');
};

const getAuthHeaders = () => {
  const token = String(storage.get(STORAGE_KEYS.AUTH_TOKEN, '') || '').trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const requestJson = ({ url, method = 'POST', data = {}, header = {}, timeout = 30000 } = {}) =>
  new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout,
      header: {
        'content-type': 'application/json',
        ...getAuthHeaders(),
        ...header,
      },
      success: resolve,
      fail: reject,
    });
  });

const requestApi = async ({ path, method = 'POST', data = {}, header = {}, timeout = 30000 } = {}) => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('API base url is not configured');
  }

  const response = await requestJson({
    url: `${baseUrl}${path}`,
    method,
    data,
    header,
    timeout,
  });

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.data || {};
  }

  const error = new Error((response.data && response.data.message) || `Request failed: ${response.statusCode}`);
  error.response = response;
  throw error;
};

const uploadApiFile = ({ path, filePath, name = 'file', formData = {}, header = {}, timeout = 600000 } = {}) =>
  new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      reject(new Error('API base url is not configured'));
      return;
    }

    wx.uploadFile({
      url: `${baseUrl}${path}`,
      filePath,
      name,
      formData,
      timeout,
      header: {
        ...getAuthHeaders(),
        ...header,
      },
      success: (response) => {
        try {
          const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data || {});
            return;
          }
          const error = new Error((data && data.message) || `Upload failed: ${response.statusCode}`);
          error.response = response;
          reject(error);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject,
    });
  });

module.exports = {
  getBaseUrl,
  requestApi,
  uploadApiFile,
};

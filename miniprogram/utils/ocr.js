const { OCR_SOURCES } = require('./config');

const getOcrSourceMeta = (value = 'wechat') =>
  OCR_SOURCES.find((item) => item.value === value) || OCR_SOURCES[0];

const getFileExtension = (filePath = '') => {
  const match = String(filePath).match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : '';
  return ext || 'jpg';
};

const buildUploadCloudPath = ({ source = 'wechat', fileHash = '', filePath = '' }) => {
  const ext = getFileExtension(filePath);
  const safeHash = String(fileHash || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
  return `ocr/${source}/${safeHash}.${ext}`;
};

const buildOcrCacheKey = ({ source = 'wechat', fileHash = '' }) => `${source}:${fileHash}`;

const normalizeSource = (source = '') => {
  const meta = getOcrSourceMeta(source);
  return meta.value;
};

module.exports = {
  getOcrSourceMeta,
  getFileExtension,
  buildUploadCloudPath,
  buildOcrCacheKey,
  normalizeSource,
};

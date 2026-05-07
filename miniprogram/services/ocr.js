const { callFunction } = require('./cloud');
const billService = require('./bill');
const { CLOUD_FUNCTIONS } = require('../utils/config');
const {
  buildOcrCacheKey,
  buildUploadCloudPath,
  normalizeSource,
} = require('../utils/ocr');

const getFileInfo = (filePath) =>
  new Promise((resolve, reject) => {
    wx.getFileInfo({
      filePath,
      digestAlgorithm: 'md5',
      success: resolve,
      fail: reject,
    });
  });

const uploadScreenshot = ({ filePath, source }) =>
  wx.cloud.uploadFile({
    cloudPath: buildUploadCloudPath({
      source,
      fileHash: '',
      filePath,
    }),
    filePath,
  });

const recognizeScreenshot = async ({ fileID, fileHash, source, fileName = '' }) => {
  return callFunction(CLOUD_FUNCTIONS.OCR, {
    action: 'recognize',
    data: {
      fileID,
      fileHash,
      source: normalizeSource(source),
      fileName,
    },
  });
};

const saveBillFromOcr = async (ocrResult) => {
  if (!ocrResult || !ocrResult.parsedBill) {
    return {
      success: false,
      message: 'empty ocr result',
    };
  }

  return billService.createBill({
    ...ocrResult.parsedBill,
    source: 'ocr',
    aiParsed: ocrResult,
  });
};

const uploadRecognizeAndSave = async ({ filePath, source = 'wechat' }) => {
  const normalizedSource = normalizeSource(source);
  const fileInfo = await getFileInfo(filePath);
  const fileHash = fileInfo.digest || fileInfo.md5 || '';
  const uploadRes = await wx.cloud.uploadFile({
    cloudPath: buildUploadCloudPath({
      source: normalizedSource,
      fileHash,
      filePath,
    }),
    filePath,
  });

  const ocrRes = await recognizeScreenshot({
    fileID: uploadRes.fileID,
    fileHash,
    source: normalizedSource,
    fileName: filePath.split(/[\\/]/).pop() || '',
  });

  if (!ocrRes.success) {
    return ocrRes;
  }

  const billRes = await saveBillFromOcr(ocrRes.data);

  return {
    success: Boolean(billRes.success),
    data: {
      upload: uploadRes,
      ocr: ocrRes.data,
      bill: billRes.data || null,
      cacheKey: buildOcrCacheKey({
        source: normalizedSource,
        fileHash,
      }),
    },
  };
};

module.exports = {
  getFileInfo,
  uploadScreenshot,
  recognizeScreenshot,
  saveBillFromOcr,
  uploadRecognizeAndSave,
};

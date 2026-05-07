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

  const parsedBill = ocrResult.parsedBill;
  if (!parsedBill.amount || !parsedBill.date) {
    return {
      success: false,
      message: 'invalid parsed bill',
      data: parsedBill,
    };
  }

  return billService.createBill({
    ...parsedBill,
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
    console.error('[OCR] recognize failed', {
      filePath,
      source: normalizedSource,
      response: ocrRes,
    });
    return {
      ...ocrRes,
      message: ocrRes.message || ocrRes.detail || 'recognize failed',
    };
  }

  const billRes = await saveBillFromOcr(ocrRes.data);

  if (!billRes.success) {
    console.error('[OCR] save bill failed', {
      filePath,
      source: normalizedSource,
      ocr: ocrRes.data,
      response: billRes,
    });
    return {
      success: false,
      message: billRes.message || 'save bill failed',
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
  }

  return {
    success: true,
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

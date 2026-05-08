const { uploadApiFile } = require('./http');
const billService = require('./bill');
const {
  buildOcrCacheKey,
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
  // OCR 请求统一走 Node API，避免前端再依赖云函数能力。
  const uploadRes = await uploadApiFile({
    path: '/api/ocr/recognize',
    filePath,
    name: 'file',
    formData: {
      source: normalizedSource,
      fileHash,
      fileName: filePath.split(/[\\/]/).pop() || '',
    },
  });

  const ocrRes = uploadRes;

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
        upload: {
          filePath,
          fileHash,
          source: normalizedSource,
          fileName: filePath.split(/[\\/]/).pop() || '',
        },
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
      upload: {
        filePath,
        fileHash,
        source: normalizedSource,
        fileName: filePath.split(/[\\/]/).pop() || '',
      },
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
  saveBillFromOcr,
  uploadRecognizeAndSave,
};

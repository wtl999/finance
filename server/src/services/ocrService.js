// OCR service: one singleton worker parses receipt images into structured bills.
const { createWorker } = require('tesseract.js');
const { parseBillText } = require('./aiService');

let sharedWorker = null;
let sharedWorkerInit = null;

const getWorker = async () => {
  if (sharedWorker) return sharedWorker;
  if (!sharedWorkerInit) {
    sharedWorkerInit = (async () => createWorker('chi_sim', 1, { logger: () => null }))();
  }

  sharedWorker = await sharedWorkerInit;
  return sharedWorker;
};

const recognizeImage = async (filePath, source = 'wechat') => {
  const worker = await getWorker();
  const { data } = await worker.recognize(filePath);
  const rawText = String(data?.text || '').trim();
  const parsedBill = parseBillText(rawText, source);

  return {
    source,
    cacheHit: false,
    cacheKey: `${source}:${filePath.split(/[\\/]/).pop() || ''}`,
    fileName: filePath.split(/[\\/]/).pop() || '',
    rawText,
    textLines: rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    parsedBill,
    confidence: parsedBill.amount > 0 ? 0.85 : 0.4,
    provider: 'tesseract',
    model: 'tesseract.js',
    ocrError: '',
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    aiResult: null,
  };
};

module.exports = {
  recognizeImage,
};

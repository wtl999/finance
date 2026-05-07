const { BILL_PARSE_CATEGORIES, DEFAULT_CURRENCY } = require('./constants');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/;

const normalizeString = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Number(amount.toFixed(2));
};

const normalizeCategory = (value) => {
  const category = normalizeString(value, '其他');
  return BILL_PARSE_CATEGORIES.includes(category) ? category : '其他';
};

const normalizeType = (value) => (value === 'income' ? 'income' : 'expense');

const normalizeConfidence = (value) => {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0.5;
  if (confidence < 0) return 0;
  if (confidence > 1) return 1;
  return Number(confidence.toFixed(2));
};

const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const normalizeDate = (value, fallback = '') => {
  const stringValue = normalizeString(value, '');
  if (DATE_RE.test(stringValue)) return stringValue;
  if (DATETIME_RE.test(stringValue)) return stringValue.slice(0, 10);
  return fallback;
};

const normalizeTime = (value, fallback = '') => {
  const stringValue = normalizeString(value, '');
  if (DATETIME_RE.test(stringValue)) return stringValue.length > 16 ? stringValue.slice(0, 16) : stringValue;
  if (DATE_RE.test(stringValue)) return `${stringValue} 00:00`;
  return fallback;
};

const safeJsonParse = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  const text = String(value).trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
};

const validateParsedBill = (payload = {}, fallback = {}) => {
  const fallbackTime = normalizeTime(fallback.time || fallback.date || '', '');
  const fallbackDate = normalizeDate(fallback.date || fallbackTime || '', '');

  const time = normalizeTime(payload.time || payload.date, fallbackTime);
  const date = normalizeDate(payload.date || time, fallbackDate);

  const bill = {
    amount: normalizeAmount(payload.amount ?? fallback.amount),
    merchant: normalizeString(payload.merchant, fallback.merchant || ''),
    category: normalizeCategory(payload.category || fallback.category),
    time: time || (date ? `${date} 00:00` : ''),
    date: date || (time ? time.slice(0, 10) : ''),
    type: normalizeType(payload.type || fallback.type),
    currency: normalizeString(payload.currency, DEFAULT_CURRENCY) || DEFAULT_CURRENCY,
    confidence: normalizeConfidence(payload.confidence ?? fallback.confidence),
    evidence: payload.evidence && typeof payload.evidence === 'object' ? payload.evidence : {},
    notes: normalizeString(payload.notes, ''),
  };

  if (!bill.date && bill.time) {
    bill.date = bill.time.slice(0, 10);
  }

  return {
    ok: bill.amount > 0 && DATE_RE.test(bill.date),
    bill,
  };
};

const buildNowFallback = () => {
  const now = new Date();
  return {
    time: formatDateTime(now),
    date: formatDateTime(now).slice(0, 10),
  };
};

module.exports = {
  buildNowFallback,
  normalizeAmount,
  normalizeCategory,
  normalizeConfidence,
  normalizeDate,
  normalizeString,
  normalizeTime,
  safeJsonParse,
  validateParsedBill,
};

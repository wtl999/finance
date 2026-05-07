const pad = (value) => String(value).padStart(2, '0');

const toDate = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatDate = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatMonth = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

const formatYear = (value) => {
  const date = toDate(value);
  return `${date.getFullYear()}`;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return amount.toFixed(2);
};

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

module.exports = {
  formatDate,
  formatMonth,
  formatYear,
  formatDateTime,
  formatMoney,
  safeNumber,
};

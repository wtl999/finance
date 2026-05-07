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

const normalizeRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Number(rate.toFixed(2));
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

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeAnalysis = (payload = {}, fallback = {}) => {
  const periodType = payload.periodType === 'week' ? 'week' : 'month';
  const fallbackUi = fallback.ui || {};

  return {
    periodType,
    headline: normalizeString(payload.headline, fallbackUi.badge || '消费分析'),
    overview: normalizeString(payload.overview, ''),
    trend: {
      direction:
        payload.trend && ['up', 'down', 'flat'].includes(payload.trend.direction)
          ? payload.trend.direction
          : 'flat',
      title: normalizeString(payload.trend?.title, '消费趋势'),
      detail: normalizeString(payload.trend?.detail, fallback.trend?.detail || ''),
      keyPoint: normalizeString(payload.trend?.keyPoint, ''),
    },
    anomalies: normalizeArray(payload.anomalies).slice(0, 5).map((item) => ({
      date: normalizeString(item?.date, ''),
      amount: normalizeAmount(item?.amount),
      merchant: normalizeString(item?.merchant, ''),
      category: normalizeString(item?.category, '其他'),
      reason: normalizeString(item?.reason, ''),
      severity: ['low', 'medium', 'high'].includes(item?.severity) ? item.severity : 'medium',
    })),
    categoryChanges: normalizeArray(payload.categoryChanges).slice(0, 5).map((item) => ({
      category: normalizeString(item?.category, '其他'),
      current: normalizeAmount(item?.current),
      previous: normalizeAmount(item?.previous),
      delta: Number(normalizeAmount(item?.delta).toFixed(2)),
      changeRate: normalizeRate(item?.changeRate),
      direction:
        item?.direction === 'up' || item?.direction === 'down' || item?.direction === 'flat'
          ? item.direction
          : 'flat',
    })),
    budgetForecast: {
      forecastExpense: normalizeAmount(payload.budgetForecast?.forecastExpense ?? fallback.budgetForecast?.forecastExpense),
      pressure: ['low', 'medium', 'high'].includes(payload.budgetForecast?.pressure)
        ? payload.budgetForecast.pressure
        : fallback.budgetForecast?.pressure || 'low',
      confidence: normalizeRate(payload.budgetForecast?.confidence ?? fallback.budgetForecast?.confidence),
      suggestion: normalizeString(payload.budgetForecast?.suggestion, ''),
      referenceCategories: normalizeString(payload.budgetForecast?.referenceCategories, ''),
    },
    highFrequency: normalizeArray(payload.highFrequency).slice(0, 5).map((item) => ({
      label: normalizeString(item?.label, ''),
      count: Math.max(0, Number(item?.count || 0)),
      amount: normalizeAmount(item?.amount),
      behavior: normalizeString(item?.behavior, ''),
      suggestion: normalizeString(item?.suggestion, ''),
    })),
    actionItems: normalizeArray(payload.actionItems)
      .map((item) => normalizeString(item, ''))
      .filter(Boolean)
      .slice(0, 5),
    ui: {
      badge: normalizeString(payload.ui?.badge, fallbackUi.badge || 'AI 消费分析'),
      tone: normalizeString(payload.ui?.tone, fallbackUi.tone || 'cyan'),
      subtitle: normalizeString(payload.ui?.subtitle, ''),
    },
  };
};

module.exports = {
  normalizeAnalysis,
  safeJsonParse,
};

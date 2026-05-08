const crypto = require('node:crypto');
const { formatMonth, formatDate } = require('../../miniprogram/utils/format');
const { DEFAULT_BILL_CATEGORIES, normalizeBillCategories } = require('../../miniprogram/utils/category');
const { aggregateStats } = require('../../miniprogram/utils/stats');

const FREE_AI_QUOTA_LIMIT = 20;
const MEMBER_LEVEL_FREE = 'free';
const MEMBER_LEVEL_VIP = 'vip';
const MEMBER_STATUS_FREE = 'free';
const MEMBER_STATUS_ACTIVE = 'active';
const MEMBER_STATUS_EXPIRED = 'expired';

const pad = (value) => String(value).padStart(2, '0');

const nowIso = () => new Date().toISOString();

const toDate = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeDate = (value) => {
  if (!value) return formatDate(new Date());
  if (value instanceof Date) return formatDate(value);
  const stringValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) return stringValue.slice(0, 10);
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? stringValue.slice(0, 10) : formatDate(parsed);
};

const normalizeMonth = (value) => {
  if (!value) return formatMonth(new Date());
  if (value instanceof Date) return formatMonth(value);
  const stringValue = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(stringValue)) return stringValue;
  if (/^\d{4}-\d{1,2}/.test(stringValue)) return stringValue.slice(0, 7);
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? stringValue.slice(0, 7) : formatMonth(parsed);
};

const normalizeYear = (value) => {
  if (!value) return String(new Date().getFullYear());
  if (value instanceof Date) return String(value.getFullYear());
  const stringValue = String(value).trim();
  if (/^\d{4}$/.test(stringValue)) return stringValue;
  if (/^\d{4}-\d{1,2}/.test(stringValue)) return stringValue.slice(0, 4);
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? stringValue.slice(0, 4) : String(parsed.getFullYear());
};

const monthStart = (value) => `${normalizeMonth(value)}-01`;

const monthEnd = (value) => {
  const [year, month] = normalizeMonth(value).split('-').map(Number);
  return formatDate(new Date(year, month, 0));
};

const buildId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

const maskPhoneNumber = (value = '') => {
  const phone = String(value || '').trim();
  if (!phone) return '';
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const sanitizeProfile = (profile = {}) => ({
  nickname: typeof profile.nickName === 'string'
    ? profile.nickName.trim()
    : (typeof profile.nickname === 'string' ? profile.nickname.trim() : ''),
  avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '',
  phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber.trim() : '',
  phoneCountryCode: typeof profile.phoneCountryCode === 'string' ? profile.phoneCountryCode.trim() : '',
  password: typeof profile.password === 'string' ? profile.password : '',
});

const computeMemberState = (user = {}, now = new Date()) => {
  const currentTime = toDate(now);
  const memberLevel = user.memberLevel === MEMBER_LEVEL_VIP ? MEMBER_LEVEL_VIP : MEMBER_LEVEL_FREE;
  const vipExpireTime = user.vipExpireTime || null;
  const vipExpireDate = vipExpireTime ? toDate(vipExpireTime) : null;
  const vipActive =
    memberLevel === MEMBER_LEVEL_VIP &&
    vipExpireDate &&
    vipExpireDate.getTime() > currentTime.getTime();

  const memberStatus = memberLevel === MEMBER_LEVEL_VIP
    ? (vipActive ? MEMBER_STATUS_ACTIVE : MEMBER_STATUS_EXPIRED)
    : MEMBER_STATUS_FREE;

  const quotaLimit = Number.isFinite(Number(user.aiQuotaLimit)) && Number(user.aiQuotaLimit) > 0
    ? Math.floor(Number(user.aiQuotaLimit))
    : FREE_AI_QUOTA_LIMIT;
  const cycleKey = `${currentTime.getFullYear()}-${pad(currentTime.getMonth() + 1)}`;
  const sameCycle = user.aiQuotaCycle === cycleKey;
  const storedRemaining = Number(user.aiQuotaRemaining);
  const aiUnlimited = memberStatus === MEMBER_STATUS_ACTIVE;
  const aiQuotaRemaining = aiUnlimited
    ? null
    : (sameCycle && Number.isFinite(storedRemaining) ? Math.max(0, Math.floor(storedRemaining)) : quotaLimit);

  return {
    memberLevel,
    memberStatus,
    aiUnlimited,
    aiQuotaLimit: quotaLimit,
    aiQuotaRemaining,
    aiQuotaCycle: cycleKey,
    aiQuotaResetAt: `${cycleKey}-01`,
  };
};

const buildUserView = (doc = {}, now = new Date()) => {
  const state = computeMemberState(doc, now);
  const phoneNumber = doc.phoneNumber || '';
  const { password, ...safeDoc } = doc;
  let billCategories = DEFAULT_BILL_CATEGORIES;
  try {
    if (doc.billCategories) {
      billCategories = normalizeBillCategories(doc.billCategories);
    } else if (doc.billCategoriesJson) {
      billCategories = normalizeBillCategories(JSON.parse(doc.billCategoriesJson));
    }
  } catch (error) {
    billCategories = DEFAULT_BILL_CATEGORIES;
  }

  return {
    ...safeDoc,
    billCategories,
    ...state,
    phoneBound: Boolean(phoneNumber),
    passwordBound: Boolean(password),
    phoneNumberMasked: maskPhoneNumber(phoneNumber),
    aiQuotaRemainingText: state.aiUnlimited ? '无限' : String(state.aiQuotaRemaining),
    memberLabel: state.aiUnlimited ? '会员' : (state.memberStatus === MEMBER_STATUS_EXPIRED ? '已过期' : '免费'),
  };
};

const normalizePhoneNumber = (value = '') => String(value || '').trim();

const normalizePassword = (value = '') => String(value ?? '');

const normalizeBillInput = (data = {}) => {
  const date = normalizeDate(data.date);
  return {
    type: data.type === 'income' ? 'income' : 'expense',
    amount: Number(data.amount || 0),
    category: data.category || '其他',
    merchant: data.merchant || '',
    remark: data.remark || '',
    date,
    month: normalizeMonth(date),
    year: normalizeYear(date),
    source: data.source || 'manual',
    aiParsed: data.aiParsed || null,
  };
};

const summarizeBills = (list = [], today = '') => {
  const summary = {
    totalExpense: 0,
    totalIncome: 0,
    netAmount: 0,
    expenseCount: 0,
    incomeCount: 0,
    totalCount: list.length,
    todayExpense: 0,
    todayCount: 0,
    topCategories: [],
  };

  const categoryMap = new Map();

  list.forEach((bill) => {
    const amount = Number(bill.amount || 0);
    if (bill.type === 'income') {
      summary.totalIncome += amount;
      summary.incomeCount += 1;
    } else {
      summary.totalExpense += amount;
      summary.expenseCount += 1;
    }

    const categoryKey = bill.category || '其他';
    categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + amount);

    if (today && bill.date === today && bill.type !== 'income') {
      summary.todayExpense += amount;
      summary.todayCount += 1;
    }
  });

  summary.netAmount = summary.totalIncome - summary.totalExpense;
  summary.topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return summary;
};

const buildReportInsight = ({ bills = [], month = '', year = '', categories = null }) => {
  const period = year ? { periodType: 'year', year } : { periodType: 'month', month };
  const stats = aggregateStats(bills, { ...period, categories });
  const topCategory = stats.categoryList[0];
  const insight = stats.insights || {};

  return {
    summaryText: insight.summaryText || `${year || month} 共 ${stats.summary.totalCount} 笔，支出 ${stats.summary.totalExpense.toFixed(2)} 元，收入 ${stats.summary.totalIncome.toFixed(2)} 元。`,
    adviceText: insight.adviceText || (topCategory
      ? `主要支出集中在 ${topCategory.name}。`
      : '账单数据较少，建议继续记录。'),
    tagsText: insight.tagText || (topCategory ? topCategory.name : '暂无'),
    detail: stats.summary,
    stats,
  };
};

const buildDateRange = ({ periodType = 'month', month = '', year = '' } = {}) => {
  if (periodType === 'year') {
    const currentYear = normalizeYear(year);
    const previousYear = String(Number(currentYear) - 1);
    return {
      periodType: 'year',
      label: `${currentYear}年`,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      prevStartDate: `${previousYear}-01-01`,
      prevEndDate: `${previousYear}-12-31`,
      year: currentYear,
    };
  }

  const currentMonth = normalizeMonth(month || new Date());
  const [yearPart, monthPart] = currentMonth.split('-').map(Number);
  const prevDate = new Date(yearPart, monthPart - 2, 1);
  const prevMonth = formatMonth(prevDate);

  return {
    periodType: 'month',
    label: `${currentMonth}月`,
    startDate: `${currentMonth}-01`,
    endDate: monthEnd(currentMonth),
    prevStartDate: `${prevMonth}-01`,
    prevEndDate: monthEnd(prevMonth),
    month: currentMonth,
  };
};

const compareCategories = (currentBills = [], previousBills = []) => {
  const currentMap = new Map();
  const previousMap = new Map();

  currentBills.forEach((bill) => {
    if (bill.type === 'income') return;
    const key = bill.category || '其他';
    currentMap.set(key, (currentMap.get(key) || 0) + Number(bill.amount || 0));
  });

  previousBills.forEach((bill) => {
    if (bill.type === 'income') return;
    const key = bill.category || '其他';
    previousMap.set(key, (previousMap.get(key) || 0) + Number(bill.amount || 0));
  });

  const keys = new Set([...currentMap.keys(), ...previousMap.keys()]);
  return [...keys]
    .map((name) => {
      const currentValue = Number(currentMap.get(name) || 0);
      const previousValue = Number(previousMap.get(name) || 0);
      const delta = currentValue - previousValue;
      const base = previousValue || currentValue || 1;
      return {
        name,
        currentValue,
        previousValue,
        changeRate: delta / base,
      };
    })
    .sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate))
    .slice(0, 6);
};

const buildHighFrequency = (bills = []) => {
  const map = new Map();
  bills.forEach((bill) => {
    const key = bill.merchant || bill.category || '其他';
    const item = map.get(key) || { label: key, count: 0, amount: 0 };
    item.count += 1;
    item.amount += Number(bill.amount || 0);
    map.set(key, item);
  });

  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, 5);
};

const buildDailyAnomalies = (bills = []) => {
  const map = new Map();
  bills.forEach((bill) => {
    const day = String(bill.date || '').slice(0, 10);
    const item = map.get(day) || { date: day, amount: 0, count: 0 };
    if (bill.type !== 'income') {
      item.amount += Number(bill.amount || 0);
    }
    item.count += 1;
    map.set(day, item);
  });

  return [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((item) => ({
      date: item.date,
      amount: Number(item.amount.toFixed(2)),
      count: item.count,
      reason: '当日支出较高',
    }));
};

const buildBudgetForecast = (summary = {}, categoryChanges = []) => {
  const pressureRatio = summary.totalIncome > 0 ? summary.totalExpense / summary.totalIncome : 1;
  const pressure = pressureRatio > 1 ? 'high' : pressureRatio > 0.8 ? 'medium' : 'low';
  return {
    forecastExpense: Number((summary.totalExpense * 1.08).toFixed(2)),
    pressure,
    confidence: 0.7,
    suggestion: categoryChanges[0]
      ? `重点关注 ${categoryChanges[0].name} 相关支出。`
      : '保持当前记录频率，观察后续趋势。',
    referenceCategories: categoryChanges.slice(0, 3).map((item) => item.name),
  };
};

const buildAiAnalysis = ({ currentBills = [], previousBills = [], range }) => {
  const currentStats = aggregateStats(currentBills, {
    periodType: range.periodType,
    month: range.month,
    year: range.year,
  });
  const categoryChanges = compareCategories(currentBills, previousBills);
  const anomalies = buildDailyAnomalies(currentBills);
  const highFrequency = buildHighFrequency(currentBills);
  const budgetForecast = buildBudgetForecast(currentStats.summary, categoryChanges);
  const topCategory = currentStats.categoryList[0];
  const trendDirection = currentStats.trend.expense.slice(-1)[0] > currentStats.trend.expense.slice(-2, -1)[0]
    ? 'up'
    : currentStats.trend.expense.slice(-1)[0] < currentStats.trend.expense.slice(-2, -1)[0]
    ? 'down'
    : 'flat';

  return {
    periodType: range.periodType,
    range,
    summary: currentStats.summary,
    trend: currentStats.trend,
    categoryTotals: currentStats.categoryList,
    categoryChanges,
    anomalies,
    highFrequency,
    budgetForecast,
    analysis: {
      ui: {
        badge: range.periodType === 'year' ? '年报' : '月报',
        tone: budgetForecast.pressure === 'high' ? 'orange' : 'cyan',
        subtitle: topCategory ? `重点关注 ${topCategory.name}` : '消费结构稳定',
      },
      overview: `共 ${currentStats.summary.totalCount} 笔，支出 ${currentStats.summary.totalExpense.toFixed(2)} 元，收入 ${currentStats.summary.totalIncome.toFixed(2)} 元，净支出 ${Math.abs(currentStats.summary.netAmount).toFixed(2)} 元。`,
      trend: {
        direction: trendDirection,
        title: '消费趋势',
        detail: trendDirection === 'up'
          ? '最近支出有所上升。'
          : trendDirection === 'down'
          ? '最近支出有所回落。'
          : '消费趋势整体平稳。',
        keyPoint: currentStats.trend.xAxis.length
          ? `最近一天支出 ${currentStats.trend.expense.slice(-1)[0] || 0} 元`
          : '暂无趋势数据',
      },
      anomalies: anomalies.map((item, index) => ({
        ...item,
        severity: index === 0 ? 'high' : 'medium',
      })),
      categoryChanges,
      highFrequency: highFrequency.map((item) => ({
        ...item,
        behavior: `${item.label} 在本期出现 ${item.count} 次，累计 ${item.amount.toFixed(2)} 元。`,
        suggestion: `建议关注 ${item.label} 相关高频支出。`,
      })),
      actionItems: [
        topCategory ? `优先压缩 ${topCategory.name} 相关支出。` : '继续完善账单记录。',
        anomalies[0] ? `留意 ${anomalies[0].date} 的支出峰值。` : '目前未发现明显异常峰值。',
        highFrequency[0] ? `减少 ${highFrequency[0].label} 这类重复消费。` : '保持当前消费节奏。',
      ],
    },
  };
};

module.exports = {
  buildId,
  buildAiAnalysis,
  buildDateRange,
  buildReportInsight,
  buildUserView,
  compareCategories,
  computeMemberState,
  maskPhoneNumber,
  normalizeBillInput,
  normalizeDate,
  normalizeMonth,
  normalizeYear,
  normalizePhoneNumber,
  normalizePassword,
  nowIso,
  sanitizeProfile,
  summarizeBills,
  monthStart,
  monthEnd,
};

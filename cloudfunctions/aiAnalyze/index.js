const cloud = require('wx-server-sdk');
const { requestJson } = require('./deepseek');
const { buildSystemPrompt, buildUserPrompt } = require('./prompt');
const { normalizeAnalysis, safeJsonParse } = require('./validate');
const {
  AI_LOG_COLLECTION,
  BILL_COLLECTION,
  DEFAULT_MODEL,
  EMPTY_TOKEN_USAGE,
} = require('./constants');
const {
  buildAnalysisSeed,
  buildPromptSeed,
  getDateRangeForPeriod,
  getRangeMonths,
} = require('./aggregate');
const {
  checkAiPermission,
  consumeAiQuota,
} = require('../shared');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const getOpenId = () => cloud.getWXContext().OPENID;

const ensureCollection = async (name) => {
  try {
    await db.createCollection(name);
  } catch (error) {
    const errMsg = String(error?.errMsg || error?.message || error || '');
    if (/resourceexist|already exists|table exist|collection already exists|已存在|exist/i.test(errMsg)) {
      return;
    }
    throw error;
  }
};

const queryBillsByMonths = async (months = []) => {
  await ensureCollection(BILL_COLLECTION);
  const uniqMonths = [...new Set(months.filter(Boolean))];
  if (!uniqMonths.length) return [];

  const results = await Promise.all(
    uniqMonths.map((month) =>
      db
        .collection(BILL_COLLECTION)
        .where({
          openid: getOpenId(),
          month,
        })
        .get(),
    ),
  );

  return results.flatMap((item) => item.data || []);
};

const filterBillsByDateRange = (bills = [], startDate, endDate) =>
  bills.filter((bill) => {
    const date = String(bill.date || '').slice(0, 10);
    return date >= startDate && date <= endDate;
  });

const buildFallbackAnalysis = (seed) => {
  const summary = seed.summary || {};
  const categoryTop = seed.categoryTotals.items[0];
  const anomalyTop = seed.anomalies[0];
  const frequencyTop = seed.highFrequency[0];
  const trendExpense = seed.trend.expense;
  const firstHalf = trendExpense.slice(0, Math.ceil(trendExpense.length / 2)).reduce((sum, item) => sum + item, 0);
  const secondHalf = trendExpense.slice(Math.floor(trendExpense.length / 2)).reduce((sum, item) => sum + item, 0);
  const trendDirection = secondHalf > firstHalf ? 'up' : secondHalf < firstHalf ? 'down' : 'flat';

  return {
    periodType: seed.range.periodType,
    headline: seed.range.periodType === 'week' ? '本周消费速览' : '本月消费速览',
    overview: `共 ${summary.billCount} 笔，支出 ${summary.totalExpense.toFixed(2)} 元，收入 ${summary.totalIncome.toFixed(2)} 元，净支出 ${Math.abs(summary.netAmount).toFixed(2)} 元。`,
    trend: {
      direction: trendDirection,
      title: '消费趋势',
      detail:
        trendDirection === 'up'
          ? '后半段支出高于前半段，消费有抬头迹象。'
          : trendDirection === 'down'
          ? '后半段支出低于前半段，消费在回落。'
          : '消费节奏相对平稳。',
      keyPoint: seed.trend.xAxis.length ? `最近一天支出 ${seed.trend.expense.slice(-1)[0] || 0} 元` : '暂无趋势数据',
    },
    anomalies: seed.anomalies.map((item, index) => ({
      ...item,
      severity: index === 0 ? 'high' : 'medium',
    })),
    categoryChanges: seed.categoryChanges,
    budgetForecast: {
      forecastExpense: seed.budgetForecast.forecastExpense,
      pressure: seed.budgetForecast.pressure,
      confidence: seed.budgetForecast.confidence,
      suggestion: seed.budgetForecast.suggestion,
      referenceCategories: seed.budgetForecast.referenceCategories,
    },
    highFrequency: seed.highFrequency.map((item) => ({
      ...item,
      behavior: `${item.label} 在本期出现 ${item.count} 次，累计 ${item.amount.toFixed(2)} 元。`,
      suggestion: `建议关注 ${item.label} 相关高频小额支出。`,
    })),
    actionItems: [
      categoryTop ? `优先压缩 ${categoryTop.name} 相关支出。` : '继续记录更完整的账单信息。',
      anomalyTop ? `留意 ${anomalyTop.date} 的异常支出 ${anomalyTop.amount.toFixed(2)} 元。` : '目前未发现明显异常大额支出。',
      frequencyTop ? `减少 ${frequencyTop.label} 这类高频行为的重复消费。` : '保持当前消费节奏并持续观察。',
    ],
    ui: {
      badge: seed.range.periodType === 'week' ? '周报' : '月报',
      tone: seed.budgetForecast.pressure === 'high' ? 'orange' : 'cyan',
      subtitle: categoryTop ? `重点关注 ${categoryTop.name}` : '消费结构稳定',
    },
  };
};

const saveAiLog = async ({ input, output, tokenUsage, status, errorMessage, model, source }) => {
  const now = db.serverDate();
  await db.collection(AI_LOG_COLLECTION).add({
    data: {
      openid: getOpenId(),
      taskType: 'spending_analysis',
      model,
      source,
      input,
      output,
      tokenUsage: tokenUsage || { ...EMPTY_TOKEN_USAGE },
      status,
      errorMessage: errorMessage || '',
      createdAt: now,
    },
  });
};

const chargeAiQuota = async (permission) => {
  if (!permission?.user || permission.user.aiUnlimited) return;

  await consumeAiQuota({
    db,
    openid: getOpenId(),
    amount: 1,
    now: new Date(),
    serverNow: db.serverDate(),
  }).catch(() => null);
};

const analyze = async (data = {}) => {
  const periodType = data.periodType === 'week' ? 'week' : data.periodType === 'year' ? 'year' : 'month';
  const range = getDateRangeForPeriod({
    periodType,
    month: data.month,
    year: data.year,
  });

  const currentMonths = getRangeMonths(range);
  const previousMonths = range.periodType === 'year'
    ? Array.from({ length: 12 }, (_, index) => `${String(Number(range.year) - 1)}-${String(index + 1).padStart(2, '0')}`)
    : [range.prevStartDate.slice(0, 7), range.prevEndDate.slice(0, 7)];

  const [currentBills, previousBills] = await Promise.all([
    queryBillsByMonths(currentMonths),
    queryBillsByMonths(previousMonths),
  ]);

  const currentPeriodBills = filterBillsByDateRange(currentBills, range.startDate, range.endDate);
  const previousPeriodBills = filterBillsByDateRange(previousBills, range.prevStartDate, range.prevEndDate);
  const seed = buildAnalysisSeed({
    currentBills: currentPeriodBills,
    previousBills: previousPeriodBills,
    range,
  });
  const fallbackAnalysis = buildFallbackAnalysis(seed);
  const apiKey = process.env.DEEPSEEK_API_KEY || '';

  if (!apiKey) {
    return {
      analysis: fallbackAnalysis,
      seed,
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      provider: 'fallback',
      model: DEFAULT_MODEL,
    };
  }

  const response = await requestJson({
    apiKey,
    body: {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(buildPromptSeed(seed)) },
      ],
      temperature: 0.15,
      max_tokens: 1200,
      response_format: {
        type: 'json_object',
      },
      stream: false,
    },
  });

  const content = response?.choices?.[0]?.message?.content || '';
  const payload = safeJsonParse(content);
  const analysis = normalizeAnalysis(payload || {}, fallbackAnalysis);

  return {
    analysis,
    seed,
    tokenUsage: {
      promptTokens: Number(response?.usage?.prompt_tokens || 0),
      completionTokens: Number(response?.usage?.completion_tokens || 0),
      totalTokens: Number(response?.usage?.total_tokens || 0),
    },
    provider: 'deepseek',
    model: response?.model || DEFAULT_MODEL,
  };
};

exports.main = async (event) => {
  const action = event.action || 'analyze';
  const data = event.data || {};

  await ensureCollection(AI_LOG_COLLECTION);
  await ensureCollection(BILL_COLLECTION);

  if (action !== 'analyze') {
    return {
      success: false,
      errCode: 'AI_ANALYZE_UNKNOWN_ACTION',
      message: 'unknown action',
    };
  }

  const permission = await checkAiPermission({
    db,
    openid: getOpenId(),
    need: 1,
    now: new Date(),
    serverNow: db.serverDate(),
  });

  if (!permission.allowed) {
    await saveAiLog({
      input: data,
      output: null,
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      status: 'failed',
      errorMessage: permission.reason || 'AI_QUOTA_EXCEEDED',
      model: DEFAULT_MODEL,
      source: 'bill_analysis',
    }).catch(() => null);

    return {
      success: false,
      errCode: permission.reason || 'AI_QUOTA_EXCEEDED',
      message: permission.message || 'AI 次数不足，请开通会员',
      data: {
        user: permission.user,
      },
    };
  }

  try {
  const result = await analyze(data);

    await saveAiLog({
      input: {
        periodType,
        month: data.month || '',
        year: data.year || '',
        seed: buildPromptSeed(result.seed),
      },
      output: {
        analysis: result.analysis,
      },
      tokenUsage: result.tokenUsage,
      status: 'success',
      errorMessage: result.provider === 'fallback' ? 'FALLBACK_USED' : '',
      model: result.model || DEFAULT_MODEL,
      source: 'bill_analysis',
    }).catch(() => null);

    await chargeAiQuota(permission);

    return {
      success: true,
      data: {
        periodType,
        range: result.seed.range,
        summary: result.seed.summary,
        trend: result.seed.trend,
        categoryTotals: result.seed.categoryTotals,
        categoryChanges: result.seed.categoryChanges,
        anomalies: result.seed.anomalies,
        highFrequency: result.seed.highFrequency,
        budgetForecast: result.seed.budgetForecast,
        analysis: result.analysis,
        tokenUsage: result.tokenUsage,
        provider: result.provider,
        model: result.model,
      },
    };
  } catch (error) {
    await saveAiLog({
      input: data,
      output: null,
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      status: 'failed',
      errorMessage: error?.message || 'AI_ANALYZE_FAILED',
      model: DEFAULT_MODEL,
      source: 'bill_analysis',
    }).catch(() => null);

    return {
      success: false,
      errCode: 'AI_ANALYZE_FAILED',
      message: 'AI 分析失败',
      detail: error?.message || String(error),
    };
  }
};

const cloud = require('wx-server-sdk');
const { buildSystemPrompt, buildUserPrompt } = require('./prompt');
const { requestJson } = require('./deepseek');
const {
  AI_LOG_COLLECTION,
  DEFAULT_MODEL,
  EMPTY_TOKEN_USAGE,
} = require('./constants');
const {
  buildNowFallback,
  normalizeAmount,
  normalizeDate,
  normalizeString,
  normalizeTime,
  safeJsonParse,
  validateParsedBill,
} = require('./validate');
const {
  checkAiPermission,
  consumeAiQuota,
} = require('../shared/membership');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const getOpenId = () => cloud.getWXContext().OPENID;

const CATEGORY_RULES = [
  { category: '餐饮', keywords: ['餐饮', '外卖', '咖啡', '奶茶', '美团', '饿了么', '饭', '吃'] },
  { category: '交通', keywords: ['地铁', '公交', '打车', '出租', '停车', '滴滴', '高铁', '机票'] },
  { category: '购物', keywords: ['淘宝', '天猫', '京东', '拼多多', '购物', '超市', '商场', '服装'] },
  { category: '住房', keywords: ['房租', '物业', '水电', '房贷', '租金'] },
  { category: '娱乐', keywords: ['电影', '游戏', '演出', 'ktv', '娱乐'] },
  { category: '医疗', keywords: ['医院', '药店', '体检', '挂号', '医疗'] },
  { category: '教育', keywords: ['课程', '培训', '学费', '教育'] },
  { category: '工资', keywords: ['工资', '薪资', '入账', '报销', '收入', '退款'] },
  { category: '理财', keywords: ['基金', '股票', '理财'] },
];

const INCOME_KEYWORDS = ['工资', '薪资', '收入', '入账', '转入', '退款', '返现', '报销'];

const splitLines = (text = '') =>
  String(text)
    .split(/\r?\n|\s{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

const extractAmount = (text = '') => {
  const content = String(text);
  const matches = [];
  const regex = /(?:￥|¥|元)?\s*([0-9]+(?:\.[0-9]{1,2})?)(?=\s*(?:元|人民币|支付|收款|余额|$))/g;

  let match;
  while ((match = regex.exec(content))) {
    matches.push(Number(match[1]));
  }

  if (!matches.length) {
    const looseRegex = /([0-9]+(?:\.[0-9]{1,2})?)/g;
    while ((match = looseRegex.exec(content))) {
      matches.push(Number(match[1]));
    }
  }

  return normalizeAmount(matches.sort((a, b) => a - b).pop() || 0);
};

const extractType = (text = '') => {
  const content = String(text);
  return INCOME_KEYWORDS.some((keyword) => content.includes(keyword)) ? 'income' : 'expense';
};

const extractCategory = (text = '', source = 'ocr') => {
  const content = String(text);
  if (source === 'meituan') return '餐饮';

  const hit = CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => content.includes(keyword)));
  return hit ? hit.category : '其他';
};

const extractMerchant = (lines = [], text = '') => {
  const content = String(text);
  const joined = lines.join(' ');
  const patterns = [
    /(?:商户|商家|交易对方|收款方|付款给)\s*[:：]?\s*([^\s，,。；;]{2,24})/,
    /(?:门店|店铺)\s*[:：]?\s*([^\s，,。；;]{2,24})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern) || joined.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/[0-9￥¥].*$/, '').trim();
    }
  }

  return lines.find((line) => line.length >= 2 && line.length <= 24) || '';
};

const extractTime = (text = '') => {
  const content = String(text);
  const datetimeMatch = content.match(
    /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日\s]+(\d{1,2})[:时](\d{1,2})/,
  );

  if (datetimeMatch) {
    const year = datetimeMatch[1];
    const month = String(datetimeMatch[2]).padStart(2, '0');
    const day = String(datetimeMatch[3]).padStart(2, '0');
    const hour = String(datetimeMatch[4]).padStart(2, '0');
    const minute = String(datetimeMatch[5]).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  const dateMatch = content.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日]?/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = String(dateMatch[2]).padStart(2, '0');
    const day = String(dateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day} 00:00`;
  }

  return '';
};

const buildFallbackBill = (text = '', source = 'ocr') => {
  const lines = splitLines(text);
  const time = extractTime(text);
  const baseFallback = buildNowFallback();
  const fallback = {
    amount: extractAmount(text),
    merchant: extractMerchant(lines, text),
    category: extractCategory(text, source),
    time: normalizeTime(time, baseFallback.time),
    date: normalizeDate(time || baseFallback.date, baseFallback.date),
    type: extractType(text),
    currency: 'CNY',
    confidence: 0.35,
    evidence: {
      amountText: String(extractAmount(text) || ''),
      merchantText: extractMerchant(lines, text),
      categoryText: extractCategory(text, source),
      timeText: time || baseFallback.time,
      typeText: extractType(text),
    },
    notes: `${source} fallback parser`,
  };

  return validateParsedBill(fallback, baseFallback).bill;
};

const parseWithDeepSeek = async ({ text, source }) => {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const fallbackBill = buildFallbackBill(text, source);

  if (!apiKey) {
    return {
      bill: fallbackBill,
      raw: null,
      model: DEFAULT_MODEL,
      provider: 'fallback',
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
    };
  }

  const response = await requestJson({
    apiKey,
    body: {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(text, source) },
      ],
      temperature: 0.1,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      stream: false,
    },
  });

  const content = response?.choices?.[0]?.message?.content || '';
  const parsedJson = safeJsonParse(content);
  const validated = validateParsedBill(parsedJson || {}, fallbackBill);
  const bill = validated.ok ? validated.bill : fallbackBill;

  return {
    bill,
    raw: parsedJson || content || null,
    model: response?.model || DEFAULT_MODEL,
    provider: validated.ok ? 'deepseek' : 'fallback',
    tokenUsage: {
      promptTokens: Number(response?.usage?.prompt_tokens || 0),
      completionTokens: Number(response?.usage?.completion_tokens || 0),
      totalTokens: Number(response?.usage?.total_tokens || 0),
    },
  };
};

const saveAiLog = async ({ input, output, tokenUsage, status, errorMessage, model, source }) => {
  const now = db.serverDate();

  await db.collection(AI_LOG_COLLECTION).add({
    data: {
      openid: getOpenId(),
      taskType: 'bill_parse',
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

exports.main = async (event) => {
  const action = event.action || 'parse';
  const data = event.data || {};

  if (action !== 'parse') {
    return {
      success: false,
      errCode: 'AI_PARSE_UNKNOWN_ACTION',
      message: 'unknown action',
    };
  }

  const text = normalizeString(data.text, '').trim();
  const source = normalizeString(data.source, 'ocr');

  if (!text) {
    await saveAiLog({
      input: data,
      output: null,
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      status: 'failed',
      errorMessage: 'EMPTY_TEXT',
      model: DEFAULT_MODEL,
      source,
    }).catch(() => null);

    return {
      success: false,
      errCode: 'EMPTY_TEXT',
      message: 'OCR文本不能为空',
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
      input: { source, text },
      output: null,
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      status: 'failed',
      errorMessage: permission.reason || 'AI_QUOTA_EXCEEDED',
      model: DEFAULT_MODEL,
      source,
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
    const result = await parseWithDeepSeek({ text, source });
    await saveAiLog({
      input: { source, text },
      output: result,
      tokenUsage: result.tokenUsage,
      status: 'success',
      errorMessage: '',
      model: result.model || DEFAULT_MODEL,
      source,
    }).catch(() => null);

    await chargeAiQuota(permission);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const fallbackBill = buildFallbackBill(text, source);

    await saveAiLog({
      input: { source, text },
      output: {
        bill: fallbackBill,
        raw: null,
        provider: 'fallback',
      },
      tokenUsage: { ...EMPTY_TOKEN_USAGE },
      status: 'failed',
      errorMessage: error?.message || 'DEEPSEEK_PARSE_FAILED',
      model: DEFAULT_MODEL,
      source,
    }).catch(() => null);

    await chargeAiQuota(permission);

    return {
      success: true,
      data: {
        bill: fallbackBill,
        raw: null,
        model: DEFAULT_MODEL,
        provider: 'fallback',
        tokenUsage: { ...EMPTY_TOKEN_USAGE },
        errorMessage: error?.message || 'DEEPSEEK_PARSE_FAILED',
      },
    };
  }
};

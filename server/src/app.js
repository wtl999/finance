const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const { db } = require('./db');
const {
  buildAiAnalysis,
  buildDateRange,
  buildId,
  buildReportInsight,
  buildUserView,
  compareCategories,
  normalizeBillInput,
  normalizeDate,
  normalizeMonth,
  normalizeYear,
  normalizePhoneNumber,
  normalizePassword,
  nowIso,
  sanitizeProfile,
  summarizeBills,
} = require('./lib');
const { DEFAULT_BILL_CATEGORIES, normalizeBillCategories, getCategoryMeta } = require('../../miniprogram/utils/category');

const upload = multer({ dest: path.join(os.tmpdir(), 'finance-uploads') });
const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

app.use(cors());
app.use(express.json({ limit: '8mb' }));

const ensureTables = () => {
  // Tables are created in db.js on load.
  return true;
};

const findUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
const findUserByOpenId = (openid) => db.prepare('SELECT * FROM users WHERE openid = ?').get(openid) || null;
const findSession = (token) => db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) || null;

const getBearerToken = (req) => {
  const raw = req.headers.authorization || '';
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const requireAuth = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'not logged in' });
  }

  const session = findSession(token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return res.status(401).json({ success: false, message: 'login expired' });
  }

  const user = findUserById(session.userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'user not found' });
  }

  req.user = user;
  req.session = session;
  next();
};

const parseBillCategories = (user) => {
  try {
    if (user?.billCategoriesJson) return JSON.parse(user.billCategoriesJson);
  } catch (error) {
    void error;
  }
  return DEFAULT_BILL_CATEGORIES;
};

const saveUser = (user) => {
  const now = nowIso();
  const existing = user.id ? findUserById(user.id) : (user.openid ? findUserByOpenId(user.openid) : null);
  const nextBillCategories = normalizeBillCategories(
    user.billCategories || parseBillCategories(existing) || DEFAULT_BILL_CATEGORIES,
  );
  const record = {
    id: existing?.id || user.id || buildId('user'),
    openid: user.openid || existing?.openid || `local-${buildId('openid')}`,
    appid: user.appid || existing?.appid || '',
    unionid: user.unionid || existing?.unionid || '',
    nickname: user.nickname || existing?.nickname || '微信用户',
    avatarUrl: user.avatarUrl || existing?.avatarUrl || '',
    phoneNumber: user.phoneNumber || existing?.phoneNumber || '',
    phoneCountryCode: user.phoneCountryCode || existing?.phoneCountryCode || '',
    password: user.password || existing?.password || '',
    memberLevel: user.memberLevel || existing?.memberLevel || 'free',
    memberStatus: user.memberStatus || existing?.memberStatus || 'free',
    vipExpireTime: user.vipExpireTime || existing?.vipExpireTime || null,
    aiQuotaLimit: Number.isFinite(Number(user.aiQuotaLimit)) ? Number(user.aiQuotaLimit) : Number(existing?.aiQuotaLimit || 20),
    aiQuotaRemaining: Number.isFinite(Number(user.aiQuotaRemaining)) ? Number(user.aiQuotaRemaining) : Number(existing?.aiQuotaRemaining || 20),
    aiQuotaCycle: user.aiQuotaCycle || existing?.aiQuotaCycle || '',
    aiQuotaResetAt: user.aiQuotaResetAt || existing?.aiQuotaResetAt || '',
    aiUsedTotal: Number.isFinite(Number(user.aiUsedTotal)) ? Number(user.aiUsedTotal) : Number(existing?.aiUsedTotal || 0),
    aiLastConsumeAt: user.aiLastConsumeAt || existing?.aiLastConsumeAt || null,
    billCategoriesJson: JSON.stringify(nextBillCategories),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const stmt = existing
    ? db.prepare(`
      UPDATE users SET
        openid = @openid,
        appid = @appid,
        unionid = @unionid,
        nickname = @nickname,
        avatarUrl = @avatarUrl,
        phoneNumber = @phoneNumber,
        phoneCountryCode = @phoneCountryCode,
        password = @password,
        memberLevel = @memberLevel,
        memberStatus = @memberStatus,
        vipExpireTime = @vipExpireTime,
        aiQuotaLimit = @aiQuotaLimit,
        aiQuotaRemaining = @aiQuotaRemaining,
        aiQuotaCycle = @aiQuotaCycle,
        aiQuotaResetAt = @aiQuotaResetAt,
        aiUsedTotal = @aiUsedTotal,
        aiLastConsumeAt = @aiLastConsumeAt,
        billCategoriesJson = @billCategoriesJson,
        updatedAt = @updatedAt
      WHERE id = @id
    `)
    : db.prepare(`
      INSERT INTO users (
        id, openid, appid, unionid, nickname, avatarUrl, phoneNumber, phoneCountryCode,
        password, memberLevel, memberStatus, vipExpireTime, aiQuotaLimit, aiQuotaRemaining, aiQuotaCycle,
        aiQuotaResetAt, aiUsedTotal, aiLastConsumeAt, billCategoriesJson, createdAt, updatedAt
      ) VALUES (
        @id, @openid, @appid, @unionid, @nickname, @avatarUrl, @phoneNumber, @phoneCountryCode,
        @password, @memberLevel, @memberStatus, @vipExpireTime, @aiQuotaLimit, @aiQuotaRemaining, @aiQuotaCycle,
        @aiQuotaResetAt, @aiUsedTotal, @aiLastConsumeAt, @billCategoriesJson, @createdAt, @updatedAt
      )
    `);

  stmt.run(record);
  return findUserById(record.id);
};

const createSession = (userId) => {
  const token = buildId('sess');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)').run(token, userId, createdAt, expiresAt);
  return { token, createdAt, expiresAt };
};

const updateSessionUser = (token, userId) => {
  const existing = findSession(token);
  if (!existing) return null;
  db.prepare('UPDATE sessions SET userId = ?, expiresAt = ? WHERE token = ?').run(userId, new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(), token);
  return findSession(token);
};

const getUserForRequest = (req) => {
  const token = getBearerToken(req);
  const session = token ? findSession(token) : null;
  if (!session) return null;
  return findUserById(session.userId);
};

const listBillsForUser = (userId, filters = {}) => {
  const clauses = ['userId = ?'];
  const params = [userId];

  if (filters.year) {
    const year = normalizeYear(filters.year);
    clauses.push('date >= ? AND date <= ?');
    params.push(`${year}-01-01`, `${year}-12-31`);
  } else if (filters.month) {
    const month = normalizeMonth(filters.month);
    clauses.push('month = ?');
    params.push(month);
  }

  if (filters.date) {
    clauses.push('date = ?');
    params.push(normalizeDate(filters.date));
  }

  if (filters.type && filters.type !== 'all') {
    clauses.push('type = ?');
    params.push(filters.type);
  }

  const where = clauses.join(' AND ');
  const all = db.prepare(`SELECT * FROM bills WHERE ${where} ORDER BY date DESC, createdAt DESC`).all(...params);
  return all;
};

const saveBill = (userId, data = {}) => {
  const now = nowIso();
  const bill = normalizeBillInput(data);
  const existing = data._id ? db.prepare('SELECT * FROM bills WHERE id = ? AND userId = ?').get(data._id, userId) : null;
  const record = {
    id: existing?.id || buildId('bill'),
    userId,
    ...bill,
    aiParsedJson: bill.aiParsed ? JSON.stringify(bill.aiParsed) : existing?.aiParsedJson || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    db.prepare(`
      UPDATE bills SET
        type = @type,
        amount = @amount,
        category = @category,
        merchant = @merchant,
        remark = @remark,
        date = @date,
        month = @month,
        year = @year,
        source = @source,
        aiParsedJson = @aiParsedJson,
        updatedAt = @updatedAt
      WHERE id = @id AND userId = @userId
    `).run(record);
  } else {
    db.prepare(`
      INSERT INTO bills (
        id, userId, type, amount, category, merchant, remark, date, month, year, source, aiParsedJson, createdAt, updatedAt
      ) VALUES (
        @id, @userId, @type, @amount, @category, @merchant, @remark, @date, @month, @year, @source, @aiParsedJson, @createdAt, @updatedAt
      )
    `).run(record);
  }

  return record;
};

const deleteBill = (userId, billId) => {
  db.prepare('DELETE FROM bills WHERE id = ? AND userId = ?').run(billId, userId);
};

const serializeBill = (row) => ({
  ...row,
  _id: row.id,
  aiParsed: row.aiParsedJson ? JSON.parse(row.aiParsedJson) : null,
});

const getCategoryData = (user) => {
  const raw = user?.billCategoriesJson ? JSON.parse(user.billCategoriesJson) : DEFAULT_BILL_CATEGORIES;
  return normalizeBillCategories(raw);
};

const updateUserQuota = (userId, amount = 1) => {
  const user = findUserById(userId);
  if (!user) return null;
  const now = nowIso();
  const currentRemaining = Number(user.aiQuotaRemaining || 0);
  db.prepare('UPDATE users SET aiUsedTotal = ?, aiQuotaRemaining = ?, aiLastConsumeAt = ?, updatedAt = ? WHERE id = ?').run(
    Number(user.aiUsedTotal || 0) + amount,
    Math.max(0, currentRemaining - amount),
    now,
    now,
    userId,
  );
  return findUserById(userId);
};

const buildSimpleAiClassify = (text = '') => {
  const value = String(text).toLowerCase();
  const incomeKeywords = ['\u5de5\u8d44', 'salary', '\u6536\u5165', '\u62a5\u9500', '\u9000\u6b3e'];
  const categoryMap = [
    { keywords: ['\u9910', '\u996d', 'coffee', '\u5496\u5561', '\u5976\u8336', '\u5916\u5356'], category: '\u9910\u996e' },
    { keywords: ['\u5730\u94c1', '\u516c\u4ea4', '\u6253\u8f66', '\u51fa\u79df', '\u505c\u8f66', '\u52a0\u6cb9'], category: '\u4ea4\u901a' },
    { keywords: ['\u5546\u573a', '\u6dd8\u5b9d', '\u4eac\u4e1c', '\u8d2d\u7269', '\u8863\u670d'], category: '\u8d2d\u7269' },
    { keywords: ['\u623f\u79df', '\u7269\u4e1a', '\u6c34\u7535', '\u71c3\u6c14'], category: '\u5c45\u4f4f' },
    { keywords: ['\u7535\u5f71', '\u6e38\u620f', '\u6f14\u51fa', 'ktv'], category: '\u5a31\u4e50' },
    { keywords: ['\u533b\u9662', '\u836f\u5e97', '\u4f53\u68c0'], category: '\u533b\u7597' },
    { keywords: ['\u8bfe\u7a0b', '\u57f9\u8bad', '\u5b66\u8d39'], category: '\u6559\u80b2' },
    { keywords: ['\u57fa\u91d1', '\u80a1\u7968', '\u7406\u8d22'], category: '\u7406\u8d22' },
  ];

  const isIncome = incomeKeywords.some((keyword) => value.includes(keyword.toLowerCase()));
  const categoryHit = categoryMap.find((item) => item.keywords.some((keyword) => value.includes(keyword.toLowerCase())));

  return {
    type: isIncome ? 'income' : 'expense',
    category: categoryHit ? categoryHit.category : '\u5176\u4ed6',
    confidence: categoryHit ? 0.92 : 0.62,
    reason: categoryHit ? `\u547d\u4e2d\u5173\u952e\u8bcd\uff1a${categoryHit.category}` : '\u672a\u547d\u4e2d\u56fa\u5b9a\u5206\u7c7b\uff0c\u56de\u9000\u5230\u5176\u4ed6',
  };
};

const extractAmount = (text = '') => {
  const content = String(text).replace(/[，,]/g, '').replace(/\s+/g, ' ');
  const candidates = [];
  const pushCandidate = (value, weight = 0) => {
    const amount = Number(String(value).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return;
    candidates.push({ amount: Number(amount.toFixed(2)), weight });
  };

  for (const match of content.matchAll(/(?:\u5b9e\u4ed8|\u652f\u4ed8|\u4ed8\u6b3e|\u4ea4\u6613\u91d1\u989d|\u91d1\u989d|\u652f\u51fa|\u6d88\u8d39|\u652f\u4ed8\u6210\u529f|\u5df2\u652f\u4ed8|\u4ed8\u51fa)[^0-9\n]{0,12}(?:\u00a5|\$)?\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 100);
  }

  for (const match of content.matchAll(/(?:\u00a5|\$)\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 80);
  }

  for (const match of content.matchAll(/(?:\u5408\u8ba1|\u603b\u8ba1|\u5171\u8ba1|\u603b\u989d|\u5c0f\u8ba1)[^0-9\n]{0,12}(?:\u00a5|\$)?\s*(\d+(?:\.\d{1,2})?)/g)) {
    pushCandidate(match[1], 70);
  }

  if (!candidates.length) {
    for (const match of content.matchAll(/(?:^|[^0-9])(\d+(?:\.\d{1,2})?)(?!\d)/g)) {
      pushCandidate(match[1], 10);
    }
  }

  if (!candidates.length) return 0;
  candidates.sort((a, b) => b.weight - a.weight || b.amount - a.amount);
  return candidates[0].amount;
};

const extractDate = (text = '') => {
  const content = String(text);
  const patterns = [
    /(20\d{2})[-/.\u5e74](\d{1,2})[-/.\u6708](\d{1,2})/,
    /(20\d{2})\s*(\d{1,2})\s*(\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
  }

  return normalizeDate(new Date());
};

const buildParsedBillFromText = (text = '', source = 'ocr') => {
  const classify = buildSimpleAiClassify(text);
  const amount = extractAmount(text);
  const date = extractDate(text);
  return {
    amount,
    type: classify.type,
    category: classify.category,
    merchant: '',
    remark: String(text).slice(0, 60),
    date,
    source: 'ocr',
    aiParsed: {
      source,
      rawText: text,
      confidence: classify.confidence,
      reason: classify.reason,
    },
  };
};
let sharedWorker = null;
let sharedWorkerInit = null;

const getWorker = async () => {
  if (sharedWorker) return sharedWorker;
  if (!sharedWorkerInit) {
    sharedWorkerInit = (async () => {
      return createWorker('chi_sim', 1, {
        logger: () => null,
      });
    })();
  }

  sharedWorker = await sharedWorkerInit;
  return sharedWorker;
};

const recognizeImage = async (filePath) => {
  const worker = await getWorker();
  const { data } = await worker.recognize(filePath);
  return String(data?.text || '').trim();
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

app.post('/api/functions/login', (req, res) => {
  try {
    const profile = sanitizeProfile(req.body?.data || {});
    const phoneCode = String(req.body?.phoneCode || profile.phoneCode || '').trim();
    const mode = String(req.body?.mode || 'wechat');
    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber || profile.phoneNumber || '');
    const password = normalizePassword(req.body?.password || profile.password || '');
    let user = getUserForRequest(req);

    if (mode === 'password') {
      const loginPhone = phoneNumber || '';
      if (!loginPhone) {
        return res.status(400).json({ success: false, message: 'missing phone number' });
      }

      if (!password) {
        return res.status(400).json({ success: false, message: 'missing password' });
      }

      const existing = db.prepare('SELECT * FROM users WHERE phoneNumber = ? LIMIT 1').get(loginPhone);
      if (!existing) {
        user = saveUser({
          nickname: profile.nickname || loginPhone,
          avatarUrl: profile.avatarUrl || '',
          phoneNumber: loginPhone,
          phoneCountryCode: profile.phoneCountryCode || '',
          password,
          openid: `local-${buildId('openid')}`,
          billCategories: DEFAULT_BILL_CATEGORIES,
        });
      } else {
        if (existing.password && existing.password !== password) {
          return res.status(401).json({ success: false, message: 'invalid password' });
        }

        user = saveUser({
          ...existing,
          phoneNumber: loginPhone,
          password,
          nickname: profile.nickname || existing.nickname || loginPhone,
          avatarUrl: profile.avatarUrl || existing.avatarUrl || '',
        });
      }

      const session = createSession(user.id);
      return res.json({
        success: true,
        data: {
          token: session.token,
          user: buildUserView(user),
          phoneCode,
        },
      });
    }

    if (!user) {
      user = saveUser({
        nickname: profile.nickname || '微信用户',
        avatarUrl: profile.avatarUrl || '',
        phoneNumber: profile.phoneNumber || '',
        phoneCountryCode: profile.phoneCountryCode || '',
        password,
        billCategories: DEFAULT_BILL_CATEGORIES,
      });
      const session = createSession(user.id);
      return res.json({
        success: true,
        data: {
          token: session.token,
          user: buildUserView(user),
          phoneCode,
        },
      });
    }

    const nextUser = saveUser({
      ...user,
      nickname: profile.nickname || user.nickname,
      avatarUrl: profile.avatarUrl || user.avatarUrl,
      phoneNumber: profile.phoneNumber || user.phoneNumber,
      phoneCountryCode: profile.phoneCountryCode || user.phoneCountryCode,
      password: password || user.password || '',
    });
    const token = getBearerToken(req);
    const session = token ? updateSessionUser(token, nextUser.id) : createSession(nextUser.id);

    return res.json({
      success: true,
      data: {
        token: session?.token || token,
        user: buildUserView(nextUser),
        phoneCode,
      },
    });
  } catch (error) {
    console.error('[login] failed', error);
    return res.status(500).json({
      success: false,
      message: 'login failed',
      detail: error?.stack || error?.message || String(error),
    });
  }
});

app.post('/api/functions/userSync', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      user: buildUserView(req.user),
    },
  });
});

app.post('/api/functions/categoryService', requireAuth, (req, res) => {
  const action = req.body?.action || 'get';
  const data = req.body?.data || {};
  const user = req.user;

  if (action === 'get') {
    return res.json({
      success: true,
      data: {
        categories: getCategoryData(user),
        user: buildUserView(user),
      },
    });
  }

  if (action === 'save') {
    const nextCategories = normalizeBillCategories(data.categories || {});
    const nextUser = saveUser({
      ...user,
      billCategories: nextCategories,
    });
    return res.json({
      success: true,
      data: {
        categories: nextCategories,
        user: buildUserView(nextUser),
      },
    });
  }

  if (action === 'reset') {
    const nextCategories = normalizeBillCategories(DEFAULT_BILL_CATEGORIES);
    const nextUser = saveUser({
      ...user,
      billCategories: nextCategories,
    });
    return res.json({
      success: true,
      data: {
        categories: nextCategories,
        user: buildUserView(nextUser),
      },
    });
  }

  return res.status(400).json({ success: false, message: 'unknown action' });
});

app.post('/api/functions/billService', requireAuth, (req, res) => {
  const action = req.body?.action || 'list';
  const data = req.body?.data || {};
  const userId = req.user.id;

  if (action === 'create') {
    const bill = saveBill(userId, data);
    return res.json({ success: true, data: { _id: bill.id, ...serializeBill(bill) } });
  }

  if (action === 'list') {
    const pageSize = Number(data.pageSize || data.limit || 20);
    const page = Number(data.page || 1);
    const bills = listBillsForUser(userId, data);
    const total = bills.length;
    const start = Math.max(page - 1, 0) * pageSize;
    const pageBills = Number(data.limit)
      ? bills.slice(0, Number(data.limit))
      : bills.slice(start, start + pageSize);

    return res.json({
      success: true,
      data: {
        list: pageBills.map(serializeBill),
        total,
        page,
        pageSize,
        hasMore: Number(data.limit) ? false : page * pageSize < total,
      },
    });
  }

  if (action === 'update') {
    if (!data._id) {
      return res.json({ success: false, message: 'missing _id' });
    }
    const bill = saveBill(userId, { ...data, _id: data._id });
    return res.json({ success: true, data: { _id: bill.id, ...serializeBill(bill) } });
  }

  if (action === 'delete') {
    if (!data._id) {
      return res.json({ success: false, message: 'missing _id' });
    }
    deleteBill(userId, data._id);
    return res.json({ success: true });
  }

  if (action === 'summary') {
    const bills = listBillsForUser(userId, data).map(serializeBill);
    return res.json({
      success: true,
      data: {
        periodType: data.year ? 'year' : 'month',
        year: data.year ? normalizeYear(data.year) : '',
        month: data.month ? normalizeMonth(data.month) : '',
        ...summarizeBills(bills, normalizeDate(new Date())),
      },
    });
  }

  return res.status(400).json({ success: false, message: 'unknown action' });
});

app.post('/api/functions/reportService', requireAuth, (req, res) => {
  const data = req.body?.data || {};
  const bills = listBillsForUser(req.user.id, data).map(serializeBill);
  const insight = buildReportInsight({
    bills,
    month: data.month,
    year: data.year,
    categories: getCategoryData(req.user),
  });

  return res.json({
    success: true,
    data: {
      ...insight,
      prompt: data.prompt || '',
    },
  });
});

app.post('/api/functions/aiClassify', requireAuth, (req, res) => {
  const text = String(req.body?.data?.text || '');
  const result = buildSimpleAiClassify(text);
  res.json({ success: true, data: result });
});

app.post('/api/functions/deepseekParse', requireAuth, (req, res) => {
  const text = String(req.body?.data?.text || '');
  const source = String(req.body?.data?.source || 'ocr');
  const parsedBill = buildParsedBillFromText(text, source);
  res.json({
    success: true,
    data: {
      bill: parsedBill,
      raw: text,
      provider: 'fallback',
      model: 'local-parser',
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    },
  });
});

app.post('/api/functions/aiAnalyze', requireAuth, (req, res) => {
  const data = req.body?.data || {};
  const range = buildDateRange(data);
  const currentBills = listBillsForUser(req.user.id, range).map(serializeBill);
  const previousBills = listBillsForUser(req.user.id, {
    ...range,
    month: range.periodType === 'month' ? range.prevStartDate.slice(0, 7) : '',
    year: range.periodType === 'year' ? String(Number(range.year) - 1) : '',
  }).map(serializeBill);

  const result = buildAiAnalysis({
    currentBills,
    previousBills,
    range,
  });

  db.prepare(`
    INSERT INTO ai_logs (id, userId, taskType, model, source, inputJson, outputJson, tokenUsageJson, status, errorMessage, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    buildId('ailog'),
    req.user.id,
    'spending_analysis',
    'local-parser',
    'bill_analysis',
    JSON.stringify(data),
    JSON.stringify(result.analysis),
    JSON.stringify({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    'success',
    '',
    nowIso(),
  );

  res.json({ success: true, data: result });
});

app.post('/api/ocr/recognize', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  const source = String(req.body?.source || 'wechat');
  const fileName = String(req.body?.fileName || file?.originalname || '');

  if (!file) {
    return res.status(400).json({ success: false, message: 'missing file' });
  }

  const tempTarget = `${file.path}.png`;
  try {
    fs.renameSync(file.path, tempTarget);
    const rawText = await recognizeImage(tempTarget);
    const parsedBill = buildParsedBillFromText(rawText, source);
    const cacheKey = `${source}:${fileName || path.basename(tempTarget)}`;

    db.prepare(`
      INSERT INTO ocr_logs (id, userId, cacheKey, fileName, source, rawText, resultJson, status, errorMessage, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      buildId('ocr'),
      req.user.id,
      cacheKey,
      fileName,
      source,
      rawText,
      JSON.stringify({ source, rawText, parsedBill, cacheKey }),
      'done',
      '',
      nowIso(),
      nowIso(),
    );

    res.json({
      success: true,
      data: {
        source,
        cacheHit: false,
        cacheKey,
        fileName,
        rawText,
        textLines: String(rawText).split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        parsedBill,
        confidence: parsedBill.amount > 0 ? 0.85 : 0.4,
        provider: 'tesseract',
        model: 'tesseract.js',
        ocrError: '',
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        aiResult: null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'OCR璇嗗埆澶辫触',
      detail: error?.message || String(error),
    });
  } finally {
    [file?.path, tempTarget].forEach((target) => {
      if (target && fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch (error) {
          void error;
        }
      }
    });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ success: true, data: { user: buildUserView(req.user) } });
});

app.use((error, _req, res, _next) => {
  console.error('[server] unhandled error', error);
  res.status(500).json({
    success: false,
    message: 'internal error',
    detail: error?.stack || error?.message || String(error),
  });
});

ensureTables();

app.listen(PORT, () => {
  console.log(`[server] listening on http://127.0.0.1:${PORT}`);
});

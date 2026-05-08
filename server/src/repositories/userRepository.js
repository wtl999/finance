// User repository: all session and profile persistence lives here.
const { db } = require('../db');
const { buildId, buildUserView, nowIso, normalizePassword, normalizePhoneNumber } = require('../lib');
const { DEFAULT_BILL_CATEGORIES, normalizeBillCategories } = require('../../miniprogram/utils/category');

const PERMANENT_EXPIRES_AT = '9999-12-31T23:59:59.999Z';

const getUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
const getUserByOpenId = (openid) => db.prepare('SELECT * FROM users WHERE openid = ?').get(openid) || null;
const getUserByPhoneNumber = (phoneNumber) =>
  db.prepare('SELECT * FROM users WHERE phoneNumber = ? ORDER BY updatedAt DESC LIMIT 1').get(normalizePhoneNumber(phoneNumber)) || null;
const getSessionByToken = (token) => db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) || null;

const createSession = (userId) => {
  const token = buildId('sess');
  const createdAt = nowIso();
  const expiresAt = PERMANENT_EXPIRES_AT;

  db.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    createdAt,
    expiresAt,
  );

  return { token, createdAt, expiresAt };
};

const updateSessionUser = (token, userId) => {
  const session = getSessionByToken(token);
  if (!session) return null;

  const expiresAt = PERMANENT_EXPIRES_AT;
  db.prepare('UPDATE sessions SET userId = ?, expiresAt = ? WHERE token = ?').run(userId, expiresAt, token);
  return getSessionByToken(token);
};

const getUserByToken = (token) => {
  const session = getSessionByToken(token);
  if (!session) return null;
  return getUserById(session.userId);
};

const parseBillCategories = (user) => {
  try {
    if (user?.billCategoriesJson) return JSON.parse(user.billCategoriesJson);
  } catch (error) {
    void error;
  }
  return DEFAULT_BILL_CATEGORIES;
};

const saveUser = (user = {}) => {
  const now = nowIso();
  const existing = user.id ? getUserById(user.id) : (user.openid ? getUserByOpenId(user.openid) : null);
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
    password: normalizePassword(user.password || existing?.password || ''),
    memberLevel: user.memberLevel || existing?.memberLevel || 'free',
    memberStatus: user.memberStatus || existing?.memberStatus || 'free',
    vipExpireTime: user.vipExpireTime || existing?.vipExpireTime || null,
    aiQuotaLimit: Number.isFinite(Number(user.aiQuotaLimit)) ? Number(user.aiQuotaLimit) : Number(existing?.aiQuotaLimit || 20),
    aiQuotaRemaining: Number.isFinite(Number(user.aiQuotaRemaining))
      ? Number(user.aiQuotaRemaining)
      : Number(existing?.aiQuotaRemaining || 20),
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
  return getUserById(record.id);
};

const syncUserView = (user = {}) => buildUserView(user);

module.exports = {
  createSession,
  getSessionByToken,
  getUserById,
  getUserByOpenId,
  getUserByPhoneNumber,
  getUserByToken,
  parseBillCategories,
  saveUser,
  syncUserView,
  updateSessionUser,
};

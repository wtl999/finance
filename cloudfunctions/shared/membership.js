const cloud = require('wx-server-sdk');

const FREE_AI_QUOTA_LIMIT = 20;
const MEMBER_LEVEL_FREE = 'free';
const MEMBER_LEVEL_VIP = 'vip';
const MEMBER_STATUS_FREE = 'free';
const MEMBER_STATUS_ACTIVE = 'active';
const MEMBER_STATUS_EXPIRED = 'expired';

const toDate = (value) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const pad = (value) => String(value).padStart(2, '0');

const getMonthKey = (value = new Date()) => {
  const date = toDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

const getMonthStartText = (value = new Date()) => `${getMonthKey(value)}-01`;

const sanitizeProfile = (profile = {}) => ({
  nickname: typeof profile.nickName === 'string'
    ? profile.nickName.trim()
    : (typeof profile.nickname === 'string' ? profile.nickname.trim() : ''),
  avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '',
  phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber.trim() : '',
  phoneCountryCode: typeof profile.phoneCountryCode === 'string' ? profile.phoneCountryCode.trim() : '',
});

const maskPhoneNumber = (value = '') => {
  const phone = String(value || '').trim();
  if (!phone) return '';
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
};

const normalizeQuotaLimit = (value) => {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return FREE_AI_QUOTA_LIMIT;
  return Math.floor(limit);
};

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

  const quotaLimit = normalizeQuotaLimit(user.aiQuotaLimit);
  const cycleKey = getMonthKey(currentTime);
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
    aiQuotaResetAt: getMonthStartText(currentTime),
  };
};

const buildUserDoc = ({
  existing = null,
  openid,
  appid,
  unionid,
  profile = {},
  now = new Date(),
  serverNow = now,
}) => {
  const normalizedProfile = sanitizeProfile(profile);
  const memberState = computeMemberState(existing || {}, now);
  const phoneNumber = normalizedProfile.phoneNumber || existing?.phoneNumber || '';
  const phoneCountryCode = normalizedProfile.phoneCountryCode || existing?.phoneCountryCode || '';

  return {
    openid,
    appid,
    unionid: unionid || '',
    nickname: normalizedProfile.nickname || existing?.nickname || '微信用户',
    avatarUrl: normalizedProfile.avatarUrl || existing?.avatarUrl || '',
    phoneNumber,
    phoneCountryCode,
    phoneBound: Boolean(phoneNumber),
    phoneNumberMasked: maskPhoneNumber(phoneNumber),
    memberLevel: existing?.memberLevel === MEMBER_LEVEL_VIP ? MEMBER_LEVEL_VIP : MEMBER_LEVEL_FREE,
    memberStatus: memberState.memberStatus,
    vipExpireTime: existing?.vipExpireTime || null,
    aiQuotaLimit: memberState.aiQuotaLimit,
    aiQuotaRemaining: memberState.aiQuotaRemaining,
    aiQuotaCycle: memberState.aiQuotaCycle,
    aiQuotaResetAt: memberState.aiQuotaResetAt,
    aiUsedTotal: Number(existing?.aiUsedTotal || 0),
    aiLastConsumeAt: existing?.aiLastConsumeAt || null,
    createdAt: existing?.createdAt || serverNow,
    updatedAt: serverNow,
  };
};

const buildViewUser = (doc = {}, now = new Date()) => {
  const state = computeMemberState(doc, now);
  const phoneNumber = doc.phoneNumber || '';

  return {
    ...doc,
    ...state,
    phoneBound: Boolean(phoneNumber),
    phoneNumberMasked: maskPhoneNumber(phoneNumber),
    aiQuotaRemainingText: state.aiUnlimited ? '无限' : String(state.aiQuotaRemaining),
    memberLabel: state.aiUnlimited ? '会员' : (state.memberStatus === MEMBER_STATUS_EXPIRED ? '已过期' : '免费'),
  };
};

const ensureUsersCollection = async (db) => {
  try {
    await db.createCollection('users');
  } catch (error) {
    const errMsg = String(error?.errMsg || error?.message || error || '');
    if (/resourceexist|already exists|table exist|collection already exists|exists/i.test(errMsg)) {
      return;
    }

    throw error;
  }
};

const getUserByOpenId = async (db, openid) => {
  const result = await db.collection('users').where({ openid }).limit(1).get();
  return result.data[0] || null;
};

const resolvePhoneInfo = async (phoneCode) => {
  if (!phoneCode) return null;

  const response = await cloud.openapi.phonenumber.getPhoneNumber({
    code: phoneCode,
  });

  const phoneInfo = response?.phoneInfo
    || response?.result?.phoneInfo
    || response?.data?.phoneInfo
    || response?.phone_info
    || null;

  if (!phoneInfo) return null;

  return {
    phoneNumber: String(phoneInfo.phoneNumber || phoneInfo.purePhoneNumber || '').trim(),
    phoneCountryCode: String(phoneInfo.countryCode || '').trim(),
    raw: phoneInfo,
  };
};

const ensureUserMembership = async ({
  db,
  openid,
  appid,
  unionid,
  profile = {},
  now = new Date(),
  serverNow = now,
}) => {
  const existing = await getUserByOpenId(db, openid);
  const doc = buildUserDoc({
    existing,
    openid,
    appid,
    unionid,
    profile,
    now,
    serverNow,
  });

  let saved = doc;
  if (existing) {
    await db.collection('users').doc(existing._id).update({ data: doc });
    saved = { ...doc, _id: existing._id };
  } else {
    const created = await db.collection('users').add({ data: doc });
    saved = { ...doc, _id: created._id };
  }

  return {
    success: true,
    user: buildViewUser(saved, now),
  };
};

const upsertUserProfile = async ({
  db,
  openid,
  appid,
  unionid,
  profile = {},
  phoneCode = '',
  now = new Date(),
  serverNow = now,
}) => {
  const phoneInfo = phoneCode ? await resolvePhoneInfo(phoneCode) : null;
  const mergedProfile = {
    ...profile,
    ...(phoneInfo?.phoneNumber
      ? {
          phoneNumber: phoneInfo.phoneNumber,
          phoneCountryCode: phoneInfo.phoneCountryCode,
        }
      : {}),
  };

  return ensureUserMembership({
    db,
    openid,
    appid,
    unionid,
    profile: mergedProfile,
    now,
    serverNow,
  });
};

const syncUserMembership = async ({ db, openid, now = new Date(), serverNow = now }) => {
  const existing = await getUserByOpenId(db, openid);
  if (!existing) {
    return null;
  }

  const doc = buildUserDoc({
    existing,
    openid: existing.openid,
    appid: existing.appid,
    unionid: existing.unionid,
    profile: {
      nickName: existing.nickname,
      avatarUrl: existing.avatarUrl,
      phoneNumber: existing.phoneNumber,
      phoneCountryCode: existing.phoneCountryCode,
    },
    now,
    serverNow,
  });

  await db.collection('users').doc(existing._id).update({ data: doc });

  return {
    success: true,
    user: buildViewUser({ ...doc, _id: existing._id }, now),
  };
};

const checkAiPermission = async ({ db, openid, need = 1, now = new Date(), serverNow = now }) => {
  const synced = await syncUserMembership({ db, openid, now, serverNow });
  if (!synced || !synced.user) {
    return {
      allowed: false,
      reason: 'USER_NOT_FOUND',
      message: '用户不存在',
      user: null,
    };
  }

  const user = synced.user;
  if (user.aiUnlimited) {
    return {
      allowed: true,
      reason: 'VIP_UNLIMITED',
      user,
    };
  }

  const remaining = Number(user.aiQuotaRemaining || 0);
  if (remaining < need) {
    return {
      allowed: false,
      reason: 'AI_QUOTA_EXCEEDED',
      message: 'AI 次数不足，请开通会员',
      user,
    };
  }

  return {
    allowed: true,
    reason: 'QUOTA_OK',
    user,
  };
};

const consumeAiQuota = async ({ db, openid, amount = 1, now = new Date(), serverNow = now }) => {
  const existing = await getUserByOpenId(db, openid);
  if (!existing) return null;

  const synced = buildViewUser(
    buildUserDoc({
      existing,
      openid: existing.openid,
      appid: existing.appid,
      unionid: existing.unionid,
      profile: {
        nickName: existing.nickname,
        avatarUrl: existing.avatarUrl,
        phoneNumber: existing.phoneNumber,
        phoneCountryCode: existing.phoneCountryCode,
      },
      now,
      serverNow,
    }),
    now,
  );

  const nextUsedTotal = Number(existing.aiUsedTotal || 0) + amount;
  const updateData = {
    aiUsedTotal: nextUsedTotal,
    aiLastConsumeAt: serverNow,
    updatedAt: serverNow,
  };

  if (!synced.aiUnlimited) {
    const currentRemaining = Number(synced.aiQuotaRemaining || 0);
    updateData.aiQuotaRemaining = Math.max(0, currentRemaining - amount);
  }

  await db.collection('users').doc(existing._id).update({
    data: updateData,
  });

  return {
    success: true,
  };
};

module.exports = {
  FREE_AI_QUOTA_LIMIT,
  MEMBER_LEVEL_FREE,
  MEMBER_LEVEL_VIP,
  MEMBER_STATUS_FREE,
  MEMBER_STATUS_ACTIVE,
  MEMBER_STATUS_EXPIRED,
  buildUserDoc,
  buildViewUser,
  checkAiPermission,
  computeMemberState,
  consumeAiQuota,
  ensureUserMembership,
  ensureUsersCollection,
  getMonthKey,
  maskPhoneNumber,
  resolvePhoneInfo,
  sanitizeProfile,
  syncUserMembership,
  upsertUserProfile,
};

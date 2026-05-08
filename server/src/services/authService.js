// Auth service: login, profile sync, and user view shaping.
const { buildUserView, normalizePassword, normalizePhoneNumber, sanitizeProfile } = require('../lib');
const { createSession, getUserByPhoneNumber, saveUser } = require('../repositories/userRepository');
const { exchangeCodeForSession } = require('./wechatAuth');

const login = async ({ currentUser = null, profile = {}, phoneCode = '', mode = 'wechat', wxLoginCode = '' } = {}) => {
  const normalized = sanitizeProfile(profile);
  const phoneNumber = normalizePhoneNumber(profile.phoneNumber || currentUser?.phoneNumber || '');
  const password = normalizePassword(profile.password || currentUser?.password || '');

  let nextUser = currentUser;

  if (mode === 'password') {
    if (!phoneNumber) {
      return { token: null, phoneCode, user: null, message: 'missing phone number' };
    }
    if (!password) {
      return { token: null, phoneCode, user: null, message: 'missing password' };
    }

    const existing = getUserByPhoneNumber(phoneNumber);
    if (existing && existing.password && existing.password !== password) {
      return { token: null, phoneCode, user: null, message: 'invalid password' };
    }

    nextUser = saveUser({
      ...(existing || {}),
      nickname: normalized.nickname || existing?.nickname || phoneNumber,
      avatarUrl: normalized.avatarUrl || existing?.avatarUrl || '',
      phoneNumber,
      phoneCountryCode: normalized.phoneCountryCode || existing?.phoneCountryCode || '',
      password,
    });
  } else {
    const wxSession = wxLoginCode ? await exchangeCodeForSession(wxLoginCode) : null;
    nextUser = saveUser({
      ...(currentUser || {}),
      nickname: normalized.nickname || currentUser?.nickname || '微信用户',
      avatarUrl: normalized.avatarUrl || currentUser?.avatarUrl || '',
      phoneNumber: normalized.phoneNumber || currentUser?.phoneNumber || '',
      phoneCountryCode: normalized.phoneCountryCode || currentUser?.phoneCountryCode || '',
      password,
      openid: wxSession?.openid || normalized.openid || currentUser?.openid || `wx-${wxLoginCode || Date.now()}`,
      appid: wxSession?.appid || currentUser?.appid || '',
      unionid: wxSession?.unionid || currentUser?.unionid || '',
    });
  }

  const session = createSession(nextUser.id);
  return {
    token: session?.token || null,
    phoneCode,
    user: buildUserView(nextUser),
    mode,
    wxLoginCode,
  };
};

const updateProfile = ({ currentUser, profile = {}, phoneCode = '' } = {}) => {
  const normalized = sanitizeProfile(profile);
  const nextUser = saveUser({
    ...currentUser,
    nickname: normalized.nickname || currentUser?.nickname,
    avatarUrl: normalized.avatarUrl || currentUser?.avatarUrl,
    phoneNumber: normalized.phoneNumber || currentUser?.phoneNumber,
    phoneCountryCode: normalized.phoneCountryCode || currentUser?.phoneCountryCode,
    password: normalized.password || currentUser?.password,
  });

  return {
    phoneCode,
    user: buildUserView(nextUser),
  };
};

const syncCurrentUser = (currentUser) => ({
  user: buildUserView(currentUser),
});

module.exports = {
  getUserByPhoneNumber,
  login,
  syncCurrentUser,
  updateProfile,
};

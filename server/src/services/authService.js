// Auth service: login, profile sync, and user view shaping.
const { buildUserView, sanitizeProfile } = require('../lib');
const { createSession, getUserByPhoneNumber, saveUser } = require('../repositories/userRepository');

const login = ({ currentUser = null, profile = {}, phoneCode = '' } = {}) => {
  const normalized = sanitizeProfile(profile);
  const nextUser = saveUser({
    ...(currentUser || {}),
    nickname: normalized.nickname || currentUser?.nickname || '微信用户',
    avatarUrl: normalized.avatarUrl || currentUser?.avatarUrl || '',
    phoneNumber: normalized.phoneNumber || currentUser?.phoneNumber || '',
    phoneCountryCode: normalized.phoneCountryCode || currentUser?.phoneCountryCode || '',
  });

  const session = currentUser ? null : createSession(nextUser.id);
  return {
    token: session?.token || null,
    phoneCode,
    user: buildUserView(nextUser),
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

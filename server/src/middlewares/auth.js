// Auth middleware: parse bearer token and attach the current user.
const { getUserByToken } = require('../repositories/userRepository');

const getBearerToken = (req) => {
  const raw = req.headers.authorization || '';
  const match = String(raw).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const requireAuth = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }

  const user = getUserByToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }

  req.user = user;
  req.token = token;
  next();
};

module.exports = {
  getBearerToken,
  requireAuth,
};

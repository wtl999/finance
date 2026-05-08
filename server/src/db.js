const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'finance.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  openid TEXT UNIQUE,
  appid TEXT,
  unionid TEXT,
  nickname TEXT,
  avatarUrl TEXT,
  phoneNumber TEXT,
  phoneCountryCode TEXT,
  password TEXT,
  memberLevel TEXT,
  memberStatus TEXT,
  vipExpireTime TEXT,
  aiQuotaLimit INTEGER,
  aiQuotaRemaining INTEGER,
  aiQuotaCycle TEXT,
  aiQuotaResetAt TEXT,
  aiUsedTotal INTEGER,
  aiLastConsumeAt TEXT,
  billCategoriesJson TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  merchant TEXT,
  remark TEXT,
  date TEXT NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  source TEXT NOT NULL,
  aiParsedJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  taskType TEXT NOT NULL,
  model TEXT,
  source TEXT,
  inputJson TEXT,
  outputJson TEXT,
  tokenUsageJson TEXT,
  status TEXT NOT NULL,
  errorMessage TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ocr_logs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  cacheKey TEXT,
  fileName TEXT,
  source TEXT,
  rawText TEXT,
  resultJson TEXT,
  status TEXT NOT NULL,
  errorMessage TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

module.exports = {
  db,
};

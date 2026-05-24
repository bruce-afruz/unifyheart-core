const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'unifyheart.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guid TEXT UNIQUE NOT NULL,
  lang TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  breaking INTEGER DEFAULT 0,
  hero INTEGER DEFAULT 0,
  sent_push INTEGER DEFAULT 0,
  sent_telegram INTEGER DEFAULT 0,
  sent_ntfy INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_lang_published ON articles(lang, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic);
CREATE INDEX IF NOT EXISTS idx_articles_hero ON articles(hero, published_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  topics TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TEXT,
  failed_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  topics TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  confirmed INTEGER DEFAULT 0,
  confirm_token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  path TEXT NOT NULL,
  lang TEXT,
  country TEXT,
  referrer TEXT,
  is_bot INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pv_ts   ON page_views(ts);
CREATE INDEX IF NOT EXISTS idx_pv_path ON page_views(path);

CREATE TABLE IF NOT EXISTS alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  channel TEXT NOT NULL,
  article_id INTEGER,
  recipients INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_ts ON alert_log(ts);

CREATE TABLE IF NOT EXISTS section_settings (
  key TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS donation_orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  lang TEXT DEFAULT 'all',
  logo_url TEXT,
  enabled INTEGER DEFAULT 1,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apns_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  topics TEXT,
  platform TEXT DEFAULT 'ios',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TEXT,
  failed_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feed_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,
  ok INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  skipped_no_image INTEGER DEFAULT 0,
  skipped_off_mission INTEGER DEFAULT 0,
  skipped_negative INTEGER DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedruns_ts ON feed_runs(ts);
`);

// Seed default section settings (all on)
const DEFAULT_SECTIONS = ['ticker','hero','impact','mission','featured','grid','quote','causes','alerts','trust'];
const seedSection = db.prepare('INSERT OR IGNORE INTO section_settings(key, enabled) VALUES(?, 1)');
for (const k of DEFAULT_SECTIONS) seedSection.run(k);

// ---- Lightweight migrations (add columns if missing) ----
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  }
}
ensureColumn('page_views', 'ua', 'TEXT');
ensureColumn('page_views', 'device', 'TEXT');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}

module.exports = { db, getSetting, setSetting };

const crypto = require('crypto');
const { db, getSetting, setSetting } = require('./db');

const SESSION_DAYS = 30;
const COOKIE_NAME = 'uh_admin';

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64, { N: 16384 }).toString('hex');
}

function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tsAddDays(d) {
  return new Date(Date.now() + d * 86400000).toISOString();
}

function createUser(username, password) {
  const salt = newSalt();
  const hash = hashPassword(password, salt);
  const res = db
    .prepare('INSERT INTO admin_users(username, salt, password_hash) VALUES(?, ?, ?)')
    .run(username, salt, hash);
  return res.lastInsertRowid;
}

function verifyUser(username, password) {
  const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!row) return null;
  const candidate = hashPassword(password, row.salt);
  if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(row.password_hash, 'hex'))) return null;
  db.prepare('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
  return row;
}

function createSession(userId) {
  const token = newToken();
  db.prepare('INSERT INTO admin_sessions(token, user_id, expires_at) VALUES(?, ?, ?)').run(token, userId, tsAddDays(SESSION_DAYS));
  return token;
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

function getSessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare(`SELECT u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
              WHERE s.token = ? AND s.expires_at > datetime('now')`)
    .get(token);
  return row || null;
}

function readCookie(req, name) {
  const c = req.headers.cookie;
  if (!c) return null;
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push('Path=/admin', 'HttpOnly', 'SameSite=Lax');
  if (opts.secure !== false) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/admin; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

function adminCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM admin_users').get().n;
}

function ensureSetupToken() {
  let tok = getSetting('admin_setup_token');
  if (adminCount() === 0) {
    if (!tok) {
      tok = newToken().slice(0, 24);
      setSetting('admin_setup_token', tok);
      console.log(`\n  ========================================================`);
      console.log(`  ADMIN FIRST-TIME SETUP TOKEN: ${tok}`);
      console.log(`  Visit  /admin/setup?token=${tok}  to create the first admin.`);
      console.log(`  ========================================================\n`);
    }
    return tok;
  }
  if (tok) setSetting('admin_setup_token', '');
  return null;
}

// Middleware
function requireAdmin(req, res, next) {
  const token = readCookie(req, COOKIE_NAME);
  const user = getSessionUser(token);
  if (!user) {
    if (req.method === 'GET' && req.accepts && req.accepts('html')) {
      return res.redirect(302, '/admin/login');
    }
    return res.status(401).type('text').send('Unauthorized');
  }
  req.adminUser = user;
  next();
}

module.exports = {
  COOKIE_NAME, SESSION_DAYS,
  createUser, verifyUser, createSession, destroySession, getSessionUser,
  readCookie, setCookie, clearCookie,
  adminCount, ensureSetupToken, requireAdmin,
};

// Apple Push Notification service (APNs) sender.
// Uses HTTP/2 + ES256 JWT signed with Node's built-in crypto — no third-party deps.
// No-op until env is configured, so the app runs fine before the iOS app exists.
const http2 = require('http2');
const crypto = require('crypto');
const fs = require('fs');
const { db } = require('./db');

const KEY_ID    = process.env.APNS_KEY_ID || '';
const TEAM_ID   = process.env.APNS_TEAM_ID || '';
const BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.unifyheart.app';
const KEY_PATH  = process.env.APNS_KEY_PATH || '';        // path to AuthKey_XXXX.p8
const KEY_P8    = process.env.APNS_KEY_P8 || '';          // or PEM contents directly
const PRODUCTION = String(process.env.APNS_PRODUCTION || 'true') === 'true';
const HOST = PRODUCTION ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

function loadKey() {
  try {
    if (KEY_P8) return KEY_P8;
    if (KEY_PATH && fs.existsSync(KEY_PATH)) return fs.readFileSync(KEY_PATH, 'utf8');
  } catch {}
  return '';
}
const PRIVATE_KEY = loadKey();
const CONFIGURED = !!(KEY_ID && TEAM_ID && PRIVATE_KEY);

if (!CONFIGURED) {
  console.log('[apns] not configured (set APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH) — iOS push disabled');
}

// --- JWT (cached, refreshed every ~40 min; APNs requires 20–60 min) ---
let cachedToken = null;
let cachedAt = 0;
function authToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && (Date.now() - cachedAt) < 40 * 60 * 1000) return cachedToken;
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: PRIVATE_KEY,
    dsaEncoding: 'ieee-p1363', // JOSE (r||s) format required for ES256
  });
  cachedToken = `${signingInput}.${b64url(signature)}`;
  cachedAt = Date.now();
  return cachedToken;
}
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const delTok   = db.prepare('DELETE FROM apns_tokens WHERE token = ?');
const failTok  = db.prepare('UPDATE apns_tokens SET failed_count = failed_count + 1 WHERE token = ?');
const sentTok  = db.prepare('UPDATE apns_tokens SET last_sent_at = CURRENT_TIMESTAMP WHERE token = ?');

function sendOne(client, deviceToken, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${authToken()}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });
    let status = 0, data = '';
    req.on('response', (h) => { status = h[':status']; });
    req.setEncoding('utf8');
    req.on('data', (d) => { data += d; });
    req.on('end', () => {
      if (status === 200) { sentTok.run(deviceToken); resolve(true); }
      else {
        if (status === 410 || /BadDeviceToken|Unregistered/.test(data)) delTok.run(deviceToken);
        else failTok.run(deviceToken);
        resolve(false);
      }
    });
    req.on('error', () => { failTok.run(deviceToken); resolve(false); });
    req.end(body);
  });
}

async function sendToAll(article) {
  if (!CONFIGURED) return 0;
  const rows = db.prepare('SELECT token FROM apns_tokens WHERE lang = ?').all(article.lang);
  if (!rows.length) return 0;

  const client = http2.connect(HOST);
  client.on('error', () => {});
  const payload = {
    aps: {
      alert: { title: article.title, body: (article.summary || '').slice(0, 160) },
      sound: 'default',
      'thread-id': article.topic || 'unifyheart',
      'interruption-level': article.breaking ? 'time-sensitive' : 'active',
    },
    url: `https://unifyheart.com/${article.lang}/article/${article.id}`,
    topic: article.topic,
  };

  let sent = 0;
  for (const row of rows) {
    if (await sendOne(client, row.token, payload)) sent++;
  }
  client.close();
  return sent;
}

function saveToken(token, lang, topics, platform = 'ios') {
  if (!token || typeof token !== 'string' || token.length < 32) return false;
  db.prepare(`INSERT INTO apns_tokens(token, lang, topics, platform)
              VALUES(?, ?, ?, ?)
              ON CONFLICT(token) DO UPDATE SET lang=excluded.lang, topics=excluded.topics`)
    .run(token, lang || 'en', JSON.stringify(topics || []), platform);
  return true;
}

module.exports = { CONFIGURED, sendToAll, saveToken };

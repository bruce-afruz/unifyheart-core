const webpush = require('web-push');
const { db, getSetting, setSetting } = require('./db');

const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@unifyheart.com';

function ensureVapidKeys() {
  let publicKey = process.env.VAPID_PUBLIC_KEY || getSetting('vapid_public');
  let privateKey = process.env.VAPID_PRIVATE_KEY || getSetting('vapid_private');
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    setSetting('vapid_public', publicKey);
    setSetting('vapid_private', privateKey);
    console.log('[push] generated new VAPID keys');
  }
  webpush.setVapidDetails(SUBJECT, publicKey, privateKey);
  return { publicKey, privateKey };
}

const { publicKey: VAPID_PUBLIC } = ensureVapidKeys();

const insertSub = db.prepare(`
  INSERT INTO push_subscriptions(endpoint, p256dh, auth, lang, topics)
  VALUES(?, ?, ?, ?, ?)
  ON CONFLICT(endpoint) DO UPDATE SET lang=excluded.lang, topics=excluded.topics
`);

const deleteSub = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
const incFail   = db.prepare('UPDATE push_subscriptions SET failed_count = failed_count + 1 WHERE endpoint = ?');
const touchSent = db.prepare('UPDATE push_subscriptions SET last_sent_at = CURRENT_TIMESTAMP WHERE endpoint = ?');

function saveSubscription(sub, lang, topics) {
  if (!sub || !sub.endpoint || !sub.keys) return false;
  insertSub.run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, lang || 'en', JSON.stringify(topics || []));
  return true;
}

async function sendToSubscription(row, payload) {
  const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    touchSent.run(row.endpoint);
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      deleteSub.run(row.endpoint);
    } else {
      incFail.run(row.endpoint);
    }
    return false;
  }
}

async function broadcast(article) {
  const rows = db.prepare('SELECT * FROM push_subscriptions WHERE lang = ?').all(article.lang);
  const payload = {
    title: article.title,
    body: article.summary?.slice(0, 160) || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    image: article.image_url || undefined,
    tag: `uh-${article.id}`,
    url: `/${article.lang}/article/${article.id}`,
    timestamp: Date.now(),
  };
  let sent = 0;
  for (const row of rows) {
    if (await sendToSubscription(row, payload)) sent++;
  }
  return sent;
}

module.exports = { VAPID_PUBLIC, saveSubscription, broadcast };

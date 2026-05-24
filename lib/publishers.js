const { db } = require('./db');
const { broadcast } = require('./push');
const apns = require('./apns');

const SITE_URL = process.env.SITE_URL || 'https://unifyheart.com';
const NTFY_BASE = process.env.NTFY_BASE || ''; // e.g. https://ntfy.unifyheart.com  (empty = skip)
const TG_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHANS  = {
  en: process.env.TELEGRAM_CHANNEL_EN || '',
  tr: process.env.TELEGRAM_CHANNEL_TR || '',
  fr: process.env.TELEGRAM_CHANNEL_FR || '',
};

const markPush = db.prepare('UPDATE articles SET sent_push = 1 WHERE id = ?');
const markTg   = db.prepare('UPDATE articles SET sent_telegram = 1 WHERE id = ?');
const markNtfy = db.prepare('UPDATE articles SET sent_ntfy = 1 WHERE id = ?');
const logAlert = db.prepare('INSERT INTO alert_log(channel, article_id, recipients, succeeded, failed, note) VALUES(?,?,?,?,?,?)');

async function pushNtfy(article) {
  if (!NTFY_BASE) return false;
  const topic = `unifyheart-${article.lang}${article.breaking ? '-breaking' : ''}`;
  const url = `${NTFY_BASE.replace(/\/$/, '')}/${topic}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': article.title.slice(0, 200),
        'Tags': article.topic,
        'Click': `${SITE_URL}/${article.lang}/article/${article.id}`,
        ...(article.image_url ? { 'Attach': article.image_url } : {}),
        ...(article.breaking ? { 'Priority': 'high' } : {}),
      },
      body: (article.summary || '').slice(0, 400),
    });
    return res.ok;
  } catch { return false; }
}

async function pushTelegram(article) {
  const chat = TG_CHANS[article.lang];
  if (!TG_TOKEN || !chat) return false;
  const link = `${SITE_URL}/${article.lang}/article/${article.id}`;
  const text = `*${article.title}*\n\n${article.summary || ''}\n\n[${article.source}](${link})`;
  try {
    const method = article.image_url ? 'sendPhoto' : 'sendMessage';
    const body = article.image_url
      ? { chat_id: chat, photo: article.image_url, caption: text, parse_mode: 'Markdown' }
      : { chat_id: chat, text, parse_mode: 'Markdown', disable_web_page_preview: false };
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

async function publishNewArticle(article) {
  // Only push instantly for breaking stories. Non-breaking go via digest.
  if (article.breaking) {
    try {
      const n = await broadcast(article);
      if (n) markPush.run(article.id);
      logAlert.run('push', article.id, n, n, 0, article.lang);
    } catch (e) { logAlert.run('push', article.id, 0, 0, 0, 'err: ' + e.message); }
    // iOS app (APNs) — breaking only, matches launch scope
    try {
      const m = await apns.sendToAll(article);
      if (m) logAlert.run('apns', article.id, m, m, 0, article.lang);
    } catch (e) { logAlert.run('apns', article.id, 0, 0, 0, 'err: ' + e.message); }
  }
  if (await pushNtfy(article))     { markNtfy.run(article.id); logAlert.run('ntfy', article.id, 1, 1, 0, article.lang); }
  if (await pushTelegram(article)) { markTg.run(article.id);   logAlert.run('telegram', article.id, 1, 1, 0, article.lang); }
}

module.exports = { publishNewArticle };

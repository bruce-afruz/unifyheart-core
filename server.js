const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db } = require('./lib/db');
const { detectLocale, SUPPORTED, DEFAULT, t } = require('./lib/i18n');
const { VAPID_PUBLIC, saveSubscription } = require('./lib/push');
const { homepage, articlePage, esc } = require('./lib/render');
const { runAggregation } = require('./lib/aggregator');
const adminRoutes = require('./lib/admin-routes');
const { ensureSetupToken } = require('./lib/admin-auth');

const PORT = Number(process.env.PORT) || 3001;
const SITE_URL = process.env.SITE_URL || 'https://unifyheart.com';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

// ---------- Admin (mounted before page-view logging so admin traffic isn't recorded) ----------
app.use('/admin', adminRoutes);

// ---------- Page-view logging (public pages only, non-static) ----------
// Bot signals: declared crawlers, scraping libraries, link-preview/monitor agents, headless browsers.
const BOT_UA_RX = /bot\b|bot\/|crawler|spider|crawl|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|discordbot|slackbot|linkedinbot|embedly|quora link|pinterest|redditbot|applebot|petalbot|yandex|baiduspider|duckduckbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|preview|monitor|uptime|pingdom|statuscake|headless|phantomjs|puppeteer|playwright|lighthouse|gtmetrix|curl|wget|python-requests|python-urllib|go-http|node-fetch|axios|okhttp|java\/|libwww|httpclient|scrapy|http_request/i;

function detectDevice(ua, isBot) {
  if (isBot) return 'bot';
  if (/\b(ipad|tablet|kindle|silk|playbook)\b/i.test(ua)) return 'tablet';
  if (/\b(mobi|iphone|android.*mobile|windows phone|ipod)\b/i.test(ua)) return 'mobile';
  if (/android/i.test(ua)) return 'tablet'; // Android without "mobile" = tablet
  if (!ua) return 'unknown';
  return 'desktop';
}

const logPV = db.prepare('INSERT INTO page_views(path, lang, country, referrer, is_bot, ua, device) VALUES(?, ?, ?, ?, ?, ?, ?)');
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path === '/healthz' || req.path === '/sw.js' || req.path === '/manifest.webmanifest') return next();
  if (req.path.match(/\.(png|jpe?g|webp|svg|ico|css|js|xml|txt|webmanifest|map)$/i)) return next();
  const ua = (req.headers['user-agent'] || '').toString();
  // A request with no UA, or no Accept-Language, that isn't a known browser is very likely automated.
  const noBrowserHints = !ua || (!req.headers['accept-language'] && !/mozilla/i.test(ua));
  const isBot = (BOT_UA_RX.test(ua) || noBrowserHints) ? 1 : 0;
  const device = detectDevice(ua, isBot);
  const cc = (req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '').toString().toUpperCase().slice(0, 2);
  const langMatch = req.path.match(/^\/(en|tr|fr)\b/);
  const lang = langMatch ? langMatch[1] : null;
  setImmediate(() => {
    try { logPV.run(req.path.slice(0, 200), lang, cc || null, (req.headers.referer || '').slice(0, 200), isBot, ua.slice(0, 300), device); } catch {}
  });
  next();
});

// ---------- Static ----------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders(res, p) {
    if (p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// ---------- Helpers ----------
function listLatest({ lang, limit = 24, offset = 0, topic = null }) {
  // We only ever show stories that carry an image — mission requirement.
  const cond = ['lang = ?', "image_url IS NOT NULL", "image_url != ''"];
  const args = [lang];
  if (topic) { cond.push('topic = ?'); args.push(topic); }
  args.push(limit, offset);
  return db.prepare(
    `SELECT * FROM articles WHERE ${cond.join(' AND ')} ORDER BY published_at DESC LIMIT ? OFFSET ?`
  ).all(...args);
}

function rssFeed(lang) {
  const rows = listLatest({ lang, limit: 50 });
  const dict = require('./locales/' + lang + '.json');
  const items = rows.map((a) => `
    <item>
      <title>${esc(a.title)}</title>
      <link>${SITE_URL}/${lang}/article/${a.id}</link>
      <guid isPermaLink="false">${esc(a.guid)}</guid>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      <source url="${SITE_URL}/${lang}">${esc(a.source)}</source>
      <category>${esc(a.topic)}</category>
      <description><![CDATA[${a.summary || ''}]]></description>
      ${a.image_url ? `<enclosure url="${esc(a.image_url)}" type="image/jpeg"/>` : ''}
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>UnifyHeart — ${esc(dict.tagline)}</title>
  <link>${SITE_URL}/${lang}</link>
  <atom:link href="${SITE_URL}/rss/${lang}.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(dict.subtagline)}</description>
  <language>${lang}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;
}

// ---------- Routes ----------
app.get('/', (req, res) => {
  const lang = detectLocale(req);
  res.redirect(302, `/${lang}`);
});

app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: 'UnifyHeart',
    short_name: 'UnifyHeart',
    description: 'Connecting compassion with action',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ef4444',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }));
});

app.get('/api/vapid-public-key', (req, res) => res.type('text/plain').send(VAPID_PUBLIC));

app.post('/api/subscribe/push', (req, res) => {
  const { subscription, lang, topics } = req.body || {};
  const langOk = SUPPORTED.includes(lang) ? lang : DEFAULT;
  if (!saveSubscription(subscription, langOk, topics)) return res.status(400).json({ ok: false });
  res.json({ ok: true });
});

app.post('/api/subscribe/email', (req, res) => {
  const { email, lang, frequency, topics } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'invalid_email' });
  const langOk = SUPPORTED.includes(lang) ? lang : DEFAULT;
  const freq = ['daily', 'weekly', 'breaking'].includes(frequency) ? frequency : 'daily';
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(`
    INSERT INTO email_subscriptions(email, lang, frequency, topics, confirm_token)
    VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET lang=excluded.lang, frequency=excluded.frequency, topics=excluded.topics
  `).run(email.toLowerCase(), langOk, freq, JSON.stringify(topics || []), token);
  res.json({ ok: true });
});

app.get('/rss/:lang.xml', (req, res) => {
  const lang = SUPPORTED.includes(req.params.lang) ? req.params.lang : DEFAULT;
  res.type('application/rss+xml').send(rssFeed(lang));
});

// iOS app push-token registration (APNs)
app.post('/api/subscribe/apns', (req, res) => {
  const { token, lang, topics } = req.body || {};
  const { saveToken } = require('./lib/apns');
  const langOk = SUPPORTED.includes(lang) ? lang : DEFAULT;
  if (!saveToken(token, langOk, topics)) return res.status(400).json({ ok: false });
  res.json({ ok: true });
});

// Email double opt-in confirmation
app.get('/confirm', (req, res) => {
  const { confirmPage } = require('./lib/render');
  const token = (req.query.token || '').toString();
  const row = token ? db.prepare('SELECT * FROM email_subscriptions WHERE confirm_token = ?').get(token) : null;
  let lang = DEFAULT, ok = false;
  if (row) {
    db.prepare("UPDATE email_subscriptions SET confirmed = 1, confirm_token = NULL WHERE id = ?").run(row.id);
    lang = SUPPORTED.includes(row.lang) ? row.lang : DEFAULT;
    ok = true;
  } else {
    lang = detectLocale(req);
  }
  res.status(ok ? 200 : 400).send(confirmPage({ lang, ok }));
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  const topics = ['rights','humanitarian','refugees','press','women','children','health','climate'];
  const urls = [];
  const add = (loc, changefreq, priority, lastmod) =>
    urls.push(`  <url><loc>${SITE_URL}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);

  for (const lang of SUPPORTED) {
    add(`/${lang}`, 'hourly', '1.0');
    add(`/${lang}/donate`, 'weekly', '0.4');
    for (const tp of topics) add(`/${lang}/topic/${tp}`, 'daily', '0.6');
  }
  // Recent articles (cap to keep sitemap lean; Search Console handles 50k max)
  const arts = db.prepare(
    "SELECT id, lang, published_at FROM articles WHERE image_url IS NOT NULL AND image_url != '' ORDER BY published_at DESC LIMIT 2000"
  ).all();
  for (const a of arts) {
    add(`/${a.lang}/article/${a.id}`, 'weekly', '0.7', new Date(a.published_at).toISOString());
  }

  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
});

function loadSectionToggles() {
  const rows = db.prepare('SELECT key, enabled FROM section_settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, !!r.enabled]));
}

function topicCounts(lang) {
  const ids = ['rights','humanitarian','refugees','press','women','children','health','climate'];
  const out = {};
  const stmt = db.prepare(
    "SELECT COUNT(*) AS n FROM articles WHERE lang = ? AND topic = ? AND image_url IS NOT NULL AND image_url != ''"
  );
  for (const id of ids) out[id] = stmt.get(lang, id)?.n || 0;
  return out;
}

function siteImpactStats() {
  const totalSources = new Set(require('./lib/feeds').map((f) => f.source)).size;
  const total = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE image_url IS NOT NULL AND image_url != ''").get().n;
  const last24 = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE image_url IS NOT NULL AND image_url != '' AND published_at > datetime('now','-1 day')").get().n;
  const pushSubs = db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get().n;
  const emailSubs = db.prepare("SELECT COUNT(*) AS n FROM email_subscriptions").get().n;
  return { totalSources, total, last24, pushSubs, emailSubs };
}

app.get('/:lang(en|tr|fr)', (req, res) => {
  const lang = req.params.lang;
  const heroSlides = db.prepare(
    "SELECT * FROM articles WHERE lang = ? AND image_url IS NOT NULL AND image_url != '' ORDER BY breaking DESC, published_at DESC LIMIT 5"
  ).all(lang);
  const tickerItems = listLatest({ lang, limit: 12 });
  const latest = listLatest({ lang, limit: 12 });
  res.set('Cache-Control', 'public, max-age=60, s-maxage=60').send(
    homepage({ lang, vapidPublic: VAPID_PUBLIC, heroSlides, tickerItems, latest, byTopic: topicCounts(lang), stats: siteImpactStats(), sections: loadSectionToggles() })
  );
});

app.get('/:lang(en|tr|fr)/topic/:topic', (req, res) => {
  const { lang, topic } = req.params;
  const heroSlides = db.prepare(
    "SELECT * FROM articles WHERE lang = ? AND topic = ? AND image_url IS NOT NULL AND image_url != '' ORDER BY published_at DESC LIMIT 5"
  ).all(lang, topic);
  const tickerItems = listLatest({ lang, limit: 12 });
  const latest = listLatest({ lang, topic, limit: 24 });
  res.send(homepage({ lang, vapidPublic: VAPID_PUBLIC, heroSlides, tickerItems, latest, byTopic: topicCounts(lang), stats: siteImpactStats(), sections: loadSectionToggles() }));
});

app.get('/:lang(en|tr|fr)/article/:id', (req, res) => {
  const { lang, id } = req.params;
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  if (!article) return res.status(404).send('Not found');
  const related = db.prepare(
    'SELECT * FROM articles WHERE lang = ? AND topic = ? AND id != ? ORDER BY published_at DESC LIMIT 4'
  ).all(article.lang, article.topic, id);
  res.send(articlePage({ lang: article.lang, vapidPublic: VAPID_PUBLIC, article, related }));
});

app.get('/privacy', (req, res) => res.redirect(302, `/${detectLocale(req)}/privacy`));
app.get('/:lang(en|tr|fr)/privacy', (req, res) => {
  const { privacyPage } = require('./lib/render');
  res.send(privacyPage({ lang: req.params.lang, vapidPublic: VAPID_PUBLIC }));
});

app.get('/:lang(en|tr|fr)/donate', (req, res) => {
  const { donatePage } = require('./lib/render');
  const lang = req.params.lang;
  const orgs = db.prepare(
    "SELECT * FROM donation_orgs WHERE enabled = 1 AND (lang = 'all' OR lang = ?) ORDER BY position, name"
  ).all(lang);
  res.send(donatePage({ lang, vapidPublic: VAPID_PUBLIC, orgs }));
});

app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 404
app.use((req, res) => {
  const lang = detectLocale(req);
  res.status(404).type('html').send(`<!doctype html><meta charset=utf-8><title>404</title>
<body style="font-family:system-ui;padding:4rem;text-align:center">
  <h1 style="font-size:3rem;margin:0">404</h1>
  <p><a href="/${lang}">${t(lang,'nav.home')}</a></p>`);
});

// ---------- Aggregator schedule ----------
function startAggregator() {
  // Run on boot (small delay) and every 10 minutes.
  setTimeout(() => runAggregation().catch(() => {}), 5000);
  setInterval(() => runAggregation().catch(() => {}), 10 * 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`[unifyheart] listening on :${PORT}`);
  ensureSetupToken();
  startAggregator();
});

const os = require('os');
const fs = require('fs');
const express = require('express');
const { db, getSetting, setSetting } = require('./db');
const auth = require('./admin-auth');
const r = require('./admin-render');
const { broadcast: pushBroadcast } = require('./push');
const { runAggregation } = require('./aggregator');

const router = express.Router();
router.use(express.urlencoded({ extended: false, limit: '256kb' }));

// ---------- helpers ----------
function currentUser(req) {
  const token = auth.readCookie(req, auth.COOKIE_NAME);
  return auth.getSessionUser(token);
}
function flashRedirect(res, path, type, msg) {
  const sep = path.includes('?') ? '&' : '?';
  return res.redirect(302, `${path}${sep}flash=${encodeURIComponent(type)}&msg=${encodeURIComponent(msg)}`);
}
function readFlash(req) {
  return { type: req.query.flash, msg: req.query.msg };
}
function fmtDate(s) { if (!s) return '—'; const d = new Date(s); return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); }

// ============================================================
// SETUP & LOGIN (unauthenticated)
// ============================================================
router.get('/setup', (req, res) => {
  const tok = getSetting('admin_setup_token');
  if (auth.adminCount() > 0 || !tok) return res.status(404).send('Setup already complete.');
  if (req.query.token !== tok) {
    return res.status(403).type('text').send('Setup token required. Check your server logs for /admin/setup?token=...');
  }
  res.send(r.layoutShell({
    title: 'First-time setup', sidebar: false,
    body: `<div class="min-h-screen flex items-center justify-center bg-cream-50">
      <form method="POST" action="/admin/setup?token=${r.esc(tok)}" class="bg-white p-8 rounded-2xl ring-1 ring-ink-100 shadow-xl w-full max-w-md">
        <img src="/heart-mark.png" alt="" width="56" height="56" class="w-14 h-14 mb-4">
        <h1 class="text-2xl font-bold mb-1">Create the first admin</h1>
        <p class="text-sm text-ink-700 mb-6">This page is only shown once. After you set the password, the setup token is destroyed.</p>
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Username</label>
        <input name="username" required minlength="3" autocomplete="username" class="w-full mb-4 px-3 py-2.5 rounded-lg ring-1 ring-ink-100 focus:ring-heart-500 outline-none">
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Password</label>
        <input name="password" type="password" required minlength="10" autocomplete="new-password" class="w-full mb-6 px-3 py-2.5 rounded-lg ring-1 ring-ink-100 focus:ring-heart-500 outline-none">
        <button class="w-full bg-heart-500 hover:bg-heart-600 text-white font-semibold py-2.5 rounded-lg">Create admin & sign in</button>
      </form>
    </div>`,
  }));
});

router.post('/setup', (req, res) => {
  const tok = getSetting('admin_setup_token');
  if (auth.adminCount() > 0 || !tok || req.query.token !== tok) return res.status(403).send('Forbidden');
  const { username, password } = req.body;
  if (!username || !password || password.length < 10) return res.status(400).send('Bad input');
  const uid = auth.createUser(username.trim(), password);
  setSetting('admin_setup_token', '');
  const sess = auth.createSession(uid);
  auth.setCookie(res, auth.COOKIE_NAME, sess, { maxAge: auth.SESSION_DAYS * 86400 });
  res.redirect(302, '/admin');
});

router.get('/login', (req, res) => {
  if (auth.adminCount() === 0) {
    return res.redirect(302, `/admin/setup?token=${getSetting('admin_setup_token') || ''}`);
  }
  const err = req.query.err ? 'Invalid username or password.' : '';
  res.send(r.layoutShell({
    title: 'Sign in', sidebar: false,
    body: `<div class="min-h-screen flex items-center justify-center bg-cream-50">
      <form method="POST" action="/admin/login" class="bg-white p-8 rounded-2xl ring-1 ring-ink-100 shadow-xl w-full max-w-sm">
        <img src="/heart-mark.png" alt="" width="48" height="48" class="w-12 h-12 mb-3">
        <h1 class="text-xl font-bold mb-6">UnifyHeart admin</h1>
        ${err ? r.flash('err', err) : ''}
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Username</label>
        <input name="username" required autocomplete="username" class="w-full mb-4 px-3 py-2.5 rounded-lg ring-1 ring-ink-100 focus:ring-heart-500 outline-none">
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Password</label>
        <input name="password" type="password" required autocomplete="current-password" class="w-full mb-6 px-3 py-2.5 rounded-lg ring-1 ring-ink-100 focus:ring-heart-500 outline-none">
        <button class="w-full bg-heart-500 hover:bg-heart-600 text-white font-semibold py-2.5 rounded-lg">Sign in</button>
      </form>
    </div>`,
  }));
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = auth.verifyUser((username || '').trim(), password || '');
  if (!user) return res.redirect(302, '/admin/login?err=1');
  const sess = auth.createSession(user.id);
  auth.setCookie(res, auth.COOKIE_NAME, sess, { maxAge: auth.SESSION_DAYS * 86400 });
  res.redirect(302, '/admin');
});

router.get('/logout', (req, res) => {
  const tok = auth.readCookie(req, auth.COOKIE_NAME);
  auth.destroySession(tok);
  auth.clearCookie(res, auth.COOKIE_NAME);
  res.redirect(302, '/admin/login');
});

// ============================================================
// All routes below this line require authentication.
// ============================================================
router.use(auth.requireAdmin);

// ---------- DASHBOARD ----------
router.get('/', (req, res) => {
  const user = req.adminUser;
  const stats = {
    articles24h: db.prepare("SELECT COUNT(*) AS n FROM articles WHERE published_at > datetime('now','-1 day')").get().n,
    articlesTot: db.prepare("SELECT COUNT(*) AS n FROM articles").get().n,
    pushSubs:    db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get().n,
    emailSubs:   db.prepare("SELECT COUNT(*) AS n FROM email_subscriptions").get().n,
    views24h:    db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE ts > datetime('now','-1 day') AND is_bot = 0").get().n,
    views7d:     db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE ts > datetime('now','-7 days') AND is_bot = 0").get().n,
    alerts24h:   db.prepare("SELECT IFNULL(SUM(succeeded),0) AS n FROM alert_log WHERE ts > datetime('now','-1 day')").get().n,
  };
  const topPages = db.prepare(`SELECT path, COUNT(*) AS n FROM page_views WHERE ts > datetime('now','-7 days') AND is_bot = 0 GROUP BY path ORDER BY n DESC LIMIT 10`).all();
  const recentArticles = db.prepare(`SELECT id, title, source, lang, published_at FROM articles ORDER BY published_at DESC LIMIT 8`).all();
  const recentAlerts = db.prepare(`SELECT * FROM alert_log ORDER BY ts DESC LIMIT 6`).all();

  res.send(r.layoutShell({
    title: 'Dashboard', user, currentPath: '/admin',
    body: r.pageHeader('Dashboard', `Welcome back, ${user.username}.`) +
      r.content(`
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          ${r.statCard('Articles · 24h',    stats.articles24h, `${stats.articlesTot} total`, 'heart')}
          ${r.statCard('Views · 24h',       stats.views24h, `${stats.views7d} in 7 days`, 'teal')}
          ${r.statCard('Push subscribers',  stats.pushSubs,  '', 'warm')}
          ${r.statCard('Email subscribers', stats.emailSubs, '', 'rose')}
        </div>
        <div class="grid lg:grid-cols-2 gap-6">
          <div>
            <h2 class="font-bold text-lg mb-3">Top pages (7 days)</h2>
            ${r.table(['Path', 'Views'], topPages.map(p => [r.esc(p.path), `<span class="tabular-nums">${p.n}</span>`]))}
          </div>
          <div>
            <h2 class="font-bold text-lg mb-3">Recent articles</h2>
            ${r.table(['Title', 'Source', 'Lang', 'When'], recentArticles.map(a => [
              `<a href="/admin/articles/${a.id}" class="hover:text-heart-500 line-clamp-2 max-w-md inline-block">${r.esc(a.title)}</a>`,
              r.esc(a.source),
              `<span class="uppercase text-xs">${r.esc(a.lang)}</span>`,
              `<span class="text-xs text-ink-700">${r.esc(fmtDate(a.published_at))}</span>`,
            ]))}
          </div>
        </div>
        ${recentAlerts.length ? `
          <div class="mt-8">
            <h2 class="font-bold text-lg mb-3">Recent alerts</h2>
            ${r.table(['When', 'Channel', 'Recipients', 'Succeeded', 'Failed'], recentAlerts.map(a => [
              `<span class="text-xs">${r.esc(fmtDate(a.ts))}</span>`,
              `<span class="uppercase text-xs font-semibold">${r.esc(a.channel)}</span>`,
              a.recipients, a.succeeded, a.failed,
            ]))}
          </div>` : ''}
      `),
  }));
});

// ---------- ANALYTICS (self-hosted, no third parties) ----------
function hostnameOf(url) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch {
    const m = String(url).match(/^https?:\/\/([^/]+)/i);
    return m ? m[1].replace(/^www\./, '') : null;
  }
}

router.get('/analytics', (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));

  // Totals (humans only)
  const totals = {
    today: db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=0 AND ts > datetime('now','start of day')").get().n,
    d7:    db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=0 AND ts > datetime('now','-7 days')").get().n,
    d30:   db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=0 AND ts > datetime('now','-30 days')").get().n,
    all:   db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=0").get().n,
    bots30:db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=1 AND ts > datetime('now','-30 days')").get().n,
  };

  // Daily series for the chosen window — fill gaps with 0
  const rawDaily = db.prepare(
    `SELECT date(ts) AS d, COUNT(*) AS n FROM page_views
     WHERE is_bot=0 AND ts > datetime('now', ?) GROUP BY d`
  ).all(`-${days} days`);
  const dailyMap = Object.fromEntries(rawDaily.map((r) => [r.d, r.n]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    series.push({ label: d.slice(5), value: dailyMap[d] || 0, title: `${d}: ${dailyMap[d] || 0} views` });
  }

  const winClause = "is_bot=0 AND ts > datetime('now','-30 days')";
  const topPages = db.prepare(`SELECT path, COUNT(*) AS n FROM page_views WHERE ${winClause} GROUP BY path ORDER BY n DESC LIMIT 15`).all();
  const langs    = db.prepare(`SELECT lang, COUNT(*) AS n FROM page_views WHERE ${winClause} AND lang IS NOT NULL GROUP BY lang ORDER BY n DESC`).all();
  const countries= db.prepare(`SELECT country, COUNT(*) AS n FROM page_views WHERE ${winClause} AND country IS NOT NULL AND country != '' GROUP BY country ORDER BY n DESC LIMIT 15`).all();

  // Referrers: collapse raw URLs to hostname in JS
  const rawRefs = db.prepare(`SELECT referrer, COUNT(*) AS n FROM page_views WHERE ${winClause} AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer`).all();
  const refMap = {};
  for (const r of rawRefs) {
    const h = hostnameOf(r.referrer);
    if (!h || h === 'unifyheart.com') continue; // skip internal
    refMap[h] = (refMap[h] || 0) + r.n;
  }
  const topRefs = Object.entries(refMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 12);

  const langName = { en: 'English', tr: 'Türkçe', fr: 'Français' };

  // Traffic quality (30d): human vs bot, device split, top bot UAs
  const humanCount = db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=0 AND ts > datetime('now','-30 days')").get().n;
  const botCount   = db.prepare("SELECT COUNT(*) AS n FROM page_views WHERE is_bot=1 AND ts > datetime('now','-30 days')").get().n;
  const totalHits  = humanCount + botCount;
  const humanPct   = totalHits ? Math.round((humanCount / totalHits) * 100) : 0;
  const devices = db.prepare("SELECT device, COUNT(*) AS n FROM page_views WHERE is_bot=0 AND device IS NOT NULL AND ts > datetime('now','-30 days') GROUP BY device ORDER BY n DESC").all();
  const botUAsRaw = db.prepare("SELECT ua, COUNT(*) AS n FROM page_views WHERE is_bot=1 AND ua IS NOT NULL AND ua != '' AND ts > datetime('now','-30 days') GROUP BY ua ORDER BY n DESC LIMIT 10").all();
  function shortUA(ua) {
    const m = ua.match(/([A-Za-z0-9_-]+bot[A-Za-z0-9_-]*|Googlebot|bingbot|YandexBot|DuckDuckBot|Applebot|facebookexternalhit|curl|wget|python-requests|node-fetch|axios|Scrapy|PetalBot|AhrefsBot|SemrushBot)/i);
    return m ? m[1] : ua.slice(0, 40);
  }
  const botUAs = botUAsRaw.map((b) => ({ label: shortUA(b.ua), value: b.n }));
  const deviceIcon = { mobile: '📱', desktop: '🖥️', tablet: '📲', bot: '🤖', unknown: '❔' };

  res.send(r.layoutShell({
    title: 'Analytics', user: req.adminUser, currentPath: '/admin/analytics',
    body: r.pageHeader('Analytics', 'Self-hosted, privacy-first. No cookies, no third parties, bots filtered out.') + r.content(`
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        ${r.statCard('Views today', totals.today, '', 'heart')}
        ${r.statCard('Last 7 days', totals.d7, '', 'teal')}
        ${r.statCard('Last 30 days', totals.d30, `${totals.bots30} bot hits filtered`, 'warm')}
        ${r.statCard('All time', totals.all, '', 'ink')}
      </div>

      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-lg">Daily views · last ${days} days</h2>
        <div class="flex gap-1 text-xs">
          ${[7,30,90].map((d) => `<a href="/admin/analytics?days=${d}" class="px-2.5 py-1 rounded-lg ${days===d?'bg-ink-900 text-white':'bg-ink-100 hover:bg-ink-200'}">${d}d</a>`).join('')}
        </div>
      </div>
      ${r.barChart(series, { height: 140 })}

      <div class="grid lg:grid-cols-2 gap-6 mt-8">
        <div>
          <h2 class="font-bold text-lg mb-3">Top pages · 30 days</h2>
          ${r.barList(topPages.map((p) => ({ label: p.path, value: p.n })), { accent: '#dc2626' })}
        </div>
        <div>
          <h2 class="font-bold text-lg mb-3">Referrers · 30 days</h2>
          ${r.barList(topRefs, { accent: '#14b8a6' })}
        </div>
        <div>
          <h2 class="font-bold text-lg mb-3">Countries · 30 days</h2>
          ${r.barList(countries.map((c) => ({ label: c.country, value: c.n, sub: r.flag(c.country) })), { accent: '#f97316' })}
        </div>
        <div>
          <h2 class="font-bold text-lg mb-3">Languages · 30 days</h2>
          ${r.barList(langs.map((l) => ({ label: langName[l.lang] || l.lang, value: l.n })), { accent: '#8b5cf6' })}
        </div>
      </div>

      <h2 class="font-bold text-lg mb-3 mt-10">Traffic quality · 30 days</h2>
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl ring-1 ring-ink-100 p-6">
          <div class="text-[11px] uppercase tracking-wider text-ink-700 font-semibold mb-3">Human vs bot</div>
          <div class="flex items-end gap-2 mb-3">
            <span class="text-4xl font-bold text-teal-600 tabular-nums">${humanPct}%</span>
            <span class="text-sm text-ink-700 mb-1">human</span>
          </div>
          <div class="h-3 rounded-full bg-ink-100 overflow-hidden flex">
            <div class="h-full bg-teal-500" style="width:${humanPct}%"></div>
            <div class="h-full bg-ink-300" style="width:${100 - humanPct}%;background:#9ca3af"></div>
          </div>
          <div class="flex justify-between mt-2 text-xs text-ink-700">
            <span>👤 ${humanCount} human</span>
            <span>🤖 ${botCount} bot</span>
          </div>
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wider text-ink-700 font-semibold mb-3">Devices (humans)</div>
          ${r.barList(devices.map((d) => ({ label: d.device, value: d.n, sub: deviceIcon[d.device] || '❔' })), { accent: '#0d9488' })}
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wider text-ink-700 font-semibold mb-3">Top bots / crawlers</div>
          ${r.barList(botUAs, { accent: '#9ca3af' })}
        </div>
      </div>
    `),
  }));
});

// ---------- ARTICLES ----------
router.get('/articles', (req, res) => {
  const { lang = '', topic = '', q = '', breaking = '' } = req.query;
  const conds = [];
  const args = [];
  if (lang)     { conds.push('lang = ?'); args.push(lang); }
  if (topic)    { conds.push('topic = ?'); args.push(topic); }
  if (breaking) { conds.push('breaking = 1'); }
  if (q)        { conds.push('(title LIKE ? OR source LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const articles = db.prepare(`SELECT id, title, source, lang, topic, breaking, image_url, published_at FROM articles ${where} ORDER BY published_at DESC LIMIT 100`).all(...args);
  const totalCount = db.prepare(`SELECT COUNT(*) AS n FROM articles ${where}`).get(...args).n;
  const fl = readFlash(req);

  const filterForm = `
    <form method="GET" class="flex flex-wrap gap-2 items-center mb-5">
      <input name="q" value="${r.esc(q)}" placeholder="search title or source" class="flex-1 min-w-[200px] px-3 py-2 rounded-lg ring-1 ring-ink-100 text-sm">
      <select name="lang" class="px-3 py-2 rounded-lg ring-1 ring-ink-100 text-sm">
        <option value="">All langs</option>
        ${['en','tr','fr'].map(l => `<option value="${l}" ${lang===l?'selected':''}>${l.toUpperCase()}</option>`).join('')}
      </select>
      <select name="topic" class="px-3 py-2 rounded-lg ring-1 ring-ink-100 text-sm">
        <option value="">All topics</option>
        ${['rights','humanitarian','refugees','press','women','children','health','climate'].map(t => `<option value="${t}" ${topic===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <label class="text-sm flex items-center gap-1.5"><input type="checkbox" name="breaking" value="1" ${breaking?'checked':''}> Breaking only</label>
      <button class="px-3 py-2 rounded-lg bg-ink-900 text-white text-sm font-semibold">Filter</button>
    </form>`;

  const rowsHtml = articles.map(a => `
    <tr class="border-t border-ink-100">
      <td class="px-4 py-3 align-top"><input type="checkbox" name="ids" value="${a.id}" class="bulk-cb w-4 h-4 align-middle"></td>
      <td class="px-4 py-3 align-top">${a.image_url ? `<img src="${r.esc(a.image_url)}" referrerpolicy="no-referrer" class="w-14 h-10 object-cover rounded">` : `<div class="w-14 h-10 bg-ink-100 rounded"></div>`}</td>
      <td class="px-4 py-3 align-top">
        <a href="/admin/articles/${a.id}" class="font-semibold hover:text-heart-500 line-clamp-2 max-w-md inline-block">${r.esc(a.title)}</a>
        ${a.breaking ? `<span class="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-heart-500 text-white">URGENT</span>` : ''}
      </td>
      <td class="px-4 py-3 align-top"><div class="text-xs">${r.esc(a.source)}</div><div class="text-xs text-ink-700">${r.esc(a.topic)}</div></td>
      <td class="px-4 py-3 align-top"><span class="uppercase text-xs">${r.esc(a.lang)}</span></td>
      <td class="px-4 py-3 align-top"><span class="text-xs text-ink-700">${r.esc(fmtDate(a.published_at))}</span></td>
      <td class="px-4 py-3 align-top">
        <div class="flex gap-1.5">
          <a href="/admin/articles/${a.id}" class="text-xs px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">Edit</a>
          <button formaction="/admin/articles/${a.id}/toggle-breaking" formmethod="post" class="text-xs px-2 py-1 rounded ${a.breaking?'bg-heart-500 text-white':'bg-ink-100 hover:bg-ink-200'}">${a.breaking?'Un-urgent':'Mark urgent'}</button>
          <button formaction="/admin/articles/${a.id}/delete" formmethod="post" onclick="return confirm('Delete this article?')" class="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25">Del</button>
        </div>
      </td>
    </tr>`).join('');

  res.send(r.layoutShell({
    title: 'Articles', user: req.adminUser, currentPath: '/admin/articles',
    body: r.pageHeader('Articles', `${totalCount} matching · showing ${articles.length}`) + r.content(`
      ${r.flash(fl.type, fl.msg)}
      ${filterForm}
      <form class="bulk-form" method="POST" action="/admin/articles/bulk">
        <div class="bulk-bar hidden sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 bg-ink-900 text-cream-50 px-4 py-3 rounded-xl">
          <span class="text-sm font-semibold"><span class="bulk-count">0</span> selected</span>
          <select name="action" class="ml-2 px-3 py-1.5 rounded-lg text-ink-900 text-sm">
            <option value="delete">Delete</option>
            <option value="breaking">Mark URGENT</option>
            <option value="unbreaking">Unmark URGENT</option>
            <option value="set-topic">Set topic to…</option>
          </select>
          <select name="topic" class="px-3 py-1.5 rounded-lg text-ink-900 text-sm">
            ${['rights','humanitarian','refugees','press','women','children','health','climate'].map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <button type="submit" onclick="return confirm('Apply to selected articles?')" class="px-4 py-1.5 rounded-lg bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold">Apply</button>
          <button type="button" class="bulk-clear px-3 py-1.5 rounded-lg bg-cream-50/10 hover:bg-cream-50/20 text-sm">Clear</button>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl ring-1 ring-ink-100">
          <table class="min-w-full text-sm">
            <thead><tr class="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-700">
              <th class="px-4 py-3"><input type="checkbox" class="bulk-all w-4 h-4 align-middle"></th>
              <th class="px-4 py-3 font-semibold"></th>
              <th class="px-4 py-3 font-semibold">Title</th>
              <th class="px-4 py-3 font-semibold">Source / Topic</th>
              <th class="px-4 py-3 font-semibold">Lang</th>
              <th class="px-4 py-3 font-semibold">When</th>
              <th class="px-4 py-3 font-semibold">Actions</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </form>
    `),
  }));
});

// Bulk article actions
router.post('/articles/bulk', (req, res) => {
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.map((x) => parseInt(x, 10)).filter(Boolean);
  const action = req.body.action;
  if (!ids.length) return flashRedirect(res, '/admin/articles', 'err', 'No articles selected.');
  const ph = ids.map(() => '?').join(',');
  let msg = '';
  if (action === 'delete') {
    db.prepare(`DELETE FROM articles WHERE id IN (${ph})`).run(...ids);
    msg = `Deleted ${ids.length} article(s).`;
  } else if (action === 'breaking') {
    db.prepare(`UPDATE articles SET breaking = 1 WHERE id IN (${ph})`).run(...ids);
    msg = `Marked ${ids.length} as URGENT.`;
  } else if (action === 'unbreaking') {
    db.prepare(`UPDATE articles SET breaking = 0 WHERE id IN (${ph})`).run(...ids);
    msg = `Unmarked ${ids.length}.`;
  } else if (action === 'set-topic') {
    const topic = req.body.topic;
    db.prepare(`UPDATE articles SET topic = ? WHERE id IN (${ph})`).run(topic, ...ids);
    msg = `Set topic="${topic}" on ${ids.length}.`;
  } else {
    return flashRedirect(res, '/admin/articles', 'err', 'Unknown action.');
  }
  flashRedirect(res, '/admin/articles', 'ok', msg);
});

router.get('/articles/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).send('Not found');
  res.send(r.layoutShell({
    title: 'Edit article', user: req.adminUser, currentPath: '/admin/articles',
    body: r.pageHeader('Edit article', a.source) + r.content(`
      <form method="POST" action="/admin/articles/${a.id}" class="max-w-3xl space-y-5 bg-white p-6 rounded-xl ring-1 ring-ink-100">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Title</label>
          <input name="title" value="${r.esc(a.title)}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Summary</label>
          <textarea name="summary" rows="4" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">${r.esc(a.summary || '')}</textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Image URL</label>
            <input name="image_url" value="${r.esc(a.image_url || '')}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
            ${a.image_url ? `<img src="${r.esc(a.image_url)}" referrerpolicy="no-referrer" class="mt-3 rounded-lg ring-1 ring-ink-100 max-h-48">` : ''}
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Topic</label>
              <select name="topic" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
                ${['rights','humanitarian','refugees','press','women','children','health','climate'].map(t => `<option value="${t}" ${a.topic===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Language</label>
              <select name="lang" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
                ${['en','tr','fr'].map(l => `<option value="${l}" ${a.lang===l?'selected':''}>${l.toUpperCase()}</option>`).join('')}
              </select>
            </div>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="breaking" value="1" ${a.breaking?'checked':''}> Mark as URGENT (breaking)</label>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">External URL</label>
          <input name="url" value="${r.esc(a.url)}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
        <div class="flex items-center gap-3 pt-2 border-t border-ink-100">
          ${r.btn('Save changes', null, 'primary')}
          ${r.btn('Cancel', '/admin/articles', 'ghost')}
          <span class="ml-auto text-xs text-ink-700">Source: ${r.esc(a.source)} · Published ${r.esc(fmtDate(a.published_at))}</span>
        </div>
      </form>
    `),
  }));
});

router.post('/articles/:id', (req, res) => {
  const { title, summary, image_url, url, topic, lang } = req.body;
  const breaking = req.body.breaking ? 1 : 0;
  db.prepare(`UPDATE articles SET title=?, summary=?, image_url=?, url=?, topic=?, lang=?, breaking=? WHERE id=?`)
    .run(title, summary, image_url, url, topic, lang, breaking, req.params.id);
  flashRedirect(res, '/admin/articles', 'ok', 'Article updated.');
});

router.post('/articles/:id/delete', (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  flashRedirect(res, '/admin/articles', 'ok', 'Article deleted.');
});

router.post('/articles/:id/toggle-breaking', (req, res) => {
  db.prepare('UPDATE articles SET breaking = 1 - breaking WHERE id = ?').run(req.params.id);
  flashRedirect(res, '/admin/articles', 'ok', 'Breaking flag toggled.');
});

// ---------- SUBSCRIBERS ----------
router.get('/subscribers', (req, res) => {
  const push = db.prepare('SELECT id, lang, topics, created_at, last_sent_at, failed_count FROM push_subscriptions ORDER BY created_at DESC LIMIT 200').all();
  const email = db.prepare('SELECT * FROM email_subscriptions ORDER BY created_at DESC LIMIT 200').all();
  const fl = readFlash(req);
  const bulkBar = (verb) => `
    <div class="bulk-bar hidden sticky top-0 z-10 mb-3 flex items-center gap-2 bg-ink-900 text-cream-50 px-4 py-3 rounded-xl">
      <span class="text-sm font-semibold"><span class="bulk-count">0</span> selected</span>
      <button type="submit" onclick="return confirm('Remove selected subscribers?')" class="ml-2 px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-500/90 text-white text-sm font-semibold">${verb}</button>
      <button type="button" class="bulk-clear px-3 py-1.5 rounded-lg bg-cream-50/10 hover:bg-cream-50/20 text-sm">Clear</button>
    </div>`;

  const pushRows = push.map(s => `
    <tr class="border-t border-ink-100">
      <td class="px-4 py-3"><input type="checkbox" name="ids" value="${s.id}" class="bulk-cb w-4 h-4"></td>
      <td class="px-4 py-3"><span class="uppercase text-xs">${r.esc(s.lang)}</span></td>
      <td class="px-4 py-3"><span class="text-xs">${r.esc(s.topics || '[]')}</span></td>
      <td class="px-4 py-3"><span class="text-xs">${r.esc(fmtDate(s.created_at))}</span></td>
      <td class="px-4 py-3"><span class="text-xs">${r.esc(fmtDate(s.last_sent_at))}</span></td>
      <td class="px-4 py-3 text-xs">${s.failed_count}</td>
    </tr>`).join('');

  const emailRows = email.map(s => `
    <tr class="border-t border-ink-100">
      <td class="px-4 py-3"><input type="checkbox" name="ids" value="${s.id}" class="bulk-cb w-4 h-4"></td>
      <td class="px-4 py-3 text-sm">${r.esc(s.email)}</td>
      <td class="px-4 py-3"><span class="uppercase text-xs">${r.esc(s.lang)}</span></td>
      <td class="px-4 py-3 text-xs">${r.esc(s.frequency)}</td>
      <td class="px-4 py-3 text-xs">${s.confirmed ? '<span class="text-teal-600 font-semibold">✓ confirmed</span>' : '<span class="text-rose-500">unconfirmed</span>'}</td>
      <td class="px-4 py-3"><span class="text-xs">${r.esc(fmtDate(s.created_at))}</span></td>
      <td class="px-4 py-3">${s.confirmed ? '' : `<button formaction="/admin/subscribers/email/${s.id}/confirm" formmethod="post" class="text-xs px-2 py-1 rounded bg-teal-500/15 text-teal-600 hover:bg-teal-500/25">Confirm</button>`}</td>
    </tr>`).join('');

  const tableWrap = (headers, rows) => `
    <div class="overflow-x-auto bg-white rounded-xl ring-1 ring-ink-100">
      <table class="min-w-full text-sm">
        <thead><tr class="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-700">
          <th class="px-4 py-3"><input type="checkbox" class="bulk-all w-4 h-4"></th>
          ${headers.map(h => `<th class="px-4 py-3 font-semibold">${r.esc(h)}</th>`).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  res.send(r.layoutShell({
    title: 'Subscribers', user: req.adminUser, currentPath: '/admin/subscribers',
    body: r.pageHeader('Subscribers', `${push.length} push · ${email.length} email`) + r.content(`
      ${r.flash(fl.type, fl.msg)}
      <h2 class="font-bold text-lg mb-3">Push subscriptions</h2>
      <form class="bulk-form" method="POST" action="/admin/subscribers/bulk-delete?kind=push">
        ${bulkBar('Remove selected')}
        ${tableWrap(['Lang','Topics','Created','Last sent','Failed'], pushRows)}
      </form>
      <h2 class="font-bold text-lg mb-3 mt-8">Email subscribers</h2>
      <form class="bulk-form" method="POST" action="/admin/subscribers/bulk-delete?kind=email">
        <div class="bulk-bar hidden sticky top-0 z-10 mb-3 flex items-center gap-2 bg-ink-900 text-cream-50 px-4 py-3 rounded-xl">
          <span class="text-sm font-semibold"><span class="bulk-count">0</span> selected</span>
          <button type="submit" formaction="/admin/subscribers/bulk-confirm" class="ml-2 px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold">Confirm selected</button>
          <button type="submit" onclick="return confirm('Remove selected subscribers?')" class="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-500/90 text-white text-sm font-semibold">Remove selected</button>
          <button type="button" class="bulk-clear px-3 py-1.5 rounded-lg bg-cream-50/10 hover:bg-cream-50/20 text-sm">Clear</button>
        </div>
        ${tableWrap(['Email','Lang','Frequency','Confirmed','Created',''], emailRows)}
      </form>
      <div class="mt-6 flex gap-3">
        <a href="/admin/subscribers/export/email.csv" class="text-sm font-semibold text-heart-500 hover:underline">Export email subscribers CSV →</a>
      </div>
    `),
  }));
});

router.post('/subscribers/email/:id/confirm', (req, res) => {
  db.prepare("UPDATE email_subscriptions SET confirmed = 1, confirm_token = NULL WHERE id = ?").run(req.params.id);
  flashRedirect(res, '/admin/subscribers', 'ok', 'Subscriber confirmed.');
});

router.post('/subscribers/bulk-confirm', (req, res) => {
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.map((x) => parseInt(x, 10)).filter(Boolean);
  if (!ids.length) return flashRedirect(res, '/admin/subscribers', 'err', 'No subscribers selected.');
  const ph = ids.map(() => '?').join(',');
  db.prepare(`UPDATE email_subscriptions SET confirmed = 1, confirm_token = NULL WHERE id IN (${ph})`).run(...ids);
  flashRedirect(res, '/admin/subscribers', 'ok', `Confirmed ${ids.length} subscriber(s).`);
});

router.post('/subscribers/bulk-delete', (req, res) => {
  const kind = req.query.kind === 'email' ? 'email' : 'push';
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.map((x) => parseInt(x, 10)).filter(Boolean);
  if (!ids.length) return flashRedirect(res, '/admin/subscribers', 'err', 'No subscribers selected.');
  const ph = ids.map(() => '?').join(',');
  const tbl = kind === 'email' ? 'email_subscriptions' : 'push_subscriptions';
  db.prepare(`DELETE FROM ${tbl} WHERE id IN (${ph})`).run(...ids);
  flashRedirect(res, '/admin/subscribers', 'ok', `Removed ${ids.length} ${kind} subscriber(s).`);
});

router.get('/subscribers/export/email.csv', (req, res) => {
  const rows = db.prepare('SELECT email, lang, frequency, confirmed, created_at FROM email_subscriptions ORDER BY created_at DESC').all();
  res.type('text/csv').attachment('email-subscribers.csv').send(
    'email,lang,frequency,confirmed,created_at\n' +
    rows.map(r => `"${r.email}",${r.lang},${r.frequency},${r.confirmed},${r.created_at}`).join('\n')
  );
});

router.post('/subscribers/push/:id/delete', (req, res) => {
  db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(req.params.id);
  flashRedirect(res, '/admin/subscribers', 'ok', 'Push subscription removed.');
});
router.post('/subscribers/email/:id/delete', (req, res) => {
  db.prepare('DELETE FROM email_subscriptions WHERE id = ?').run(req.params.id);
  flashRedirect(res, '/admin/subscribers', 'ok', 'Email subscriber removed.');
});

// ---------- ALERTS LOG ----------
router.get('/alerts', (req, res) => {
  const rows = db.prepare(`SELECT al.*, a.title FROM alert_log al LEFT JOIN articles a ON a.id = al.article_id ORDER BY al.ts DESC LIMIT 200`).all();
  res.send(r.layoutShell({
    title: 'Alerts log', user: req.adminUser, currentPath: '/admin/alerts',
    body: r.pageHeader('Alerts log', `${rows.length} entries · most recent 200`) + r.content(
      r.table(['When','Channel','Article','Recipients','Sent','Failed','Note'], rows.map(a => [
        `<span class="text-xs">${r.esc(fmtDate(a.ts))}</span>`,
        `<span class="uppercase text-xs font-semibold">${r.esc(a.channel)}</span>`,
        a.title ? `<a href="/admin/articles/${a.article_id}" class="text-xs hover:text-heart-500 line-clamp-1 max-w-sm inline-block">${r.esc(a.title)}</a>` : '<span class="text-xs text-ink-700">manual</span>',
        a.recipients, a.succeeded, a.failed,
        `<span class="text-xs text-ink-700">${r.esc(a.note || '')}</span>`,
      ]))
    ),
  }));
});

// ---------- FEEDS ----------
router.get('/feeds', (req, res) => {
  const feeds = require('./feeds');
  const lastRuns = db.prepare(`SELECT source, ts, ok, inserted, error FROM feed_runs WHERE id IN (SELECT MAX(id) FROM feed_runs GROUP BY source)`).all();
  const lastBySrc = Object.fromEntries(lastRuns.map(r => [r.source, r]));
  const fl = readFlash(req);
  res.send(r.layoutShell({
    title: 'Feeds', user: req.adminUser, currentPath: '/admin/feeds',
    body: r.pageHeader('RSS feeds', `${feeds.length} sources configured`,
      `<form method="POST" action="/admin/feeds/run">${r.btn('Run aggregator now', null, 'primary')}</form>`)
      + r.content(`
        ${r.flash(fl.type, fl.msg)}
        ${r.table(['Source','URL','Lang','Topic','Trust','Last run','Status'], feeds.map(f => {
          const last = lastBySrc[f.source];
          return [
            `<span class="font-semibold">${r.esc(f.source)}</span>`,
            `<span class="text-xs text-ink-700 line-clamp-1 max-w-md inline-block">${r.esc(f.url)}</span>`,
            `<span class="uppercase text-xs">${r.esc(f.lang)}</span>`,
            r.esc(f.topic),
            f.trusted ? '<span class="text-xs text-teal-600 font-semibold">trusted</span>' : '<span class="text-xs text-warm-500">filtered</span>',
            last ? `<span class="text-xs text-ink-700">${r.esc(fmtDate(last.ts))}</span>` : '<span class="text-xs">—</span>',
            last ? (last.error
              ? `<span class="text-xs text-rose-500 line-clamp-1 max-w-sm inline-block">${r.esc(last.error)}</span>`
              : `<span class="text-xs text-teal-600">+${last.inserted} new</span>`)
              : '—',
          ];
        }))}
        <p class="mt-6 text-xs text-ink-700">Feed list is currently defined in <code>lib/feeds.js</code>. Edit there to add/remove sources, then redeploy.</p>
      `),
  }));
});

let aggregatorRunning = false;
router.post('/feeds/run', async (req, res) => {
  if (aggregatorRunning) return flashRedirect(res, '/admin/feeds', 'err', 'Aggregator already running.');
  aggregatorRunning = true;
  res.redirect(302, '/admin/feeds?flash=info&msg=' + encodeURIComponent('Aggregator started in background.'));
  try { await runAggregation(); } finally { aggregatorRunning = false; }
});

// ---------- SECTIONS ----------
router.get('/sections', (req, res) => {
  const sections = db.prepare('SELECT key, enabled FROM section_settings ORDER BY key').all();
  const fl = readFlash(req);
  const labels = {
    ticker: 'Live ticker', hero: 'Hero slider', impact: 'Impact stats',
    mission: 'Mission / "Why UnifyHeart exists"', featured: 'Featured story block',
    grid: 'News grid', quote: 'Pull-quote', causes: 'Causes', alerts: 'Alerts panel',
    trust: 'Trust strip',
  };
  res.send(r.layoutShell({
    title: 'Sections', user: req.adminUser, currentPath: '/admin/sections',
    body: r.pageHeader('Homepage sections', 'Toggle which sections appear on the public homepage.') + r.content(`
      ${r.flash(fl.type, fl.msg)}
      <div class="bg-white rounded-xl ring-1 ring-ink-100 divide-y divide-ink-100">
        ${sections.map(s => `
          <form method="POST" action="/admin/sections/${r.esc(s.key)}/toggle" class="flex items-center justify-between px-5 py-4">
            <div>
              <div class="font-semibold">${r.esc(labels[s.key] || s.key)}</div>
              <div class="text-xs text-ink-700 mt-0.5">Key: <code>${r.esc(s.key)}</code></div>
            </div>
            <button class="px-4 py-2 rounded-lg text-sm font-semibold ${s.enabled ? 'bg-teal-500/15 text-teal-600' : 'bg-rose-500/15 text-rose-500'}">${s.enabled ? '✓ Enabled' : '✕ Disabled'}</button>
          </form>
        `).join('')}
      </div>
    `),
  }));
});
router.post('/sections/:key/toggle', (req, res) => {
  db.prepare('UPDATE section_settings SET enabled = 1 - enabled WHERE key = ?').run(req.params.key);
  flashRedirect(res, '/admin/sections', 'ok', `Section "${req.params.key}" toggled.`);
});

// ---------- BROADCAST ----------
router.get('/broadcast', (req, res) => {
  const fl = readFlash(req);
  const recipients = {
    en: db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE lang = 'en'").get().n,
    tr: db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE lang = 'tr'").get().n,
    fr: db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE lang = 'fr'").get().n,
  };
  res.send(r.layoutShell({
    title: 'Broadcast', user: req.adminUser, currentPath: '/admin/broadcast',
    body: r.pageHeader('Broadcast', 'Send a one-off message to push subscribers.') + r.content(`
      ${r.flash(fl.type, fl.msg)}
      <form method="POST" action="/admin/broadcast" class="max-w-2xl space-y-5 bg-white p-6 rounded-xl ring-1 ring-ink-100">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Language</label>
          <select name="lang" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
            <option value="en">English (${recipients.en} subscribers)</option>
            <option value="tr">Türkçe (${recipients.tr} subscribers)</option>
            <option value="fr">Français (${recipients.fr} subscribers)</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Title</label>
          <input name="title" required maxlength="120" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Body</label>
          <textarea name="body" rows="3" maxlength="300" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100"></textarea>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Click URL (optional)</label>
          <input name="url" value="/" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
        <div class="pt-3 border-t border-ink-100 flex items-center gap-3">
          <button onclick="return confirm('Send to all matching subscribers?')" class="px-4 py-2 rounded-lg bg-heart-500 hover:bg-heart-600 text-white font-semibold">Send broadcast</button>
          <span class="text-xs text-ink-700">This delivers an instant Web Push to every subscriber in the selected language.</span>
        </div>
      </form>
    `),
  }));
});

router.post('/broadcast', async (req, res) => {
  const { lang, title, body, url } = req.body;
  if (!title) return flashRedirect(res, '/admin/broadcast', 'err', 'Title required.');
  const fakeArticle = { id: 0, lang, title, summary: body, image_url: null, url: url || '/' };
  let sent = 0;
  try { sent = await pushBroadcast(fakeArticle); } catch (e) {}
  db.prepare('INSERT INTO alert_log(channel, recipients, succeeded, failed, note) VALUES(?,?,?,?,?)')
    .run('push (manual)', sent, sent, 0, `lang=${lang} title="${title.slice(0,80)}"`);
  flashRedirect(res, '/admin/broadcast', 'ok', `Sent to ${sent} subscribers.`);
});

// ---------- DONATIONS ----------
router.get('/donations', (req, res) => {
  const orgs = db.prepare('SELECT * FROM donation_orgs ORDER BY position, name').all();
  const fl = readFlash(req);
  res.send(r.layoutShell({
    title: 'Donations', user: req.adminUser, currentPath: '/admin/donations',
    body: r.pageHeader('Donation organisations',
      'Manage the orgs shown on the /donate page. These are external charities you recommend supporting.',
      `<a href="/admin/donations/new" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold">+ New org</a>`)
      + r.content(`
        ${r.flash(fl.type, fl.msg)}
        ${orgs.length === 0 ? '<p class="text-sm text-ink-700">No donation orgs yet. Click "New org" to add one.</p>' : ''}
        ${r.table(['','Name','Topic','Lang','URL','Status','Actions'], orgs.map(o => [
          o.logo_url ? `<img src="${r.esc(o.logo_url)}" class="w-10 h-10 object-contain bg-ink-50 rounded">` : '<div class="w-10 h-10 bg-ink-100 rounded"></div>',
          `<div class="font-semibold">${r.esc(o.name)}</div><div class="text-xs text-ink-700 line-clamp-2 max-w-sm">${r.esc(o.description || '')}</div>`,
          r.esc(o.topic || '—'),
          `<span class="uppercase text-xs">${r.esc(o.lang)}</span>`,
          `<a href="${r.esc(o.url)}" target="_blank" rel="noopener" class="text-xs text-heart-500 hover:underline line-clamp-1 max-w-xs inline-block">${r.esc(o.url)}</a>`,
          o.enabled ? '<span class="text-xs text-teal-600 font-semibold">enabled</span>' : '<span class="text-xs text-ink-700">disabled</span>',
          `<div class="flex gap-1.5">
            <a href="/admin/donations/${o.id}" class="text-xs px-2 py-1 rounded bg-ink-100 hover:bg-ink-200">Edit</a>
            <form method="POST" action="/admin/donations/${o.id}/delete" onsubmit="return confirm('Delete this org?')"><button class="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25">Del</button></form>
          </div>`,
        ]))}
      `),
  }));
});

function donationForm(org = {}) {
  const o = Object.assign({ name:'', url:'', description:'', topic:'', lang:'all', logo_url:'', enabled:1, position:0 }, org);
  return `
    <form method="POST" action="${o.id ? `/admin/donations/${o.id}` : '/admin/donations'}" class="max-w-3xl space-y-5 bg-white p-6 rounded-xl ring-1 ring-ink-100">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Name</label>
          <input name="name" required value="${r.esc(o.name)}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">URL</label>
          <input name="url" required value="${r.esc(o.url)}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Description</label>
        <textarea name="description" rows="3" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">${r.esc(o.description)}</textarea>
      </div>
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Topic</label>
          <select name="topic" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
            <option value="">— any —</option>
            ${['rights','humanitarian','refugees','press','women','children','health','climate'].map(t => `<option value="${t}" ${o.topic===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Language</label>
          <select name="lang" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
            ${['all','en','tr','fr'].map(l => `<option value="${l}" ${o.lang===l?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Sort order</label>
          <input name="position" type="number" value="${o.position}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">Logo URL</label>
        <input name="logo_url" value="${r.esc(o.logo_url || '')}" class="w-full px-3 py-2 rounded-lg ring-1 ring-ink-100">
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" value="1" ${o.enabled?'checked':''}> Show on public /donate page</label>
      <div class="flex gap-3 pt-3 border-t border-ink-100">
        <button class="px-4 py-2 rounded-lg bg-heart-500 hover:bg-heart-600 text-white font-semibold">${o.id ? 'Save changes' : 'Create'}</button>
        <a href="/admin/donations" class="px-4 py-2 rounded-lg bg-ink-100 hover:bg-ink-200 font-semibold">Cancel</a>
      </div>
    </form>`;
}

router.get('/donations/new', (req, res) => {
  res.send(r.layoutShell({ title: 'New donation org', user: req.adminUser, currentPath: '/admin/donations',
    body: r.pageHeader('New donation org', '') + r.content(donationForm()) }));
});
router.post('/donations', (req, res) => {
  const { name, url, description, topic, lang, logo_url, position } = req.body;
  const enabled = req.body.enabled ? 1 : 0;
  db.prepare('INSERT INTO donation_orgs(name,url,description,topic,lang,logo_url,enabled,position) VALUES(?,?,?,?,?,?,?,?)')
    .run(name, url, description, topic, lang, logo_url, enabled, Number(position) || 0);
  flashRedirect(res, '/admin/donations', 'ok', 'Org created.');
});
router.get('/donations/:id', (req, res) => {
  const o = db.prepare('SELECT * FROM donation_orgs WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).send('Not found');
  res.send(r.layoutShell({ title: 'Edit donation org', user: req.adminUser, currentPath: '/admin/donations',
    body: r.pageHeader('Edit donation org', o.name) + r.content(donationForm(o)) }));
});
router.post('/donations/:id', (req, res) => {
  const { name, url, description, topic, lang, logo_url, position } = req.body;
  const enabled = req.body.enabled ? 1 : 0;
  db.prepare('UPDATE donation_orgs SET name=?, url=?, description=?, topic=?, lang=?, logo_url=?, enabled=?, position=? WHERE id=?')
    .run(name, url, description, topic, lang, logo_url, enabled, Number(position) || 0, req.params.id);
  flashRedirect(res, '/admin/donations', 'ok', 'Org saved.');
});
router.post('/donations/:id/delete', (req, res) => {
  db.prepare('DELETE FROM donation_orgs WHERE id = ?').run(req.params.id);
  flashRedirect(res, '/admin/donations', 'ok', 'Org deleted.');
});

// ---------- SYSTEM ----------
router.get('/system', (req, res) => {
  const path = require('path');
  const dataDir = path.join(__dirname, '..', 'data');
  let dbBytes = 0;
  try { for (const f of fs.readdirSync(dataDir)) dbBytes += fs.statSync(path.join(dataDir, f)).size; } catch {}
  const totalMem = os.totalmem(), freeMem = os.freemem();
  const memUsedPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const loadAvg = os.loadavg();
  const uptimeH = Math.round(os.uptime() / 3600);
  const procUptimeH = Math.round(process.uptime() / 3600);

  let logTail = '';
  try {
    const buf = fs.readFileSync('/var/log/unifyheart.log', 'utf8');
    logTail = buf.split('\n').slice(-30).join('\n');
  } catch (e) { logTail = '(log unavailable: ' + e.message + ')'; }

  const feedRunsLast = db.prepare('SELECT * FROM feed_runs ORDER BY ts DESC LIMIT 12').all();

  res.send(r.layoutShell({
    title: 'System', user: req.adminUser, currentPath: '/admin/system',
    body: r.pageHeader('System health', `${os.hostname()} · Node ${process.version} · platform ${process.platform}/${process.arch}`) + r.content(`
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        ${r.statCard('Memory used', memUsedPct + '%', `${Math.round((totalMem-freeMem)/1024/1024)}MB / ${Math.round(totalMem/1024/1024)}MB`, memUsedPct > 80 ? 'rose' : 'teal')}
        ${r.statCard('Load average', loadAvg[0].toFixed(2), `1/5/15: ${loadAvg.map(n=>n.toFixed(2)).join(' / ')}`, loadAvg[0] > 2 ? 'rose' : 'teal')}
        ${r.statCard('DB size', Math.round(dbBytes/1024) + ' KB', 'SQLite + WAL', 'warm')}
        ${r.statCard('Process uptime', procUptimeH + 'h', `System up ${uptimeH}h`, 'heart')}
      </div>
      <h2 class="font-bold text-lg mb-3">Recent feed runs</h2>
      ${r.table(['When','Source','Status','Inserted','No-image','Off-mission','Negative'], feedRunsLast.map(f => [
        `<span class="text-xs">${r.esc(fmtDate(f.ts))}</span>`,
        `<span class="font-semibold">${r.esc(f.source)}</span>`,
        f.error ? `<span class="text-xs text-rose-500 line-clamp-1 max-w-md inline-block">${r.esc(f.error)}</span>` : `<span class="text-xs text-teal-600">ok</span>`,
        f.inserted, f.skipped_no_image, f.skipped_off_mission, f.skipped_negative,
      ]))}
      <h2 class="font-bold text-lg mb-3 mt-8">Last 30 log lines</h2>
      <pre class="bg-ink-900 text-cream-50/90 rounded-xl p-5 text-xs overflow-x-auto leading-relaxed font-mono">${r.esc(logTail)}</pre>
    `),
  }));
});

module.exports = router;

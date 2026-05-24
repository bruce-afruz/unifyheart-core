const Parser = require('rss-parser');
const { db } = require('./db');
const feedsModule = require('./feeds');
const feeds = feedsModule;
const KEYWORDS = feedsModule.KEYWORDS || {};
const STRONG   = feedsModule.STRONG   || {};
const NEGATIVE = feedsModule.NEGATIVE || {};
const { publishNewArticle } = require('./publishers');

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function anyKeywordIn(list, lang, text) {
  const kws = (list[lang] || []).map(normalize);
  const t = normalize(text);
  return kws.some((k) => t.includes(k));
}

const matchesMission     = (lang, text)  => anyKeywordIn(KEYWORDS, lang, text);
const matchesStrongInTitle = (lang, title) => anyKeywordIn(STRONG,   lang, title);
const hasNegativeInTitle = (lang, title) => anyKeywordIn(NEGATIVE, lang, title);

function inferTopic(lang, text) {
  const t = (text || '').toLowerCase();
  const has = (s) => t.includes(s);
  if (has('refugee') || has('asylum') || has('mülteci') || has('réfugi') || has('sığınmacı')) return 'refugees';
  if (has('journalist') || has('press freedom') || has('gazeteci') || has('basın özgürlüğü') || has('liberté de la presse')) return 'press';
  if (has('children') || has('child ') || has('çocuk') || has('enfant')) return 'children';
  if (has('women') || has('kadın') || has('femme')) return 'women';
  if (has('climate') || has('iklim') || has('climat')) return 'climate';
  if (has('health') || has('sağlık') || has('santé')) return 'health';
  if (has('aid') || has('humanitarian') || has('insani') || has('humanitaire')) return 'humanitarian';
  return 'rights';
}

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'UnifyHeartBot/1.0 (+https://unifyheart.com)' },
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

const BREAKING_KEYWORDS = {
  en: ['breaking', 'urgent', 'emergency', 'critical', 'alert'],
  tr: ['son dakika', 'acil', 'kritik', 'flaş'],
  fr: ['urgent', 'alerte', 'flash', 'dernière minute'],
};

// Upgrade common CDN thumbnail URLs to high-res versions.
function upgradeImageUrl(url) {
  if (!url) return url;
  let u = url;

  // BBC ichef: /ace/standard/240/ or /ic/standard/240x135/ → 1024
  u = u.replace(/\/ace\/(?:standard|smartphone|raw)\/\d+\//, '/ace/standard/1024/');
  u = u.replace(/\/ic\/(?:standard|smartphone|raw)\/\d+x\d+\//, '/ic/standard/1024x576/');
  u = u.replace(/\/ic\/\d+x\d+\//, '/ic/1024x576/');

  // Guardian / Observer: ?width=140 → ?width=1200
  u = u.replace(/([?&])width=\d+/, '$1width=1200');
  u = u.replace(/([?&])w=\d{1,3}\b/, '$1w=1200');
  u = u.replace(/([?&])h=\d{1,3}\b/, '$1h=800');

  // WordPress: -150x150.jpg → .jpg (Amnesty, GlobalVoices, IPS, ReliefWeb all run WP)
  u = u.replace(/-\d{2,4}x\d{2,4}(\.(jpe?g|png|webp|gif))/i, '$1');

  // WordPress: ?resize=400,300 → strip
  u = u.replace(/([?&])resize=\d+[,x]\d+/g, '');
  u = u.replace(/([?&])fit=\d+[,x]\d+/g, '');
  u = u.replace(/([?&])crop=\d+[,x]\d+[,x]\d+[,x]\d+/g, '');
  u = u.replace(/([?&])quality=\d+/g, '');

  // Common "thumb" / "small" path segments
  u = u.replace(/\/thumb(?:nail)?\//, '/large/');
  u = u.replace(/_small(\.(jpe?g|png|webp))/i, '_large$1');
  u = u.replace(/_thumb(\.(jpe?g|png|webp))/i, '$1');
  u = u.replace(/_150x150(\.(jpe?g|png|webp))/i, '$1');

  // ReliefWeb: drop size suffix from styles paths like /styles/m/public/
  u = u.replace(/\/styles\/(thumbnail|small|medium|attachment-large)\/public\//, '/styles/attachment-large/public/');

  // Tidy double ampersands left from stripping
  u = u.replace(/[?&]&+/g, '&').replace(/\?&/, '?').replace(/[?&]$/, '');

  return u;
}

function dimOf(node) {
  const w = parseInt(node?.$?.width || '0', 10);
  const h = parseInt(node?.$?.height || '0', 10);
  return w * h || 0;
}

function pickImage(item) {
  // Collect all media candidates and choose the largest by declared area.
  const cands = [];
  const mc = item['media:content'];
  if (Array.isArray(mc)) {
    for (const n of mc) if (n?.$?.url) cands.push({ url: n.$.url, area: dimOf(n), source: 'media:content' });
  } else if (mc?.$?.url) {
    cands.push({ url: mc.$.url, area: dimOf(mc), source: 'media:content' });
  }
  const mt = item['media:thumbnail'];
  if (Array.isArray(mt)) {
    for (const n of mt) if (n?.$?.url) cands.push({ url: n.$.url, area: dimOf(n), source: 'media:thumbnail' });
  } else if (mt?.$?.url) {
    cands.push({ url: mt.$.url, area: dimOf(mt), source: 'media:thumbnail' });
  }
  if (item.enclosure?.url) {
    const isImg = /^image\//.test(item.enclosure.type || '') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(item.enclosure.url);
    if (isImg) cands.push({ url: item.enclosure.url, area: 9e9, source: 'enclosure' });
  }
  const html = item.contentEncoded || item.content || item.summary || '';
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const w = parseInt((tag.match(/width=["']?(\d+)/i) || [])[1] || '0', 10);
    const h = parseInt((tag.match(/height=["']?(\d+)/i) || [])[1] || '0', 10);
    cands.push({ url: match[1], area: (w * h) || 1, source: 'html' });
  }

  if (!cands.length) return null;

  // Drop very small declared candidates (< 200px on a side equiv) unless they're our only option.
  const usable = cands.filter((c) => c.area === 0 || c.area > 200 * 150);
  const pool = usable.length ? usable : cands;

  // Prefer enclosure / media:content over media:thumbnail when sizes are equal.
  pool.sort((a, b) => (b.area - a.area) || (a.source === 'media:thumbnail' ? 1 : -1));
  return upgradeImageUrl(pool[0].url);
}

// Fetch OG:image from the article page as a last-resort/upgrade for hero slides.
async function fetchOgImage(articleUrl) {
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'UnifyHeartBot/1.0 (+https://unifyheart.com)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    // Limit to first 64KB — OG tags live in <head>
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let read = 0;
    while (read < 65536) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      read += value.length;
      if (html.includes('</head>')) break;
    }
    try { reader.cancel(); } catch {}
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return m ? m[1] : null;
  } catch { return null; }
}

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function isBreaking(title, lang) {
  const kws = BREAKING_KEYWORDS[lang] || [];
  const t = (title || '').toLowerCase();
  return kws.some((k) => t.includes(k)) ? 1 : 0;
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO articles
    (guid, lang, topic, source, title, summary, url, image_url, published_at, breaking, hero)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function ingestFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    let inserted = 0, skippedNoImage = 0, skippedOffMission = 0, skippedNegative = 0;
    const items = parsed.items.slice(0, 30);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const guid = item.guid || item.id || item.link;
      if (!guid) continue;
      const title = (item.title || '').trim();
      if (!title) continue;
      const url = item.link;
      const published = item.isoDate || item.pubDate || new Date().toISOString();
      let image = pickImage(item);

      // Drop obvious placeholder/default images
      if (image && /\/default\.(png|jpe?g|svg|gif)(\?|$)/i.test(image)) image = null;
      if (image && /reliefweb_meta\/images\/default/i.test(image)) image = null;
      if (image && /\bplaceholder\b/i.test(image)) image = null;

      const summary = stripHtml(item.contentSnippet || item.summary || item.content || '');
      const fullText = title + ' ' + summary;

      // STRICT: drop anything whose title screams politics/economy/sports/entertainment.
      if (hasNegativeInTitle(feed.lang, title)) {
        skippedNegative++;
        continue;
      }

      // Two-tier filter:
      //   - Trusted rights orgs: title OR summary must mention rights vocabulary.
      //   - General news feeds:  TITLE must contain a strong-rights keyword.
      const passes = feed.trusted
        ? matchesMission(feed.lang, fullText)
        : matchesStrongInTitle(feed.lang, title);
      if (!passes) {
        skippedOffMission++;
        continue;
      }

      // No image? Try OG scrape for the first ~8 mission-matching items per feed.
      if (!image && url && i < 8) {
        image = upgradeImageUrl(await fetchOgImage(url));
      }

      // Still no image? Skip — site is image-first.
      if (!image) { skippedNoImage++; continue; }

      const topic = inferTopic(feed.lang, fullText) || feed.topic;
      const breaking = isBreaking(title, feed.lang);

      const res = insertStmt.run(
        guid, feed.lang, topic, feed.source,
        title, summary, url, image,
        new Date(published).toISOString(), breaking, 1
      );
      if (res.changes > 0) {
        inserted++;
        const id = res.lastInsertRowid;
        publishNewArticle({ id, lang: feed.lang, topic, source: feed.source, title, summary, url, image_url: image, breaking }).catch(() => {});
      }
    }
    return { feed: feed.source, inserted, skippedNoImage, skippedOffMission, skippedNegative, total: parsed.items.length };
  } catch (e) {
    return { feed: feed.source, error: e.message };
  }
}

const logRun = db.prepare(`INSERT INTO feed_runs(source, ok, inserted, skipped_no_image, skipped_off_mission, skipped_negative, error) VALUES(?, ?, ?, ?, ?, ?, ?)`);

async function runAggregation() {
  const started = Date.now();
  const results = await Promise.all(feeds.map(ingestFeed));
  for (const r of results) {
    logRun.run(r.feed, r.error ? 0 : 1, r.inserted || 0, r.skippedNoImage || 0, r.skippedOffMission || 0, r.skippedNegative || 0, r.error || null);
  }
  const inserted = results.reduce((a, r) => a + (r.inserted || 0), 0);
  const errors = results.filter((r) => r.error);
  console.log(`[aggregator] ${inserted} new in ${Date.now() - started}ms, ${errors.length} errors`);
  if (errors.length) console.log('  errors:', errors.map((e) => `${e.feed}: ${e.error}`).join(' | '));
  return { inserted, errors };
}

if (require.main === module) {
  runAggregation().then(() => process.exit(0));
}

module.exports = { runAggregation };

const { t, relativeTime, SUPPORTED, locales } = require('./i18n');

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
function rt(lang, iso) { return relativeTime(lang, iso); }

const TOPIC_ICON = {
  rights: '✊', humanitarian: '🤝', refugees: '🏠', press: '📰', women: '🌸',
  children: '🧸', health: '⚕️', climate: '🌱', community: '💛',
};

function layout({ lang, title, description, body, vapidPublic, ogImage, locale, jsonLd }) {
  return `<!doctype html>
<html lang="${lang}" dir="${locale.dir || 'ltr'}" class="scroll-smooth">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0e1426" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fffaf5" media="(prefers-color-scheme: light)">
<link rel="canonical" href="https://unifyheart.com/${lang}">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="UnifyHeart ${lang.toUpperCase()}" href="/rss/${lang}.xml">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage || 'https://unifyheart.com/og-default.png')}">
<meta property="og:url" content="https://unifyheart.com/${lang}">
<meta name="twitter:card" content="summary_large_image">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    darkMode: 'media',
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter','ui-sans-serif','system-ui'],
          serif: ['"Fraunces"','"Source Serif Pro"','Georgia','serif'],
        },
        colors: {
          // Warm, charity-feel palette + teal secondary
          cream: { 50:'#fffaf5', 100:'#fff3e8', 200:'#fde6d1' },
          ink:   { 50:'#f8f4ee', 100:'#ece6dc', 200:'#d3c8b6', 700:'#3a3024', 800:'#1f1a14', 900:'#0e1426' },
          heart: { 400:'#f87171', 500:'#dc2626', 600:'#b91c1c', 700:'#991b1b' },
          warm:  { 400:'#fb923c', 500:'#f97316', 600:'#ea580c' },
          rose:  { 400:'#fb7185', 500:'#e11d48' },
          teal:  { 400:'#2dd4bf', 500:'#14b8a6', 600:'#0d9488', 700:'#0f766e' },
        },
        keyframes: {
          marquee:  { '0%':{transform:'translateX(0)'},'100%':{transform:'translateX(-50%)'} },
          fadeUp:   { '0%':{opacity:0,transform:'translateY(10px)'},'100%':{opacity:1,transform:'translateY(0)'} },
          pulseDot: { '0%,100%':{opacity:1},'50%':{opacity:.3} },
          slowZoom: { '0%':{transform:'scale(1.02)'},'100%':{transform:'scale(1.08)'} },
        },
        animation: {
          marquee:  'marquee 60s linear infinite',
          fadeUp:   'fadeUp .6s ease-out both',
          pulseDot: 'pulseDot 1.4s ease-in-out infinite',
          slowZoom: 'slowZoom 12s ease-out both',
        },
      },
    },
  };
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script>window.UH = { lang: ${JSON.stringify(lang)}, vapidPublicKey: ${JSON.stringify(vapidPublic || '')} };</script>
</head>
<body class="bg-cream-50 text-ink-900 dark:bg-ink-900 dark:text-cream-50 antialiased selection:bg-heart-500/25">
${body}
<script src="/app.js" defer></script>
</body>
</html>`;
}

function header(lang) {
  const switcher = SUPPORTED.map((l) => {
    const active = l === lang ? 'text-heart-500 font-bold' : 'text-ink-700 dark:text-cream-100/70 hover:text-heart-500';
    return `<a href="/${l}" class="${active} px-1.5 uppercase text-[11px] tracking-[0.18em]">${l}</a>`;
  }).join('<span class="text-ink-200 dark:text-ink-700">·</span>');

  return `
<header class="sticky top-0 z-40 backdrop-blur-md bg-cream-50/85 dark:bg-ink-900/85 border-b border-ink-100/60 dark:border-ink-800/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
    <a href="/${lang}" class="flex items-center gap-2.5 sm:gap-3 group" aria-label="UnifyHeart">
      <img src="/heart-mark.png" alt="" width="48" height="48" class="h-10 w-10 sm:h-12 sm:w-12 transition-transform group-hover:-rotate-3 drop-shadow-[0_2px_8px_rgba(220,38,38,0.25)]">
      <span class="inline-flex items-baseline font-sans font-extrabold text-[20px] sm:text-[24px] leading-none tracking-tight">
        <span class="text-ink-900 dark:text-cream-50">unify</span><span class="text-heart-500">heart</span><span class="hidden sm:inline text-ink-700 dark:text-cream-100/70 text-base font-bold">.com</span>
      </span>
    </a>
    <nav class="hidden md:flex items-center gap-7 text-[13px] font-medium tracking-wide">
      <a href="/${lang}#stories"  class="hover:text-heart-500">${esc(t(lang,'nav.stories'))}</a>
      <a href="/${lang}#causes"   class="hover:text-heart-500">${esc(t(lang,'nav.causes'))}</a>
      <a href="/${lang}#alerts"   class="hover:text-heart-500">${esc(t(lang,'nav.alerts'))}</a>
      <a href="/${lang}#mission"  class="hover:text-heart-500">${esc(t(lang,'nav.about'))}</a>
    </nav>
    <div class="flex items-center gap-3">
      <div class="hidden sm:flex items-center gap-0.5">${switcher}</div>
      <a href="/${lang}#alerts" class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-heart-500 hover:bg-heart-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow-sm shadow-heart-500/30 transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
        <span>${esc(t(lang,'hero.cta_subscribe'))}</span>
      </a>
      <details class="sm:hidden relative">
        <summary class="list-none w-10 h-10 -mr-1 flex items-center justify-center rounded-full hover:bg-cream-100 dark:hover:bg-ink-800/60 cursor-pointer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </summary>
        <div class="absolute right-0 mt-2 w-56 rounded-2xl bg-cream-50 dark:bg-ink-800 shadow-xl ring-1 ring-ink-100 dark:ring-ink-700/50 p-2 text-sm">
          <a href="/${lang}#stories" class="block px-4 py-3 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700/40">${esc(t(lang,'nav.stories'))}</a>
          <a href="/${lang}#causes"  class="block px-4 py-3 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700/40">${esc(t(lang,'nav.causes'))}</a>
          <a href="/${lang}#alerts"  class="block px-4 py-3 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700/40">${esc(t(lang,'nav.alerts'))}</a>
          <a href="/${lang}#mission" class="block px-4 py-3 rounded-lg hover:bg-cream-100 dark:hover:bg-ink-700/40">${esc(t(lang,'nav.about'))}</a>
          <div class="px-4 py-3 mt-1 border-t border-ink-100 dark:border-ink-700/50 flex items-center justify-between">${switcher}</div>
        </div>
      </details>
    </div>
  </div>
</header>`;
}

function ticker(lang, items) {
  if (!items.length) return '';
  const row = items.map((a) =>
    `<a href="/${lang}/article/${a.id}" class="inline-flex items-center gap-3 px-5 sm:px-6 group">
       <span class="w-1.5 h-1.5 rounded-full bg-heart-500 animate-pulseDot flex-shrink-0"></span>
       <span class="text-[13px] text-ink-700 dark:text-cream-100/85 group-hover:text-heart-500 whitespace-nowrap">${esc(a.title)}</span>
       <span class="text-[11px] text-ink-200 dark:text-ink-700 whitespace-nowrap" data-time="${a.published_at}">${esc(rt(lang, a.published_at))}</span>
       <span class="text-ink-200 dark:text-ink-700">·</span>
     </a>`
  ).join('');
  return `
<div class="border-b border-ink-100/60 dark:border-ink-800/60 bg-cream-100/60 dark:bg-ink-800/40 overflow-hidden">
  <div class="max-w-7xl mx-auto flex items-center">
    <div class="flex-shrink-0 flex items-center gap-1.5 pl-3 sm:pl-6 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-gradient-to-r from-heart-500 to-warm-500 text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em]">
      <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulseDot"></span>
      <span class="sm:hidden">LIVE</span>
      <span class="hidden sm:inline">${esc(t(lang,'ticker.title'))}</span>
    </div>
    <div class="flex-1 overflow-hidden py-2 sm:py-2.5">
      <div class="flex w-max animate-marquee hover:[animation-play-state:paused]">${row}${row}</div>
    </div>
  </div>
</div>`;
}

function hero(lang, slides) {
  if (!slides.length) {
    return `<section class="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10">
      <p class="text-xs uppercase tracking-[0.22em] text-heart-500 font-bold">${esc(t(lang,'mission_label'))}</p>
      <h1 class="font-serif text-4xl sm:text-6xl font-bold leading-[1.05] mt-3 max-w-3xl">${esc(t(lang,'tagline'))}</h1>
      <p class="mt-5 text-lg sm:text-xl text-ink-700 dark:text-cream-100/80 max-w-2xl leading-relaxed">${esc(t(lang,'subtagline'))}</p>
    </section>`;
  }
  const slidesHtml = slides.map((a, i) => `
    <article class="hero-slide ${i === 0 ? 'is-active opacity-100' : 'opacity-0 pointer-events-none'} absolute inset-0 transition-opacity duration-[1200ms]" data-idx="${i}">
      <img src="${esc(a.image_url)}" alt="" class="absolute inset-0 w-full h-full object-cover ${i === 0 ? 'animate-slowZoom' : ''}" loading="${i === 0 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer">
      <div class="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/82 to-ink-900/30"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-ink-900/80 via-ink-900/25 to-transparent"></div>
    </article>`).join('');

  const top = slides[0];
  const dots = slides.map((_, i) =>
    `<button class="hero-dot h-1.5 rounded-full transition-all ${i === 0 ? 'bg-white w-10' : 'bg-white/35 w-4'}" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join('');

  return `
<section id="hero" class="relative min-h-[64vh] sm:min-h-[75vh] lg:min-h-[78vh] bg-ink-900 overflow-hidden">
  ${slidesHtml}
  <div class="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 pt-10 pb-16 sm:pt-24 sm:pb-24 flex flex-col justify-end min-h-[64vh] sm:min-h-[75vh] lg:min-h-[78vh]">
    <div class="max-w-3xl">
      <div class="inline-flex max-w-full items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] mb-5 sm:mb-7">
        <span class="w-1.5 h-1.5 rounded-full bg-heart-500 animate-pulseDot flex-shrink-0"></span>
        <span class="sm:hidden">${esc(t(lang,'mission_label'))}</span>
        <span class="hidden sm:inline">${esc(t(lang,'mission_label'))} · ${esc(t(lang,'mission_short'))}</span>
      </div>
      <h1 class="font-serif text-white text-[34px] leading-[1.05] sm:text-6xl lg:text-7xl font-bold drop-shadow-md animate-fadeUp">${esc(t(lang,'tagline'))}</h1>
      <p class="mt-4 sm:mt-5 text-white/90 text-base sm:text-lg max-w-2xl leading-relaxed animate-fadeUp">${esc(t(lang,'subtagline'))}</p>
      <div class="mt-7 sm:mt-8 flex flex-wrap gap-3">
        <a href="#alerts" id="hero-cta" class="inline-flex items-center gap-2 rounded-full bg-heart-500 hover:bg-heart-600 active:bg-heart-700 text-white text-[15px] font-semibold px-6 py-3.5 sm:py-4 shadow-lg shadow-heart-500/30 transition min-h-[44px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
          ${esc(t(lang,'hero.cta_subscribe'))}
        </a>
        <a href="#stories" class="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/30 hover:bg-white hover:text-ink-900 text-white text-[15px] font-semibold px-6 py-3.5 sm:py-4 transition min-h-[44px]">
          ${esc(t(lang,'nav.stories'))}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 5l7 7-7 7"></path></svg>
        </a>
      </div>
    </div>
    <a href="/${lang}/article/${top.id}" class="hero-credit hidden lg:block absolute right-8 bottom-20 max-w-sm bg-white/[0.07] backdrop-blur-xl ring-1 ring-white/20 rounded-2xl p-5 hover:bg-white/[0.13] transition" data-idx="0">
      <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
        ${top.breaking ? `<span class="px-1.5 py-0.5 rounded bg-heart-500 text-white">${esc(t(lang,'hero.label_breaking'))}</span>` : `<span class="px-1.5 py-0.5 rounded bg-white/15 text-white">${esc(t(lang,'hero.label_featured'))}</span>`}
        <span class="opacity-90">${esc(top.source)}</span>
      </div>
      <p class="hero-credit-title mt-3 text-white font-serif font-bold text-lg leading-snug line-clamp-3">${esc(top.title)}</p>
      <span class="hero-credit-time mt-2 inline-block text-white/75 text-[11px]" data-time="${top.published_at}">${esc(rt(lang, top.published_at))}</span>
    </a>
    <div class="absolute bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">${dots}</div>
  </div>
  <script type="application/json" id="hero-data">${JSON.stringify(slides.map(s => ({ id: s.id, title: s.title, source: s.source, breaking: s.breaking, published_at: s.published_at })))}</script>
</section>`;
}

function impactStrip(lang, stats) {
  const labels = {
    en: { sources: 'trusted sources', last24: 'alerts in 24h', total: 'stories tracked', causes: 'causes covered' },
    tr: { sources: 'güvenilir kaynak', last24: 'son 24 saatte uyarı', total: 'takip edilen haber', causes: 'konu başlığı' },
    fr: { sources: 'sources de confiance', last24: 'alertes sur 24h', total: 'récits suivis', causes: 'causes couvertes' },
  }[lang] || {};
  const cells = [
    { n: stats.totalSources, k: labels.sources, color: 'text-heart-500',  bg: 'bg-heart-500/10',  icon: `<path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="7"/>` },
    { n: stats.last24,       k: labels.last24,  color: 'text-warm-500',   bg: 'bg-warm-500/10',   icon: `<path d="M12 7v5l3 3"/><circle cx="12" cy="12" r="9"/>` },
    { n: stats.total,        k: labels.total,   color: 'text-teal-600',   bg: 'bg-teal-500/10',   icon: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5V22h16"/>` },
    { n: 8,                  k: labels.causes,  color: 'text-rose-500',   bg: 'bg-rose-500/10',   icon: `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/>` },
  ];
  return `
<section class="bg-white dark:bg-ink-900 border-b border-ink-100/60 dark:border-ink-800/60">
  <div class="max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-14 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
    ${cells.map((c) => `
      <div class="flex items-center gap-4">
        <div class="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${c.icon}</svg>
        </div>
        <div>
          <div class="font-serif text-3xl sm:text-4xl font-bold ${c.color} tabular-nums leading-none">${c.n}</div>
          <div class="mt-1.5 text-[11px] sm:text-xs uppercase tracking-[0.15em] text-ink-700 dark:text-cream-100/70 font-semibold">${esc(c.k)}</div>
        </div>
      </div>`).join('')}
  </div>
</section>`;
}

function mobileStickyCta(lang) {
  // Starts hidden; app.js reveals it once the in-hero CTA scrolls out of view.
  return `
<a href="#alerts" id="sticky-cta" data-hidden="1" class="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold px-5 py-3 shadow-2xl shadow-heart-500/40 ring-1 ring-heart-700/30 opacity-0 translate-y-4 pointer-events-none transition-all duration-300">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
  ${esc(t(lang,'hero.cta_subscribe'))}
</a>`;
}

function whySection(lang) {
  const steps = [
    { k: 'p1', accent: 'bg-heart-500',  num: '01' },
    { k: 'p2', accent: 'bg-warm-500',   num: '02' },
    { k: 'p3', accent: 'bg-teal-500',   num: '03' },
  ];
  return `
<section id="mission" class="bg-cream-100/70 dark:bg-ink-800/40 border-y border-ink-100/60 dark:border-ink-800/60">
  <div class="max-w-7xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
      <div class="lg:col-span-5">
        <p class="text-[11px] uppercase tracking-[0.22em] text-heart-500 font-bold">${esc(t(lang,'mission_label'))}</p>
        <h2 class="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1]">${esc(t(lang,'why.title'))}</h2>
        <p class="mt-5 text-base sm:text-lg leading-relaxed text-ink-700 dark:text-cream-100/80">${esc(t(lang,'why.intro'))}</p>
        <a href="#alerts" class="mt-7 inline-flex items-center gap-2 text-heart-500 font-semibold text-sm hover:gap-3 transition-all">
          ${esc(t(lang,'hero.cta_subscribe'))}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 5l7 7-7 7"></path></svg>
        </a>
      </div>
      <div class="lg:col-span-7 space-y-5">
        ${steps.map(({ k, accent, num }) => `
          <div class="relative flex gap-5 sm:gap-6 bg-white dark:bg-ink-900/60 rounded-2xl p-6 sm:p-8 ring-1 ring-ink-100 dark:ring-ink-800/60 hover:ring-heart-500/30 transition-all">
            <div class="flex-shrink-0 w-14 h-14 rounded-2xl ${accent} text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md">${num}</div>
            <div class="flex-1 min-w-0">
              <h3 class="font-serif text-xl sm:text-2xl font-bold leading-tight">${esc(t(lang, `why.${k}_title`))}</h3>
              <p class="mt-2 text-[15px] leading-relaxed text-ink-700 dark:text-cream-100/75">${esc(t(lang, `why.${k}_body`))}</p>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>
</section>`;
}

function quoteSection(lang) {
  const quotes = {
    en: { q: '"Every minute matters when a community is at risk."', cite: '— UnifyHeart mission' },
    tr: { q: '"Bir topluluk risk altındayken her dakika önemlidir."', cite: '— UnifyHeart misyonu' },
    fr: { q: '"Chaque minute compte lorsqu\'une communauté est en danger."', cite: '— Mission UnifyHeart' },
  }[lang] || {};
  return `
<section class="relative py-16 sm:py-24 bg-white dark:bg-ink-900 overflow-hidden">
  <div class="max-w-4xl mx-auto px-5 sm:px-6 text-center relative">
    <svg class="mx-auto text-heart-500/15 dark:text-heart-500/20" width="64" height="48" viewBox="0 0 64 48" fill="currentColor">
      <path d="M0 48V28C0 13 8 4 24 0L28 8C19 11 14 16 13 24h11v24H0zm36 0V28C36 13 44 4 60 0l4 8c-9 3-14 8-15 16h11v24H36z"/>
    </svg>
    <blockquote class="mt-7 font-serif text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.25] tracking-tight">
      ${esc(quotes.q)}
    </blockquote>
    <p class="mt-6 text-sm uppercase tracking-[0.2em] text-heart-500 font-bold">${esc(quotes.cite)}</p>
  </div>
</section>`;
}

function articleMedia(a, classes) {
  return `<div class="${classes} bg-cream-100 dark:bg-ink-800/40 overflow-hidden">
    <img src="${esc(a.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]">
  </div>`;
}

function featuredBlock(lang, articles) {
  if (articles.length < 3) return '';
  const [big, side1, side2] = articles;
  const meta = (a) => `
    <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] font-bold">
      ${a.breaking ? `<span class="px-1.5 py-0.5 rounded bg-heart-500 text-white">${esc(t(lang,'hero.label_breaking'))}</span>` : ''}
      <span class="text-heart-500">${esc(a.source)}</span>
      <span class="text-ink-200">·</span>
      <span class="text-ink-700 dark:text-cream-100/60 normal-case tracking-normal font-medium" data-time="${a.published_at}">${esc(rt(lang, a.published_at))}</span>
    </div>`;
  const small = (a) => `
    <a href="/${lang}/article/${a.id}" class="group flex gap-4 items-start">
      ${articleMedia(a, 'flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 rounded-xl')}
      <div class="flex-1 min-w-0">
        ${meta(a)}
        <h3 class="mt-2 font-serif font-bold text-base sm:text-lg leading-snug group-hover:text-heart-500 transition-colors line-clamp-3">${esc(a.title)}</h3>
      </div>
    </a>`;
  return `
<section id="stories" class="max-w-7xl mx-auto px-4 sm:px-6 py-16">
  <div class="flex items-baseline justify-between mb-8">
    <div>
      <p class="text-xs uppercase tracking-[0.2em] text-heart-500 font-bold">${esc(t(lang,'sections.featured'))}</p>
      <h2 class="mt-2 font-serif text-3xl sm:text-4xl font-bold">${esc(t(lang,'sections.latest'))}</h2>
    </div>
    <a href="/rss/${lang}.xml" class="hidden sm:inline text-sm font-medium text-heart-500 hover:underline">RSS →</a>
  </div>
  <div class="grid lg:grid-cols-12 gap-8">
    <a href="/${lang}/article/${big.id}" class="group lg:col-span-7 block">
      ${articleMedia(big, 'aspect-[16/10] rounded-2xl')}
      <div class="mt-5">
        ${meta(big)}
        <h3 class="mt-2 font-serif font-bold text-2xl sm:text-3xl leading-[1.15] group-hover:text-heart-500 transition-colors">${esc(big.title)}</h3>
        ${big.summary ? `<p class="mt-3 text-ink-700 dark:text-cream-100/75 leading-relaxed line-clamp-3">${esc(big.summary)}</p>` : ''}
      </div>
    </a>
    <div class="lg:col-span-5 flex flex-col gap-6">
      ${small(side1)}
      <div class="border-t border-ink-100 dark:border-ink-800/60"></div>
      ${small(side2)}
    </div>
  </div>
</section>`;
}

function gridSection(lang, articles) {
  if (!articles.length) return '';
  return `
<section class="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
    ${articles.map((a) => `
      <a href="/${lang}/article/${a.id}" class="group block">
        ${articleMedia(a, 'aspect-[16/10] rounded-2xl')}
        <div class="mt-4">
          <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] font-bold">
            ${a.breaking ? `<span class="px-1.5 py-0.5 rounded bg-heart-500 text-white">${esc(t(lang,'hero.label_breaking'))}</span>` : ''}
            <span class="text-heart-500">${esc(a.source)}</span>
            <span class="text-ink-200">·</span>
            <span class="text-ink-700 dark:text-cream-100/60 normal-case tracking-normal font-medium" data-time="${a.published_at}">${esc(rt(lang, a.published_at))}</span>
          </div>
          <h3 class="mt-2 font-serif font-bold text-lg leading-snug group-hover:text-heart-500 transition-colors line-clamp-3">${esc(a.title)}</h3>
        </div>
      </a>`).join('')}
  </div>
</section>`;
}

function causesSection(lang, counts) {
  const topics = ['rights','humanitarian','refugees','press','women','children','health','climate'];
  return `
<section id="causes" class="bg-cream-100/60 dark:bg-ink-800/30 border-y border-ink-100/60 dark:border-ink-800/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
    <div class="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
      <p class="text-[11px] uppercase tracking-[0.22em] text-heart-500 font-bold">${esc(t(lang,'sections.by_topic'))}</p>
      <h2 class="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">${esc(t(lang,'nav.causes'))}</h2>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      ${topics.map((id) => {
        const n = counts[id] || 0;
        return `
        <a href="/${lang}/topic/${id}" class="relative aspect-[4/5] rounded-2xl overflow-hidden bg-ink-900 group ring-1 ring-ink-100 dark:ring-ink-800/60 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <img src="/categories/${id}.jpg" alt="" width="1000" height="1250" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]">
          <div class="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/25 to-transparent"></div>
          <div class="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end">
            <h3 class="font-serif text-white font-bold text-base sm:text-lg lg:text-xl leading-tight drop-shadow">${esc(t(lang, `sections.${id}`))}</h3>
            ${n ? `<p class="mt-1.5 text-white/75 text-[11px] sm:text-xs font-medium">${n} ${lang === 'tr' ? 'haber' : lang === 'fr' ? 'récits' : 'stories'}</p>` : ''}
          </div>
        </a>`;
      }).join('')}
    </div>
  </div>
</section>`;
}

function alertsSection(lang) {
  const cards = [
    { id: 'push',     icon: '🔔' },
    { id: 'email',    icon: '✉️' },
    { id: 'ntfy',     icon: '📱' },
    { id: 'telegram', icon: '✈️' },
    { id: 'rss',      icon: '📡' },
  ];
  return `
<section id="alerts" class="relative py-20 bg-ink-900 text-cream-50 overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-heart-500/15 via-warm-500/5 to-rose-400/15 opacity-70"></div>
  <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-heart-500/20 blur-3xl"></div>
  <div class="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-warm-500/20 blur-3xl"></div>

  <div class="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/20 text-xs font-bold uppercase tracking-[0.2em] text-cream-50 mb-5">
      <span class="w-1.5 h-1.5 rounded-full bg-heart-500 animate-pulseDot"></span>
      ${esc(t(lang,'nav.alerts'))}
    </div>
    <h2 class="font-serif text-4xl sm:text-5xl font-bold leading-tight">${esc(t(lang,'alerts.title'))}</h2>
    <p class="mt-5 text-base sm:text-lg text-cream-50/80 leading-relaxed">${esc(t(lang,'alerts.subtitle'))}</p>
  </div>

  <div class="relative max-w-6xl mx-auto px-4 sm:px-6 mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
    ${cards.map((c) => `
      <div class="bg-white/[0.04] backdrop-blur-md rounded-2xl p-6 ring-1 ring-white/10 hover:ring-white/25 transition">
        <div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl mb-4">${c.icon}</div>
        <h3 class="font-serif text-xl font-bold text-cream-50">${esc(t(lang, `alerts.channel_${c.id}`))}</h3>
        <p class="mt-2 text-sm leading-relaxed text-cream-50/70">${esc(t(lang, `alerts.channel_${c.id}_desc`))}</p>
        ${c.id === 'push' ? `
          <button id="enable-push" class="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold px-5 py-3 transition disabled:opacity-60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
            <span id="push-label">${esc(t(lang,'alerts.enable_push'))}</span>
          </button>` : ''}
        ${c.id === 'email' ? `
          <form id="email-form" class="mt-5 flex flex-col gap-2" data-lang="${lang}">
            <input type="email" required name="email" placeholder="${esc(t(lang,'alerts.email_placeholder'))}" class="w-full rounded-full bg-white/10 ring-1 ring-white/15 text-cream-50 placeholder-cream-50/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-heart-500/60">
            <div class="flex gap-2">
              <select name="frequency" class="flex-1 rounded-full bg-white/10 ring-1 ring-white/15 text-cream-50 px-4 py-2.5 text-sm">
                <option class="text-ink-900" value="daily">${esc(t(lang,'alerts.freq_daily'))}</option>
                <option class="text-ink-900" value="weekly">${esc(t(lang,'alerts.freq_weekly'))}</option>
                <option class="text-ink-900" value="breaking">${esc(t(lang,'alerts.freq_breaking'))}</option>
              </select>
              <button type="submit" class="rounded-full bg-cream-50 text-ink-900 hover:bg-heart-500 hover:text-white text-sm font-semibold px-5 transition">${esc(t(lang,'alerts.email_submit'))}</button>
            </div>
            <p id="email-status" class="text-xs text-cream-50/80 hidden"></p>
          </form>` : ''}
        ${c.id === 'ntfy' ? `<a href="https://ntfy.sh/" target="_blank" rel="noopener" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full ring-1 ring-cream-50/40 text-cream-50 hover:bg-cream-50 hover:text-ink-900 text-sm font-semibold px-5 py-3 transition">ntfy.sh →</a>` : ''}
        ${c.id === 'telegram' ? `<a href="https://t.me/UnifyHeartNews" target="_blank" rel="noopener" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full ring-1 ring-cream-50/40 text-cream-50 hover:bg-cream-50 hover:text-ink-900 text-sm font-semibold px-5 py-3 transition">t.me/UnifyHeartNews →</a>` : ''}
        ${c.id === 'rss' ? `<a href="/rss/${lang}.xml" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full ring-1 ring-cream-50/40 text-cream-50 hover:bg-cream-50 hover:text-ink-900 text-sm font-semibold px-5 py-3 transition">/rss/${lang}.xml →</a>` : ''}
      </div>`).join('')}
  </div>
</section>`;
}

function trustStrip(lang) {
  const items = (locales[lang] || locales.en).trust.items;
  const ICON = ['🚫','🛡️','💝','🔓'];
  return `
<section class="max-w-7xl mx-auto px-4 sm:px-6 py-16">
  <p class="text-xs uppercase tracking-[0.2em] text-heart-500 font-bold text-center">${esc(t(lang,'trust.title'))}</p>
  <div class="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
    ${items.map((it, i) => `
      <div class="text-center px-4">
        <div class="text-3xl mb-3">${ICON[i] || '💛'}</div>
        <h3 class="font-serif font-bold text-lg">${esc(it.h)}</h3>
        <p class="mt-1.5 text-sm text-ink-700 dark:text-cream-100/70 leading-relaxed">${esc(it.b)}</p>
      </div>`).join('')}
  </div>
</section>`;
}

function footer(lang) {
  return `
<footer class="bg-ink-900 text-cream-50 mt-0">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-14">
    <div class="grid md:grid-cols-3 gap-10">
      <div>
        <div class="flex items-center gap-3">
          <img src="/heart-mark.png" alt="" width="56" height="56" class="h-14 w-14 drop-shadow-[0_2px_12px_rgba(220,38,38,0.35)]">
          <span class="inline-flex items-baseline font-extrabold text-[26px] leading-none tracking-tight">
            <span class="text-cream-50">unify</span><span class="text-heart-400">heart</span><span class="text-cream-50/70 text-lg">.com</span>
          </span>
        </div>
        <p class="mt-2 text-sm font-semibold text-heart-400 tracking-wide">${esc(t(lang,'tagline'))}</p>
        <p class="mt-1 text-sm text-cream-50/55 italic">${esc(locales.tr.tagline)}</p>
        <p class="mt-5 text-sm leading-relaxed text-cream-50/75 max-w-sm">${esc(t(lang,'footer.mission'))}</p>
      </div>
      <div>
        <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-cream-50/60">${esc(t(lang,'nav.alerts'))}</h3>
        <ul class="mt-4 space-y-2 text-sm">
          <li><a href="/${lang}#alerts" class="hover:text-heart-400">${esc(t(lang,'alerts.channel_push'))}</a></li>
          <li><a href="/${lang}#alerts" class="hover:text-heart-400">${esc(t(lang,'alerts.channel_email'))}</a></li>
          <li><a href="/${lang}#alerts" class="hover:text-heart-400">${esc(t(lang,'alerts.channel_telegram'))}</a></li>
          <li><a href="/rss/${lang}.xml" class="hover:text-heart-400">${esc(t(lang,'alerts.channel_rss'))}</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-[11px] font-bold uppercase tracking-[0.2em] text-cream-50/60">${esc(t(lang,'footer.lang_switch'))}</h3>
        <ul class="mt-4 space-y-2 text-sm">
          <li><a href="/en" class="hover:text-heart-400">English</a></li>
          <li><a href="/tr" class="hover:text-heart-400">Türkçe</a></li>
          <li><a href="/fr" class="hover:text-heart-400">Français</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-10 pt-6 border-t border-cream-50/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream-50/60">
      <span>© ${new Date().getFullYear()} UnifyHeart.com — ${esc(t(lang,'footer.love'))}</span>
      <span class="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-heart-500"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        unifyheart.com
      </span>
    </div>
  </div>
</footer>`;
}

function homepage({ lang, vapidPublic, heroSlides, tickerItems, latest, byTopic, stats, sections = {} }) {
  const on = (k, fallback = true) => (sections[k] !== undefined ? !!sections[k] : fallback);
  const locale = locales[lang];
  const title = `${t(lang,'site_name')} — ${t(lang,'tagline')}`;
  const description = t(lang,'subtagline');
  const ogImage = heroSlides[0]?.image_url || 'https://unifyheart.com/og-default.png';

  const featured = latest.slice(0, 3);
  const more = latest.slice(3, 12);

  const body = `
${header(lang)}
${on('ticker') ? ticker(lang, tickerItems) : ''}
${on('hero')   ? hero(lang, heroSlides) : ''}
${on('impact') ? impactStrip(lang, stats || { totalSources: 0, last24: 0, total: 0, pushSubs: 0, emailSubs: 0 }) : ''}
${on('mission')? whySection(lang) : ''}
<main>
  ${on('featured') && featured.length === 3 ? featuredBlock(lang, featured) : ''}
  ${on('grid')   ? gridSection(lang, more) : ''}
  ${on('quote')  ? quoteSection(lang) : ''}
  ${on('causes') ? causesSection(lang, byTopic) : ''}
  ${on('alerts') ? alertsSection(lang) : ''}
  ${on('trust')  ? trustStrip(lang) : ''}
</main>
${footer(lang)}
${mobileStickyCta(lang)}
`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'UnifyHeart',
    url: `https://unifyheart.com/${lang}`,
    logo: 'https://unifyheart.com/icon-512.png',
    description: t(lang, 'subtagline'),
    sameAs: ['https://t.me/UnifyHeartNews'],
  };
  return layout({ lang, locale, title, description, body, vapidPublic, ogImage, jsonLd });
}

function articlePage({ lang, vapidPublic, article, related }) {
  const locale = locales[lang];
  const title = `${article.title} — UnifyHeart`;
  const description = article.summary || t(lang,'subtagline');
  const body = `
${header(lang)}
<article class="max-w-3xl mx-auto px-4 sm:px-6 py-12">
  <a href="/${lang}" class="text-sm text-heart-500 hover:underline">← ${esc(t(lang,'nav.home'))}</a>
  <div class="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] font-bold">
    ${article.breaking ? `<span class="px-1.5 py-0.5 rounded bg-heart-500 text-white">${esc(t(lang,'hero.label_breaking'))}</span>` : ''}
    <span class="text-heart-500">${esc(article.source)}</span>
    <span class="text-ink-200">·</span>
    <span class="text-ink-700 dark:text-cream-100/60 normal-case tracking-normal font-medium" data-time="${article.published_at}">${esc(rt(lang, article.published_at))}</span>
  </div>
  <h1 class="mt-3 font-serif text-3xl sm:text-5xl font-bold leading-[1.1]">${esc(article.title)}</h1>
  ${article.image_url ? `<img src="${esc(article.image_url)}" alt="" referrerpolicy="no-referrer" class="mt-7 rounded-2xl w-full aspect-[16/9] object-cover">` : ''}
  ${article.summary ? `<p class="mt-7 text-lg leading-relaxed text-ink-700 dark:text-cream-100/85">${esc(article.summary)}</p>` : ''}
  <a href="${esc(article.url)}" target="_blank" rel="noopener" class="mt-8 inline-flex items-center gap-2 rounded-full bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold px-5 py-3 transition">
    Continue at ${esc(host(article.url))} →
  </a>
</article>
${related.length ? `
<section class="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
  <h2 class="font-serif text-2xl font-bold mb-6">${esc(t(lang,'sections.latest'))}</h2>
  ${gridSection(lang, related).replace('<section class="max-w-7xl mx-auto px-4 sm:px-6 pb-16">','<div>').replace('</section>','</div>')}
</section>` : ''}
${alertsSection(lang)}
${footer(lang)}
`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary || '',
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: new Date(article.published_at).toISOString(),
    dateModified: new Date(article.published_at).toISOString(),
    inLanguage: lang,
    articleSection: article.topic,
    author: { '@type': 'Organization', name: article.source },
    publisher: {
      '@type': 'Organization',
      name: 'UnifyHeart',
      logo: { '@type': 'ImageObject', url: 'https://unifyheart.com/icon-512.png' },
    },
    mainEntityOfPage: `https://unifyheart.com/${lang}/article/${article.id}`,
  };
  return layout({ lang, locale, title, description, body, vapidPublic, ogImage: article.image_url, jsonLd });
}

function donatePage({ lang, vapidPublic, orgs }) {
  const locale = locales[lang];
  const labels = {
    en: { title: 'Support these organisations', sub: "UnifyHeart doesn't take donations. We point you to the charities doing the work on the ground.", visit: 'Visit organisation' },
    tr: { title: 'Bu kuruluşları destekle', sub: "UnifyHeart bağış kabul etmez. Sahada çalışan kuruluşlara seni yönlendiririz.", visit: 'Kuruluşu ziyaret et' },
    fr: { title: 'Soutenez ces associations', sub: "UnifyHeart n'accepte pas de dons. Nous vous orientons vers les associations qui agissent sur le terrain.", visit: "Visiter l'association" },
  }[lang] || {};
  const title = `${labels.title} — UnifyHeart`;
  const body = `
${header(lang)}
<main class="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
  <p class="text-[11px] uppercase tracking-[0.22em] text-heart-500 font-bold">${esc(t(lang,'hero.cta_donate'))}</p>
  <h1 class="mt-3 font-serif text-3xl sm:text-5xl font-bold leading-tight max-w-3xl">${esc(labels.title)}</h1>
  <p class="mt-5 max-w-2xl text-lg text-ink-700 dark:text-cream-100/80 leading-relaxed">${esc(labels.sub)}</p>
  ${orgs.length === 0 ? `
    <div class="mt-12 p-8 bg-white dark:bg-ink-900/60 ring-1 ring-ink-100 dark:ring-ink-800/60 rounded-2xl text-center text-ink-700">
      <p>${lang==='tr'?'Yakında.':lang==='fr'?'Bientôt.':'Coming soon.'}</p>
    </div>
  ` : `
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      ${orgs.map(o => `
        <a href="${esc(o.url)}" target="_blank" rel="noopener" class="bg-white dark:bg-ink-900/60 rounded-2xl p-6 ring-1 ring-ink-100 dark:ring-ink-800/60 hover:ring-heart-500/40 hover:-translate-y-0.5 transition-all">
          ${o.logo_url ? `<img src="${esc(o.logo_url)}" alt="" class="h-12 w-auto mb-4 object-contain" referrerpolicy="no-referrer">` : '<div class="w-12 h-12 rounded-xl bg-heart-500/10 text-heart-500 flex items-center justify-center font-serif text-2xl font-bold mb-4">' + esc(o.name.charAt(0)) + '</div>'}
          <h3 class="font-serif text-xl font-bold">${esc(o.name)}</h3>
          ${o.description ? `<p class="mt-2 text-sm text-ink-700 dark:text-cream-100/75 leading-relaxed line-clamp-3">${esc(o.description)}</p>` : ''}
          <span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-heart-500">
            ${esc(labels.visit)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 5l7 7-7 7"></path></svg>
          </span>
        </a>`).join('')}
    </div>
  `}
</main>
${footer(lang)}
${mobileStickyCta(lang)}
`;
  return layout({ lang, locale, title, description: labels.sub, body, vapidPublic, ogImage: 'https://unifyheart.com/og-default.png' });
}

function confirmPage({ lang, ok }) {
  const locale = locales[lang];
  const copy = {
    en: { okT: "You're subscribed 🤍", okB: 'Your email is confirmed. You will now receive UnifyHeart alerts.', badT: 'Link expired or invalid', badB: 'This confirmation link is no longer valid. Please subscribe again.', home: 'Back to UnifyHeart' },
    tr: { okT: 'Aboneliğin onaylandı 🤍', okB: 'E-postan onaylandı. Artık UnifyHeart bildirimlerini alacaksın.', badT: 'Bağlantı geçersiz', badB: 'Bu onay bağlantısı artık geçerli değil. Lütfen tekrar abone ol.', home: "UnifyHeart'a dön" },
    fr: { okT: 'Inscription confirmée 🤍', okB: 'Votre e-mail est confirmé. Vous recevrez désormais les alertes UnifyHeart.', badT: 'Lien expiré ou invalide', badB: "Ce lien de confirmation n'est plus valide. Merci de vous réinscrire.", home: 'Retour à UnifyHeart' },
  }[lang] || {};
  const t1 = ok ? copy.okT : copy.badT;
  const t2 = ok ? copy.okB : copy.badB;
  const body = `
${header(lang)}
<main class="max-w-xl mx-auto px-5 py-24 text-center">
  <div class="w-16 h-16 rounded-2xl ${ok ? 'bg-teal-500/15 text-teal-600' : 'bg-rose-500/15 text-rose-500'} flex items-center justify-center mx-auto mb-6">
    ${ok
      ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
      : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
  </div>
  <h1 class="font-serif text-3xl sm:text-4xl font-bold">${esc(t1)}</h1>
  <p class="mt-4 text-ink-700 dark:text-cream-100/80 leading-relaxed">${esc(t2)}</p>
  <a href="/${lang}" class="mt-8 inline-flex items-center gap-2 rounded-full bg-heart-500 hover:bg-heart-600 text-white text-sm font-semibold px-6 py-3">${esc(copy.home)}</a>
</main>
${footer(lang)}
`;
  return layout({ lang, locale, title: `${t1} — UnifyHeart`, description: t2, body, vapidPublic: '' });
}

module.exports = { homepage, articlePage, donatePage, confirmPage, esc };

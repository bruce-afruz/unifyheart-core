function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layoutShell({ title, body, sidebar = true, user = null, currentPath = '/admin' }) {
  const items = [
    { href: '/admin',             label: 'Dashboard',  icon: 'M3 12h4l3-9 4 18 3-9h4' },
    { href: '/admin/analytics',   label: 'Analytics',  icon: 'M3 3v18h18 M7 14l3-4 3 3 4-6' },
    { href: '/admin/articles',    label: 'Articles',   icon: 'M4 6h16M4 12h16M4 18h10' },
    { href: '/admin/subscribers', label: 'Subscribers',icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
    { href: '/admin/alerts',      label: 'Alerts log', icon: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0' },
    { href: '/admin/feeds',       label: 'Feeds',      icon: 'M4 11a9 9 0 0 1 9 9 M4 4a16 16 0 0 1 16 16 M5 19a1 1 0 1 1 0 2 1 1 0 0 1 0-2' },
    { href: '/admin/sections',    label: 'Sections',   icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z' },
    { href: '/admin/broadcast',   label: 'Broadcast',  icon: 'M3 11l18-8-8 18-2-8-8-2z' },
    { href: '/admin/donations',   label: 'Donations',  icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3 9.24 3 10.91 3.81 12 5.09 13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
    { href: '/admin/system',      label: 'System',     icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 3' },
  ];
  const sidebarHtml = sidebar ? `
    <aside class="w-60 flex-shrink-0 bg-ink-900 text-cream-50/90 min-h-screen flex flex-col">
      <a href="/admin" class="flex items-center gap-2.5 px-5 h-16 border-b border-cream-50/10">
        <img src="/heart-mark.png" alt="" width="32" height="32" class="w-8 h-8">
        <span class="font-extrabold tracking-tight"><span class="text-cream-50">unify</span><span class="text-heart-400">heart</span><span class="text-cream-50/50 text-xs">/admin</span></span>
      </a>
      <nav class="flex-1 px-3 py-4 space-y-1 text-sm">
        ${items.map((it) => {
          const active = currentPath === it.href || (it.href !== '/admin' && currentPath.startsWith(it.href));
          return `<a href="${it.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${active ? 'bg-heart-500/20 text-heart-400 font-semibold' : 'hover:bg-cream-50/5'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${it.icon}"/></svg>
            ${esc(it.label)}
          </a>`;
        }).join('')}
      </nav>
      <div class="px-4 py-3 border-t border-cream-50/10 text-xs text-cream-50/60">
        ${user ? `<div class="mb-2">Signed in as <strong class="text-cream-50">${esc(user.username)}</strong></div>` : ''}
        <a href="/admin/logout" class="text-heart-400 hover:underline">Sign out</a> · <a href="/" class="hover:underline">View site</a>
      </div>
    </aside>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — UnifyHeart admin</title>
<link rel="icon" href="/favicon.svg">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { theme: { extend: { colors: {
  cream:{50:'#fffaf5',100:'#fff3e8'},
  ink:{50:'#f8f4ee',100:'#ece6dc',200:'#d3c8b6',700:'#3a3024',800:'#1f1a14',900:'#0e1426'},
  heart:{400:'#f87171',500:'#dc2626',600:'#b91c1c'},
  teal:{500:'#14b8a6',600:'#0d9488'},
  warm:{500:'#f97316'},
  rose:{500:'#e11d48'},
}}}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',ui-sans-serif,system-ui,sans-serif}</style>
</head>
<body class="bg-cream-50 text-ink-900">
<div class="flex">
  ${sidebarHtml}
  <main class="flex-1 min-w-0">
    ${body}
  </main>
</div>
<script>
// Generic bulk-select wiring: any <form class="bulk-form"> with .bulk-all (select-all),
// .bulk-cb (row checkboxes), .bulk-bar (action bar), .bulk-count (counter), .bulk-clear (clear btn).
(function(){
  document.querySelectorAll('form.bulk-form').forEach(function(form){
    var all=form.querySelector('.bulk-all'),bar=form.querySelector('.bulk-bar'),
        cnt=form.querySelector('.bulk-count'),clr=form.querySelector('.bulk-clear');
    function cbs(){return Array.prototype.slice.call(form.querySelectorAll('.bulk-cb'));}
    function sync(){var n=cbs().filter(function(c){return c.checked}).length;
      if(cnt)cnt.textContent=n; if(bar)bar.classList.toggle('hidden',n===0);
      if(all)all.checked=n>0&&n===cbs().length;}
    form.addEventListener('change',function(e){if(e.target.classList&&e.target.classList.contains('bulk-cb'))sync();});
    if(all)all.addEventListener('change',function(){cbs().forEach(function(c){c.checked=all.checked});sync();});
    if(clr)clr.addEventListener('click',function(){cbs().forEach(function(c){c.checked=false});if(all)all.checked=false;sync();});
  });
})();
</script>
</body>
</html>`;
}

function flash(type, msg) {
  if (!msg) return '';
  const colors = {
    ok:    'bg-teal-500/15 text-teal-600 ring-teal-500/20',
    err:   'bg-rose-500/15 text-rose-500 ring-rose-500/20',
    info:  'bg-warm-500/15 text-warm-500 ring-warm-500/20',
  };
  return `<div class="mb-6 px-4 py-3 rounded-lg ring-1 ${colors[type] || colors.info} text-sm font-medium">${esc(msg)}</div>`;
}

function pageHeader(title, subtitle, actions = '') {
  return `<div class="border-b border-ink-100 bg-white px-6 sm:px-10 py-6 flex items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold">${esc(title)}</h1>
      ${subtitle ? `<p class="mt-1 text-sm text-ink-700">${esc(subtitle)}</p>` : ''}
    </div>
    ${actions ? `<div class="flex items-center gap-2 flex-shrink-0">${actions}</div>` : ''}
  </div>`;
}

function content(inner) {
  return `<div class="px-6 sm:px-10 py-8">${inner}</div>`;
}

function btn(label, href, kind = 'primary') {
  const styles = {
    primary:   'bg-heart-500 hover:bg-heart-600 text-white',
    secondary: 'bg-ink-100 hover:bg-ink-200 text-ink-900',
    danger:    'bg-rose-500 hover:bg-rose-500/90 text-white',
    ghost:     'bg-transparent hover:bg-ink-100 text-ink-700',
  };
  const cls = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${styles[kind] || styles.primary}`;
  if (href) return `<a href="${esc(href)}" class="${cls}">${esc(label)}</a>`;
  return `<button type="submit" class="${cls}">${esc(label)}</button>`;
}

function table(headers, rows) {
  return `<div class="overflow-x-auto bg-white rounded-xl ring-1 ring-ink-100">
    <table class="min-w-full text-sm">
      <thead><tr class="bg-ink-50/60 text-left text-[11px] uppercase tracking-wider text-ink-700">
        ${headers.map(h => `<th class="px-4 py-3 font-semibold">${esc(h)}</th>`).join('')}
      </tr></thead>
      <tbody>${rows.map(r => `<tr class="border-t border-ink-100">${r.map(c => `<td class="px-4 py-3 align-top">${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function statCard(label, value, sub, color = 'heart') {
  const colors = { heart: 'text-heart-500', teal: 'text-teal-600', warm: 'text-warm-500', rose: 'text-rose-500', ink: 'text-ink-900' };
  return `<div class="bg-white rounded-xl ring-1 ring-ink-100 p-5">
    <div class="text-[11px] uppercase tracking-wider text-ink-700 font-semibold">${esc(label)}</div>
    <div class="mt-2 text-3xl font-bold tabular-nums ${colors[color] || colors.heart}">${value}</div>
    ${sub ? `<div class="mt-1 text-xs text-ink-700">${esc(sub)}</div>` : ''}
  </div>`;
}

// Country code → flag emoji (regional indicator symbols)
function flag(cc) {
  if (!cc || cc.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  const up = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return '🏳️';
  return String.fromCodePoint(A + (up.charCodeAt(0) - 65)) + String.fromCodePoint(A + (up.charCodeAt(1) - 65));
}

// Vertical bar chart (dependency-free). data: [{label, value, title?}]
function barChart(data, { height = 120, accent = '#dc2626' } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return `<div class="bg-white rounded-xl ring-1 ring-ink-100 p-5">
    <div class="flex items-end gap-[3px] sm:gap-1" style="height:${height}px">
      ${data.map((d) => {
        const h = Math.round((d.value / max) * (height - 8));
        return `<div class="flex-1 flex flex-col justify-end group relative" title="${esc(d.title || (d.label + ': ' + d.value))}">
          <div class="w-full rounded-t" style="height:${Math.max(2, h)}px;background:${accent};opacity:${d.value ? 0.85 : 0.15}"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="flex justify-between mt-2 text-[10px] text-ink-700">
      <span>${esc(data[0]?.label || '')}</span>
      <span>${esc(data[Math.floor(data.length / 2)]?.label || '')}</span>
      <span>${esc(data[data.length - 1]?.label || '')}</span>
    </div>
  </div>`;
}

// Horizontal bar list. rows: [{label, value, sub?}]
function barList(rows, { accent = '#14b8a6' } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return `<div class="bg-white rounded-xl ring-1 ring-ink-100 p-6 text-sm text-ink-700">No data yet.</div>`;
  return `<div class="bg-white rounded-xl ring-1 ring-ink-100 divide-y divide-ink-100">
    ${rows.map((r) => `
      <div class="px-4 py-2.5">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="min-w-0 truncate">${r.sub ? `<span class="mr-1.5">${r.sub}</span>` : ''}${esc(r.label)}</span>
          <span class="tabular-nums font-semibold flex-shrink-0">${r.value}</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <div class="h-full rounded-full" style="width:${Math.round((r.value / max) * 100)}%;background:${accent}"></div>
        </div>
      </div>`).join('')}
  </div>`;
}

module.exports = { esc, layoutShell, flash, pageHeader, content, btn, table, statCard, flag, barChart, barList };

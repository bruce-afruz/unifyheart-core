// UnifyHeart frontend behaviour: hero slider, relative time, web push, email subscribe.
(function () {
  const lang = (window.UH && window.UH.lang) || 'en';

  // ---------- Hero slider ----------
  (function heroSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    const credit = document.querySelector('.hero-credit');
    const dataEl = document.getElementById('hero-data');
    let data = [];
    try { data = JSON.parse(dataEl?.textContent || '[]'); } catch { data = []; }
    if (slides.length < 2) return;
    let idx = 0;
    function show(i) {
      slides.forEach((s, n) => {
        const active = n === i;
        s.classList.toggle('opacity-100', active);
        s.classList.toggle('opacity-0', !active);
        s.classList.toggle('pointer-events-none', !active);
      });
      dots.forEach((d, n) => {
        const active = n === i;
        d.classList.toggle('w-10', active);
        d.classList.toggle('w-4', !active);
        d.classList.toggle('bg-white', active);
        d.classList.toggle('bg-white/35', !active);
      });
      if (credit && data[i]) {
        credit.setAttribute('data-idx', i);
        credit.setAttribute('href', '/' + lang + '/article/' + data[i].id);
        const titleEl = credit.querySelector('.hero-credit-title');
        const timeEl = credit.querySelector('.hero-credit-time');
        if (titleEl) titleEl.textContent = data[i].title;
        if (timeEl) timeEl.setAttribute('data-time', data[i].published_at);
      }
      idx = i;
    }
    let timer = setInterval(() => show((idx + 1) % slides.length), 7000);
    dots.forEach((d, i) => d.addEventListener('click', () => { clearInterval(timer); show(i); timer = setInterval(() => show((idx + 1) % slides.length), 10000); }));
  })();

  // ---------- Relative time (refresh client-side every minute) ----------
  (function relativeTimes() {
    const dict = {
      en: { just_now: 'just now', m: '{n} min ago', h: '{n} h ago', d: '{n} d ago' },
      tr: { just_now: 'az önce', m: '{n} dk önce', h: '{n} sa önce', d: '{n} g önce' },
      fr: { just_now: "à l'instant", m: 'il y a {n} min', h: 'il y a {n} h', d: 'il y a {n} j' },
    }[lang] || {};
    function fmt(iso) {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diff / 60000);
      if (m < 1) return dict.just_now;
      if (m < 60) return dict.m.replace('{n}', m);
      const h = Math.floor(m / 60);
      if (h < 24) return dict.h.replace('{n}', h);
      return dict.d.replace('{n}', Math.floor(h / 24));
    }
    function tick() {
      document.querySelectorAll('[data-time]').forEach((el) => { el.textContent = fmt(el.getAttribute('data-time')); });
    }
    tick();
    setInterval(tick, 60000);
  })();

  // ---------- Web Push ----------
  (async function pushSetup() {
    const btn = document.getElementById('enable-push');
    const label = document.getElementById('push-label');
    if (!btn) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      btn.disabled = true;
      btn.classList.add('opacity-50');
      label && (label.textContent = '🛈 Not supported in this browser');
      return;
    }
    function urlBase64ToUint8Array(b64) {
      const padding = '='.repeat((4 - (b64.length % 4)) % 4);
      const s = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(s);
      return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    }
    let reg;
    try { reg = await navigator.serviceWorker.register('/sw.js'); } catch (e) { console.warn('SW register failed', e); return; }
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      btn.disabled = true;
      label && (label.textContent = (window.UH_t && window.UH_t.push_enabled) || '✓ Alerts enabled');
      btn.classList.remove('bg-heart-500', 'hover:bg-heart-600');
      btn.classList.add('bg-emerald-500');
      return;
    }
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          label && (label.textContent = '🚫 Blocked — change in browser settings');
          btn.classList.add('bg-ink-700');
          return;
        }
        const pubKey = window.UH.vapidPublicKey || (await fetch('/api/vapid-public-key').then((r) => r.text()));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pubKey) });
        await fetch('/api/subscribe/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub, lang, topics: [] }),
        });
        label && (label.textContent = '✓ Alerts enabled');
        btn.classList.remove('bg-heart-500');
        btn.classList.add('bg-emerald-500');
      } catch (e) {
        console.warn(e);
        label && (label.textContent = '⚠︎ ' + e.message);
        btn.disabled = false;
      }
    });
  })();

  // ---------- Mobile sticky CTA: only show after hero CTA leaves the viewport ----------
  (function stickyCta() {
    const sticky = document.getElementById('sticky-cta');
    const heroCta = document.getElementById('hero-cta');
    if (!sticky) return;
    function reveal() {
      sticky.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
      sticky.classList.add('opacity-100', 'translate-y-0');
    }
    function hide() {
      sticky.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      sticky.classList.remove('opacity-100', 'translate-y-0');
    }
    if (!heroCta || !('IntersectionObserver' in window)) {
      // Fallback: reveal once user scrolls past one viewport height.
      let lastY = 0;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (y > window.innerHeight * 0.4) reveal(); else hide();
        lastY = y;
      }, { passive: true });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? hide() : reveal();
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    io.observe(heroCta);
  })();

  // ---------- Email subscribe ----------
  (function emailForm() {
    const form = document.getElementById('email-form');
    if (!form) return;
    const status = document.getElementById('email-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const res = await fetch('/api/subscribe/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), frequency: fd.get('frequency'), lang }),
      });
      const ok = res.ok;
      if (status) {
        status.classList.remove('hidden');
        status.textContent = ok ? '✓ ' + (form.dataset.thanks || 'Thanks — confirmation on the way.') : '⚠︎ Something went wrong';
      }
      if (ok) form.reset();
    });
  })();
})();

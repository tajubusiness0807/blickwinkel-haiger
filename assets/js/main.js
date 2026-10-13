/* Blickwinkel Haiger – Interaktionen & Animationen (ohne Abhängigkeiten) */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Einstellungen
     ------------------------------------------------------------------ */
  const CONFIG = {
    // Formular-Empfänger auf dem Server (PHP). Ist er nicht erreichbar
    // (z. B. auf rein statischem Hosting), öffnet sich das E-Mail-Programm.
    formEndpoint: 'api/anfrage.php',
    email: 'info@blickwinkel-haiger.de',
    phone: '02773 912303',
    timeZone: 'Europe/Berlin',
    // Öffnungszeiten je Wochentag (0 = Sonntag) als [von, bis] in Minuten
    hours: {
      0: [],
      1: [[540, 780], [840, 1080]],
      2: [[540, 780], [840, 1080]],
      3: [[540, 780]],
      4: [[540, 780], [840, 1080]],
      5: [[540, 780], [840, 1080]],
      6: [[540, 780]],
    },
    slotMinutes: 30,
    bookingDays: 14,
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const DAYS_SHORT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

  /* ------------------------------------------------------------------
     Datum & Feiertage (Hessen)
     ------------------------------------------------------------------ */
  function berlinNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    const date = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
    return { date, min: get('hour') * 60 + get('minute') };
  }
  const dateKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, month - 1, day));
  }
  const holidayCache = {};
  function holidayName(d) {
    const y = d.getUTCFullYear();
    if (!holidayCache[y]) {
      const e = easter(y);
      holidayCache[y] = {
        [`${y}-01-01`]: 'Neujahr',
        [dateKey(addDays(e, -2))]: 'Karfreitag',
        [dateKey(addDays(e, 1))]: 'Ostermontag',
        [`${y}-05-01`]: 'Tag der Arbeit',
        [dateKey(addDays(e, 39))]: 'Christi Himmelfahrt',
        [dateKey(addDays(e, 50))]: 'Pfingstmontag',
        [dateKey(addDays(e, 60))]: 'Fronleichnam',
        [`${y}-10-03`]: 'Tag der Deutschen Einheit',
        [`${y}-12-25`]: '1. Weihnachtstag',
        [`${y}-12-26`]: '2. Weihnachtstag',
      };
    }
    return holidayCache[y][dateKey(d)] || '';
  }
  const hoursFor = (d) => (holidayName(d) ? [] : CONFIG.hours[d.getUTCDay()] || []);

  /* ------------------------------------------------------------------
     Öffnungsstatus (live)
     ------------------------------------------------------------------ */
  function computeStatus() {
    const { date, min } = berlinNow();
    const today = hoursFor(date);
    const holiday = holidayName(date);
    for (const [a, b] of today) {
      if (min >= a && min < b) {
        return { state: 'open', tiny: `Geöffnet bis ${fmtTime(b)}`, short: `Geöffnet · bis ${fmtTime(b)} Uhr`, long: `Jetzt geöffnet – heute bis ${fmtTime(b)} Uhr.` };
      }
    }
    const later = today.find(([a]) => a > min);
    if (later && today.some(([, b]) => b <= min)) {
      return { state: 'break', tiny: `Pause bis ${fmtTime(later[0])}`, short: `Mittagspause · ab ${fmtTime(later[0])} Uhr`, long: `Gerade Mittagspause – ab ${fmtTime(later[0])} Uhr sind wir wieder für Sie da.` };
    }
    if (later) {
      return { state: 'closed', tiny: `Öffnet ${fmtTime(later[0])}`, short: `Öffnet heute ${fmtTime(later[0])} Uhr`, long: `Noch geschlossen – heute öffnen wir um ${fmtTime(later[0])} Uhr.` };
    }
    for (let i = 1; i < 14; i++) {
      const d = addDays(date, i);
      const h = hoursFor(d);
      if (h.length) {
        const when = i === 1 ? 'morgen' : DAYS_SHORT[d.getUTCDay()];
        const prefix = holiday ? `Heute (${holiday}) geschlossen` : 'Jetzt geschlossen';
        return { state: 'closed', tiny: 'Geschlossen', short: `Geschlossen · öffnet ${when} ${fmtTime(h[0][0])}`, long: `${prefix} – wir öffnen ${when} um ${fmtTime(h[0][0])} Uhr.` };
      }
    }
    return { state: 'closed', tiny: 'Geschlossen', short: 'Geschlossen', long: 'Derzeit geschlossen.' };
  }

  function renderStatus() {
    const s = computeStatus();
    const { date } = berlinNow();
    $$('[data-status]').forEach((el) => {
      el.hidden = false;
      el.classList.remove('is-open', 'is-break', 'is-closed');
      el.classList.add(`is-${s.state}`);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = t.dataset.statusMode === 'tiny' ? s.tiny : s.short;
    });
    $$('[data-status-long]').forEach((el) => { el.textContent = s.long; });
    $$('[data-status-line]').forEach((el) => {
      el.classList.remove('is-open', 'is-break', 'is-closed');
      el.classList.add(`is-${s.state}`);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = s.long;
    });
    $$('[data-hours] tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === date.getUTCDay()));
  }

  /* ------------------------------------------------------------------
     Header, Menü, Logo-Auge
     ------------------------------------------------------------------ */
  const header = $('[data-header]');
  const menu = $('[data-menu]');
  const menuToggle = $('[data-menu-toggle]');
  let menuOpen = false;
  let menuTimer;

  function setMenu(open) {
    if (!menu || !menuToggle) return;
    menuOpen = open;
    clearTimeout(menuTimer);
    menuToggle.setAttribute('aria-expanded', String(open));
    const label = $('[data-menu-label]', menuToggle);
    if (label) label.textContent = open ? 'Menü schließen' : 'Menü öffnen';
    document.body.classList.toggle('menu-open', open);
    document.body.classList.toggle('is-locked', open);
    if (open) {
      menu.hidden = false;
      menu.inert = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      setTimeout(() => { const a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 300);
    } else {
      menu.classList.remove('is-open');
      menu.inert = true;
      menuTimer = setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 800);
    }
  }
  if (menu) menu.inert = true;
  if (menuToggle) menuToggle.addEventListener('click', () => setMenu(!menuOpen));
  if (menu) {
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('[data-termin]')) setMenu(false);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); menuToggle.focus(); }
  });
  window.matchMedia('(min-width: 1180px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

  // Das Auge im Logo folgt dem Mauszeiger
  if (finePointer && !reduceMotion) {
    const eyes = $$('.site-header .logo-eye, .brand--footer .logo-eye');
    let raf = 0;
    window.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        eyes.forEach((eye) => {
          const r = eye.ownerSVGElement.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
          const cx = r.left + r.width * 0.43, cy = r.top + r.height * 0.19;
          const dx = e.clientX - cx, dy = e.clientY - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dist / 260);
          eye.style.transform = `translate(${(dx / dist) * 15 * k}px, ${(dy / dist) * 7 * k}px)`;
        });
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Öffnungszeiten-Box im Header
     ------------------------------------------------------------------ */
  function initHoursPop() {
    const wrap = $('[data-hours-wrap]');
    if (!wrap) return;
    const btn = $('[data-hours-toggle]', wrap);
    const pop = $('[data-hours-pop]', wrap);
    const set = (open) => {
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(pop.hidden); });
    pop.addEventListener('click', (e) => { if (e.target.closest('[data-termin], a')) set(false); });
    document.addEventListener('click', (e) => { if (!pop.hidden && !wrap.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { set(false); btn.focus(); } });
    window.addEventListener('scroll', () => { if (!pop.hidden && header && header.classList.contains('is-hidden')) set(false); }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Scroll-Handler (gebündelt)
     ------------------------------------------------------------------ */
  const scrollFns = [];
  const onScroll = (fn) => scrollFns.push(fn);
  let ticking = false;
  function runScroll() {
    ticking = false;
    const y = window.scrollY;
    scrollFns.forEach((fn) => fn(y));
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(runScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(runScroll), { passive: true });

  let lastY = window.scrollY;
  onScroll((y) => {
    if (!header) return;
    header.classList.toggle('is-scrolled', y > 30);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    const popOpen = !!$('[data-hours-pop]:not([hidden])');
    if (goingDown && y > 500 && !menuOpen && !popOpen) header.classList.add('is-hidden');
    else if (goingUp || y < 200) header.classList.remove('is-hidden');
    lastY = y;
  });

  const mobilebar = $('[data-mobilebar]');
  onScroll((y) => {
    if (!mobilebar) return;
    const nearEnd = window.innerHeight + y > document.documentElement.scrollHeight - 160;
    mobilebar.classList.toggle('is-visible', y > 420 && !nearEnd);
  });

  const toTop = $('[data-to-top]');
  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ------------------------------------------------------------------
     Hero mit „Fokus-Brille“
     ------------------------------------------------------------------ */
  function initHero() {
    const hero = $('[data-hero]');
    if (!hero) return;
    const introShown = !document.documentElement.classList.contains('intro-seen') && !reduceMotion && $('.intro');
    const readyDelay = introShown ? 1250 : 60;
    setTimeout(() => hero.classList.add('is-ready'), readyDelay);
    if (reduceMotion) return;

    const st = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0, base: 100, w: 0, h: 0, p: 0, last: 0, active: false };
    function measure() {
      st.w = hero.clientWidth;
      st.h = hero.clientHeight;
      const wide = st.w >= 900;
      const content = $('.hero__content', hero);
      const first = content && content.firstElementChild;
      const top = first ? first.getBoundingClientRect().top - hero.getBoundingClientRect().top : st.h * 0.5;
      const headerH = header ? header.offsetHeight : 76;
      if (wide) {
        st.base = clamp(st.w * 0.075, 62, 132);
        st.home = { x: st.w * 0.7, y: st.h * 0.44 };
      } else {
        st.base = clamp(Math.min(st.w * 0.15, (top - headerH) / 2.6), 44, 90);
        st.home = { x: st.w * 0.5, y: (headerH + top) / 2 };
      }
      if (!st.x) { st.x = st.tx = st.home.x; st.y = st.ty = st.home.y; }
    }
    measure();
    window.addEventListener('resize', measure, { passive: true });
    setTimeout(() => { st.tr = st.base; }, readyDelay + 300);

    const setTarget = (e) => {
      const r = hero.getBoundingClientRect();
      const wide = st.w >= 900;
      st.tx = wide ? clamp(e.clientX - r.left, st.w * 0.46, st.w - st.base * 2.2) : e.clientX - r.left;
      st.ty = clamp(e.clientY - r.top, st.base * 1.2, st.h - st.base * 1.2);
      st.last = performance.now();
    };
    hero.addEventListener('pointermove', setTarget, { passive: true });
    hero.addEventListener('pointerdown', setTarget, { passive: true });

    onScroll((y) => { st.p = clamp(y / (st.h * 0.75), 0, 1); });

    function frame(t) {
      if (st.active) requestAnimationFrame(frame);
      if (performance.now() - st.last > 2600) {
        st.tx = st.home.x + Math.sin(t * 0.00045) * st.w * (st.w >= 900 ? 0.1 : 0.16);
        st.ty = st.home.y + Math.sin(t * 0.0007) * st.h * 0.05;
      }
      st.x += (st.tx - st.x) * 0.09;
      st.y += (st.ty - st.y) * 0.09;
      const grow = st.p * st.p * Math.max(st.w, st.h) * 1.3;
      const targetR = st.tr ? st.tr + grow : 0;
      st.r += (targetR - st.r) * 0.1;
      hero.style.setProperty('--x', `${st.x.toFixed(1)}px`);
      hero.style.setProperty('--y', `${st.y.toFixed(1)}px`);
      hero.style.setProperty('--r', `${st.r.toFixed(1)}px`);
      hero.style.setProperty('--frame-o', clamp(st.r / (st.base || 1), 0, 1) * clamp(1 - st.p * 3, 0, 1));
      hero.style.setProperty('--blur', `${(14 * (1 - st.p)).toFixed(1)}px`);
      hero.classList.toggle('is-clear', st.p > 0.97);
    }
    new IntersectionObserver(([entry]) => {
      const was = st.active;
      st.active = entry.isIntersecting;
      if (st.active && !was) requestAnimationFrame(frame);
    }).observe(hero);
  }

  /* ------------------------------------------------------------------
     Seiten-Hero & Parallax
     ------------------------------------------------------------------ */
  function initPageHero() {
    $$('.page-hero').forEach((h) => setTimeout(() => h.classList.add('is-ready'), 60));
    if (reduceMotion) return;
    const items = $$('[data-parallax]');
    if (!items.length) return;
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    }, { rootMargin: '100px' });
    items.forEach((el) => io.observe(el.parentElement || el));
    onScroll(() => {
      const vh = window.innerHeight;
      items.forEach((el) => {
        if (!visible.has(el.parentElement || el)) return;
        const r = (el.parentElement || el).getBoundingClientRect();
        const speed = Number(el.dataset.parallax) || 0.12;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
    });
  }

  /* ------------------------------------------------------------------
     Einblenden beim Scrollen, Zähler, Wort-für-Wort-Text
     ------------------------------------------------------------------ */
  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', group.dataset.stagger || '');
        child.style.setProperty('--i', i % 8);
      });
    });
    const els = $$('[data-reveal], .stars--anim, [data-count]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        if (e.target.hasAttribute('data-count')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const fmt = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const dur = 1600;
    const t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initScrub() {
    const blocks = $$('[data-scrub]');
    if (!blocks.length || reduceMotion) return;
    blocks.forEach((block) => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      });
      block.classList.add('scrub-text');
      const words = $$('.w', block);
      onScroll(() => {
        const r = block.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.3), 0, 1);
        const on = Math.round(p * words.length);
        words.forEach((w, i) => w.classList.toggle('is-on', i < on));
      });
    });
  }

  /* ------------------------------------------------------------------
     Karten: 3D-Neigung & Lichtpunkt
     ------------------------------------------------------------------ */
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${((px - 0.5) * 7).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
    document.addEventListener('pointermove', (e) => {
      const btn = e.target.closest && e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${e.clientX - r.left}px`);
      btn.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Sehanalyse-Schritte mit Auge
     ------------------------------------------------------------------ */
  function initSteps() {
    $$('[data-steps]').forEach((wrap) => {
      const steps = $$('.step', wrap);
      const segs = $$('.seg', wrap);
      const label = $('[data-step-label]', wrap);
      const irisG = $('[data-iris]', wrap);
      if (!steps.length) return;
      const activate = (idx) => {
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
        segs.forEach((s, i) => s.classList.toggle('is-on', i <= idx));
        if (label) label.textContent = `${pad(idx + 1)}/${pad(steps.length)}`;
        if (irisG && !reduceMotion) {
          const a = ((-90 + idx * 60 + 30) * Math.PI) / 180;
          irisG.style.transform = `translate(${(Math.cos(a) * 16).toFixed(1)}px, ${(Math.sin(a) * 10).toFixed(1)}px)`;
        }
      };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activate(steps.indexOf(e.target)); });
      }, { rootMargin: '-42% 0px -42% 0px' });
      steps.forEach((s) => io.observe(s));
      activate(0);
    });
  }

  /* ------------------------------------------------------------------
     Ladenrundgang: horizontales Scrollen
     ------------------------------------------------------------------ */
  function initTour() {
    const tour = $('[data-tour]');
    if (!tour) return;
    const track = $('.tour__track', tour);
    const bar = $('.tour__progress span', tour);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (bar) bar.style.setProperty('--p', max > 0 ? Math.max(0.08, track.scrollLeft / max) : 1);
    };
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------
     Lightbox
     ------------------------------------------------------------------ */
  function initLightbox() {
    const dlg = $('[data-lightbox]');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const img = $('[data-lightbox-img]', dlg);
    const cap = $('[data-lightbox-caption]', dlg);
    let items = [];
    let idx = 0;
    const show = (i) => {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      img.src = it.dataset.full || $('img', it).currentSrc || $('img', it).src;
      img.alt = $('img', it).alt || '';
      cap.textContent = it.dataset.caption || '';
      img.style.animation = 'none';
      void img.offsetWidth;
      img.style.animation = '';
    };
    document.addEventListener('click', (e) => {
      const it = e.target.closest('[data-gallery-item]');
      if (!it) return;
      e.preventDefault();
      const group = it.closest('[data-gallery]');
      items = group ? $$('[data-gallery-item]', group) : [it];
      show(items.indexOf(it));
      dlg.showModal();
    });
    $('[data-lightbox-prev]', dlg).addEventListener('click', () => show(idx - 1));
    $('[data-lightbox-next]', dlg).addEventListener('click', () => show(idx + 1));
    $('[data-lightbox-close]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lightbox__figure')) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    let sx = 0;
    dlg.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* ------------------------------------------------------------------
     Endlos-Bänder (Laufband, Bewertungen)
     ------------------------------------------------------------------ */
  function initLoops() {
    if (reduceMotion) return;
    $$('[data-loop]').forEach((track) => {
      Array.from(track.children).forEach((child) => {
        const c = child.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('a, button', c).forEach((el) => el.setAttribute('tabindex', '-1'));
        track.appendChild(c);
      });
    });
  }

  /* ------------------------------------------------------------------
     Tabs (Gesichtsform, Sehsimulator, Tönung, Glas-Extras)
     ------------------------------------------------------------------ */
  function initTabs() {
    $$('[data-tabs]').forEach((root) => {
      const tabs = $$('[role="tab"]', root).filter((t) => t.closest('[data-tabs]') === root);
      const target = root.closest('[data-state-target]') || root;
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          const panel = document.getElementById(t.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
        if (tab.dataset.state) target.dataset.state = tab.dataset.state;
        if (focus) tab.focus();
        if (tab.scrollIntoView && tab.parentElement.scrollWidth > tab.parentElement.clientWidth) {
          tab.parentElement.scrollTo({ left: tab.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      };
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (e) => {
          const vertical = tab.closest('.tabs-list--stack');
          const next = vertical ? 'ArrowDown' : 'ArrowRight';
          const prev = vertical ? 'ArrowUp' : 'ArrowLeft';
          if (e.key === next) { e.preventDefault(); select(tabs[(i + 1) % tabs.length], true); }
          if (e.key === prev) { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length], true); }
          if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
          if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
        });
      });
      const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
      if (initial) select(initial);
    });
  }

  /* ------------------------------------------------------------------
     Gleitsicht-Zonen
     ------------------------------------------------------------------ */
  function initZones() {
    $$('[data-zones]').forEach((root) => {
      const btns = $$('[data-zone-btn]', root);
      const zones = $$('[data-zone]', root);
      let auto = true;
      let i = 0;
      const set = (key) => {
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zoneBtn === key)));
        zones.forEach((z) => z.classList.toggle('is-on', z.dataset.zone === key));
      };
      btns.forEach((b) => b.addEventListener('click', () => { auto = false; set(b.dataset.zoneBtn); }));
      zones.forEach((z) => {
        z.addEventListener('pointerenter', () => { auto = false; set(z.dataset.zone); });
        z.addEventListener('click', () => { auto = false; set(z.dataset.zone); });
      });
      set(btns[0].dataset.zoneBtn);
      if (reduceMotion) return;
      let timer;
      new IntersectionObserver(([e]) => {
        clearInterval(timer);
        if (e.isIntersecting) {
          timer = setInterval(() => {
            if (!auto) return clearInterval(timer);
            i = (i + 1) % btns.length;
            set(btns[i].dataset.zoneBtn);
          }, 2200);
        }
      }, { threshold: 0.4 }).observe(root);
    });
  }

  /* ------------------------------------------------------------------
     Karte erst nach Einwilligung laden
     ------------------------------------------------------------------ */
  function initMap() {
    $$('[data-map-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const map = btn.closest('[data-map]');
        const iframe = document.createElement('iframe');
        iframe.src = map.dataset.src;
        iframe.title = 'Google Maps: Blickwinkel, Hinterm Graben 4, 35708 Haiger';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.setAttribute('allowfullscreen', '');
        map.appendChild(iframe);
        $('.map__consent', map).remove();
      });
    });
  }

  /* ------------------------------------------------------------------
     Horizontale Kartenreihen mit Pfeilen
     ------------------------------------------------------------------ */
  function initScrollers() {
    $$('[data-scroller-nav]').forEach((nav) => {
      const list = document.getElementById(nav.dataset.scrollerNav);
      if (!list) return;
      const step = () => (list.firstElementChild ? list.firstElementChild.getBoundingClientRect().width + 20 : 300);
      $('[data-dir="prev"]', nav).addEventListener('click', () => list.scrollBy({ left: -step(), behavior: 'smooth' }));
      $('[data-dir="next"]', nav).addEventListener('click', () => list.scrollBy({ left: step(), behavior: 'smooth' }));
    });
  }

  /* ------------------------------------------------------------------
     Formularversand: Server (PHP) oder E-Mail-Programm
     ------------------------------------------------------------------ */
  async function sendForm(type, fields, subject, body) {
    if (CONFIG.formEndpoint && /^https?:$/.test(location.protocol)) {
      const fd = new FormData();
      fd.append('type', type);
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch(CONFIG.formEndpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' }, signal: ctrl.signal });
        clearTimeout(t);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          if (res.ok && json.ok) return { mode: 'sent' };
        }
      } catch (err) { /* Fallback unten */ }
    }
    const href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { mode: 'mail', href };
  }

  function fieldError(form, name, show) {
    const err = $(`[data-error-for="${name}"]`, form);
    if (err) err.hidden = !show;
    const input = form.elements[name];
    const field = input && input.closest ? input.closest('.field') : null;
    if (field) field.classList.toggle('is-invalid', show);
    if (input && input.setAttribute && !(input instanceof RadioNodeList)) input.setAttribute('aria-invalid', String(show));
  }
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* ------------------------------------------------------------------
     Termin-Dialog
     ------------------------------------------------------------------ */
  function initTermin() {
    const dlg = $('[data-termin-dialog]');
    if (!dlg || typeof dlg.showModal !== 'function') {
      $$('[data-termin]').forEach((b) => b.addEventListener('click', () => { location.href = `tel:${CONFIG.phone.replace(/\s/g, '')}`; }));
      return;
    }
    const form = $('[data-termin-form]', dlg);
    const steps = $$('[data-step]', form);
    const prog = $$('.termin__progress li', form);
    const btnNext = $('[data-termin-next]', form);
    const btnBack = $('[data-termin-back]', form);
    const btnSubmit = $('[data-termin-submit]', form);
    const foot = $('[data-termin-foot]', form);
    const summary = $('[data-summary]', form);
    const dateWrap = $('[data-dates]', form);
    const slotWrap = $('[data-slots]', form);
    const slotDay = $('[data-slot-day]', form);
    const flex = $('[data-flex]', form);
    const prepOut = $('[data-prep-out]', form);
    let step = 1;
    let openedAt = 0;
    let lastTrigger = null;

    function dayList() {
      const { date, min } = berlinNow();
      const out = [];
      for (let i = 0; out.length < CONFIG.bookingDays && i < 40; i++) {
        const d = addDays(date, i);
        const slots = slotsFor(d, i === 0 ? min + 60 : -1);
        if (slots.length) out.push({ d, slots });
      }
      return out;
    }
    function slotsFor(d, minStart) {
      const res = [];
      hoursFor(d).forEach(([a, b]) => {
        for (let t = a; t + CONFIG.slotMinutes <= b; t += CONFIG.slotMinutes) if (t >= minStart) res.push(t);
      });
      return res;
    }
    const dayLabel = (d) => `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;

    function renderDates() {
      const days = dayList();
      dateWrap.innerHTML = '';
      days.forEach(({ d, slots }) => {
        const l = document.createElement('label');
        l.className = 'date-chip';
        const iso = dateKey(d);
        l.innerHTML = `<input type="radio" name="datum" value="${iso}"><span><small>${DAYS_SHORT[d.getUTCDay()].replace('.', '')}</small><strong>${d.getUTCDate()}</strong><em>${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][d.getUTCMonth()]}</em></span>`;
        const input = $('input', l);
        input.dataset.label = `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
        input.dataset.short = dayLabel(d);
        input.addEventListener('change', () => renderSlots(slots, input));
        dateWrap.appendChild(l);
      });
      slotWrap.innerHTML = '<p class="slots__empty">Bitte wählen Sie zuerst einen Tag.</p>';
      slotDay.textContent = '';
    }
    function renderSlots(slots, input) {
      slotDay.textContent = `am ${input.dataset.short}`;
      slotWrap.innerHTML = '';
      let group = '';
      slots.forEach((t) => {
        const g = t < 780 ? 'Vormittag' : 'Nachmittag';
        if (g !== group) {
          group = g;
          const h = document.createElement('span');
          h.className = 'slots__group';
          h.textContent = g;
          slotWrap.appendChild(h);
        }
        const l = document.createElement('label');
        l.className = 'slot';
        l.innerHTML = `<input type="radio" name="uhrzeit" value="${fmtTime(t)}"><span>${fmtTime(t)}</span>`;
        slotWrap.appendChild(l);
      });
      updateSummary();
    }

    const val = (name) => {
      const el = form.elements[name];
      if (!el) return '';
      if (el instanceof RadioNodeList) return el.value;
      if (el.type === 'checkbox') return el.checked ? el.value : '';
      return el.value.trim();
    };
    const checkedInput = (name) => $(`input[name="${name}"]:checked`, form);

    function updateSummary() {
      const parts = [];
      if (val('anliegen')) parts.push(val('anliegen'));
      if (flex.checked) parts.push('zeitlich flexibel');
      else {
        const d = checkedInput('datum');
        if (d) parts.push(d.dataset.short);
        if (val('uhrzeit')) parts.push(`${val('uhrzeit')} Uhr`);
      }
      summary.textContent = parts.join(' · ');
    }

    function validate(n) {
      let ok = true;
      if (n === 1) {
        ok = !!val('anliegen');
        fieldError(form, 'anliegen', !ok);
      }
      if (n === 2) {
        ok = flex.checked || (!!val('datum') && !!val('uhrzeit'));
        fieldError(form, 'datum', !ok);
      }
      if (n === 3) {
        const checks = {
          name: val('name').length >= 2,
          telefon: val('telefon').replace(/[^\d]/g, '').length >= 5,
          email: validEmail(val('email')),
          datenschutz: !!val('datenschutz'),
        };
        Object.entries(checks).forEach(([k, v]) => fieldError(form, k, !v));
        ok = Object.values(checks).every(Boolean);
        if (!ok) {
          const first = Object.keys(checks).find((k) => !checks[k]);
          const el = form.elements[first];
          if (el && el.focus) el.focus();
        }
      }
      return ok;
    }

    function go(n) {
      step = n;
      steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
      prog.forEach((p, i) => {
        p.classList.toggle('is-active', i === n - 1);
        p.classList.toggle('is-done', i < n - 1 || n === 4);
      });
      btnBack.hidden = n === 1 || n === 4;
      btnNext.hidden = n >= 3;
      btnSubmit.hidden = n !== 3;
      foot.hidden = n === 4;
      $('.termin__body', form).scrollTop = 0;
      const legend = $(`[data-step="${n}"] .termin__legend, [data-step="${n}"] h3`, form);
      if (legend && n > 1) { legend.setAttribute('tabindex', '-1'); legend.focus({ preventScroll: true }); }
      updateSummary();
    }

    function reset() {
      form.reset();
      $$('.field-error', form).forEach((e) => { e.hidden = true; });
      $$('.is-invalid', form).forEach((e) => e.classList.remove('is-invalid'));
      prepOut.hidden = true;
      slotWrap.classList.remove('is-disabled');
      renderDates();
      go(1);
    }

    function open(key, trigger) {
      lastTrigger = trigger || null;
      if (step === 4 || !dateWrap.children.length) reset();
      if (key) {
        const input = $(`input[name="anliegen"][data-key="${key}"]`, form);
        if (input) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      openedAt = Date.now();
      dlg.showModal();
      document.body.classList.add('is-locked');
    }

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-termin]');
      if (!t) return;
      e.preventDefault();
      open(t.dataset.termin, t);
    });
    dlg.addEventListener('close', () => {
      document.body.classList.remove('is-locked');
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    });
    $('[data-termin-close]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    form.addEventListener('change', (e) => {
      if (e.target.name === 'anliegen') {
        fieldError(form, 'anliegen', false);
        $('span', prepOut).textContent = e.target.dataset.prep || '';
        prepOut.hidden = !e.target.dataset.prep;
      }
      if (e.target.name === 'uhrzeit' || e.target.name === 'datum') fieldError(form, 'datum', false);
      if (e.target === flex) {
        slotWrap.classList.toggle('is-disabled', flex.checked);
        fieldError(form, 'datum', false);
      }
      updateSummary();
    });
    form.addEventListener('input', (e) => {
      if (e.target.name && e.target.closest('.field.is-invalid')) fieldError(form, e.target.name, false);
    });

    btnNext.addEventListener('click', () => { if (validate(step)) go(step + 1); });
    btnBack.addEventListener('click', () => go(Math.max(1, step - 1)));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (step !== 3) { if (validate(step)) go(step + 1); return; }
      if (!validate(3)) return;
      if (val('website')) { go(4); return; } // Spam-Falle
      const d = checkedInput('datum');
      const when = flex.checked ? 'zeitlich flexibel – bitte Terminvorschlag' : `${d ? d.dataset.label : ''}, ${val('uhrzeit')} Uhr`;
      const fields = {
        anliegen: val('anliegen'),
        wunschtermin: when,
        name: val('name'),
        telefon: val('telefon'),
        email: val('email'),
        nachricht: val('nachricht'),
        datenschutz: 'akzeptiert',
        website: '',
        _elapsed: String(Math.round((Date.now() - openedAt) / 1000)),
      };
      const body = [
        'Guten Tag,',
        '',
        'ich möchte gerne einen Termin anfragen:',
        '',
        `Anliegen: ${fields.anliegen}`,
        `Wunschtermin: ${fields.wunschtermin}`,
        `Name: ${fields.name}`,
        `Telefon: ${fields.telefon}`,
        `E-Mail: ${fields.email}`,
        fields.nachricht ? `Nachricht: ${fields.nachricht}` : '',
        '',
        'Viele Grüße',
        fields.name,
      ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
      btnSubmit.disabled = true;
      btnSubmit.classList.add('is-loading');
      const res = await sendForm('termin', fields, `Terminanfrage: ${fields.anliegen} – ${fields.name}`, body);
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('is-loading');
      const title = $('[data-done-title]', form);
      const text = $('[data-done-text]', form);
      const mailBtn = $('[data-done-mail]', form);
      $('[data-done-summary]', form).textContent = `${fields.anliegen} · ${when}`;
      if (res.mode === 'sent') {
        title.textContent = 'Danke für Ihre Termin-Anfrage!';
        text.textContent = 'Ihre Anfrage ist bei uns eingegangen. Wir melden uns schnellstmöglich bei Ihnen, um den Termin zu bestätigen.';
        mailBtn.hidden = true;
      } else {
        title.textContent = 'Fast geschafft!';
        text.textContent = 'Wir haben Ihre Anfrage als E-Mail vorbereitet. Bitte senden Sie sie in Ihrem E-Mail-Programm ab – wir melden uns dann schnellstmöglich.';
        mailBtn.href = res.href;
        mailBtn.hidden = false;
        window.location.href = res.href;
      }
      go(4);
    });
  }

  /* ------------------------------------------------------------------
     Kontaktlinsen nachbestellen
     ------------------------------------------------------------------ */
  function initOrder() {
    const form = $('[data-order-form]');
    if (!form) return;
    const startedAt = Date.now();
    const careWrap = $('[data-care-rows]', form);
    const addBtn = $('[data-add-care]', form);
    const addr = $('[data-address]', form);
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const rows = $$('.order-row', careWrap);
        if (rows.length >= 4) return;
        const clone = rows[0].cloneNode(true);
        const n = rows.length + 1;
        $$('select, input', clone).forEach((el) => {
          const base = el.name.replace(/_\d+$/, '');
          el.name = `${base}_${n}`;
          el.id = `${base}-${n}`;
          if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '1';
        });
        $$('label', clone).forEach((l) => { const f = l.getAttribute('for'); if (f) l.setAttribute('for', `${f.replace(/-\d+$/, '')}-${n}`); });
        careWrap.appendChild(clone);
        if (rows.length + 1 >= 4) addBtn.hidden = true;
      });
    }
    form.addEventListener('change', (e) => {
      if (e.target.name === 'lieferung') {
        const ship = e.target.value.startsWith('Versand');
        addr.hidden = !ship;
        $$('input', addr).forEach((i) => { i.required = ship; });
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      let ok = true;
      ['vorname', 'nachname', 'email', 'telefon'].forEach((n) => {
        const v = String(fd.get(n) || '').trim();
        const bad = n === 'email' ? !validEmail(v) : v.length < 2;
        fieldError(form, n, bad);
        if (bad) ok = false;
      });
      const hasProduct = ['produkt_rechts', 'produkt_links', 'pflege_1'].some((n) => fd.get(n));
      fieldError(form, 'produkt', !hasProduct);
      if (!hasProduct) ok = false;
      const consent = !!fd.get('datenschutz');
      fieldError(form, 'datenschutz', !consent);
      if (!consent) ok = false;
      if (!addr.hidden) {
        ['strasse', 'plz', 'ort'].forEach((n) => {
          const bad = String(fd.get(n) || '').trim().length < 2;
          fieldError(form, n, bad);
          if (bad) ok = false;
        });
      }
      if (!ok) {
        const firstErr = $('.field-error:not([hidden])', form);
        if (firstErr) firstErr.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }
      if (fd.get('website')) return;
      const lines = [];
      const prod = (label, p, q) => { if (fd.get(p)) lines.push(`${label}: ${fd.get(p)} – Anzahl ${fd.get(q) || 1}`); };
      prod('Rechtes Auge', 'produkt_rechts', 'anzahl_rechts');
      prod('Linkes Auge', 'produkt_links', 'anzahl_links');
      for (let i = 1; i <= 4; i++) prod(`Pflegemittel ${i}`, `pflege_${i}`, `pflege_anzahl_${i}`);
      lines.push(`Lieferung: ${fd.get('lieferung')}`);
      if (!addr.hidden) lines.push(`Lieferadresse: ${fd.get('strasse')}, ${fd.get('plz')} ${fd.get('ort')}`);
      const name = `${fd.get('anrede') || ''} ${fd.get('vorname')} ${fd.get('nachname')}`.trim();
      lines.push('', `Name: ${name}`, `E-Mail: ${fd.get('email')}`, `Telefon: ${fd.get('telefon')}`);
      if (String(fd.get('nachricht') || '').trim()) lines.push(`Wunsch: ${fd.get('nachricht')}`);
      const fields = { bestellung: lines.join('\n'), name, email: String(fd.get('email')), telefon: String(fd.get('telefon')), nachricht: String(fd.get('nachricht') || ''), datenschutz: 'akzeptiert', website: '', _elapsed: String(Math.round((Date.now() - startedAt) / 1000)) };
      const btn = $('[type="submit"]', form);
      btn.disabled = true;
      const res = await sendForm('bestellung', fields, `Kontaktlinsen-Nachbestellung – ${name}`, `Guten Tag,\n\nich möchte folgende Kontaktlinsen nachbestellen:\n\n${lines.join('\n')}\n\nViele Grüße\n${name}`);
      btn.disabled = false;
      const done = $('[data-order-done]');
      const text = $('[data-order-done-text]', done);
      const mailBtn = $('[data-order-mail]', done);
      if (res.mode === 'sent') {
        text.textContent = 'Ihre Bestellung ist bei uns eingegangen und wird bearbeitet. Wir melden uns, sobald Ihre Kontaktlinsen bereitliegen.';
        mailBtn.hidden = true;
      } else {
        text.textContent = 'Wir haben Ihre Bestellung als E-Mail vorbereitet. Bitte senden Sie sie in Ihrem E-Mail-Programm ab.';
        mailBtn.href = res.href;
        mailBtn.hidden = false;
        window.location.href = res.href;
      }
      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }

  /* ------------------------------------------------------------------
     Start
     ------------------------------------------------------------------ */
  renderStatus();
  setInterval(renderStatus, 60 * 1000);
  initHoursPop();
  initHero();
  initPageHero();
  initLoops();
  initReveal();
  initScrub();
  initTilt();
  initSteps();
  initTour();
  initLightbox();
  initTabs();
  initZones();
  initMap();
  initScrollers();
  initTermin();
  initOrder();
  runScroll();

  // Sprunglinks (z. B. #kontakt von einer Unterseite) nach dem Laden sicher ansteuern
  if (location.hash && location.hash.length > 1 && location.hash !== '#termin') {
    window.addEventListener('load', () => {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 50);
    });
  }

  // Direktlink #termin öffnet den Dialog
  if (location.hash === '#termin') {
    const t = $('[data-termin]');
    if (t) setTimeout(() => t.click(), 400);
  }
})();

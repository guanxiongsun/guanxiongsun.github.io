/* =====================================================================
   site.js: shared behaviour for every page (homepage and project pages).
   One ES module; each feature is a small init function driven by data-*
   hooks, so a page only needs the markup to opt in. Every feature is
   progressive enhancement: the page is complete without this file.

   Hooks (markup → behaviour)
     [data-theme-toggle]            theme button: Auto → Light → Dark
     [data-header]                  sticky header (.is-scrolled after 8px)
     [data-menu-toggle] + [data-menu-panel]   mobile menu disclosure
     .site-nav__link[href*="#"]     scrollspy (aria-current on same-page links)
     .reveal                        fade/rise once when scrolled into view (--i staggers)
     video[data-autoplay] in .plate--video, [data-vid-toggle]   silent research loops
     [data-full] (+ data-caption)   opens the lightbox <dialog>
     [data-copy="#id"], .code-copy  copy text (+ data-copy-msg for the announcement)
     [data-pub-controls] + [data-pub-list]   publication filters (?topic=&first=1)
     [data-ab]                      figure A/B toggle (radios + [data-ab-item])
     a.yt[data-yt]                  YouTube facade (iframe only after click)
     [data-todo]                    hidden in production; html.dev shows + lists them

   Media coordination: anything that plays (videos here, demos in /assets/js/demos)
   dispatches  document.dispatchEvent(new CustomEvent('media:play', {detail: element}))
   when it starts, and pauses itself when it hears media:play from another element.
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotionMQ = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reduceMotionMQ.matches;

/* A single polite live region for short announcements ("Copied", filter counts elsewhere). */
let liveRegion;
export function announce(msg) {
  if (!liveRegion) {
    liveRegion = document.createElement('p');
    liveRegion.className = 'visually-hidden';
    liveRegion.setAttribute('aria-live', 'polite');
    document.body.append(liveRegion);
  }
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = msg; }, 30);
}

const icon = (name, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#${name}"/></svg>`;

/* ---------- data-todo dev mode ---------- */
function initDevMode() {
  const p = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const on = p.get('dev') === '0' ? false : (p.has('dev') || local);
  if (!on) return;
  document.documentElement.classList.add('dev');
  const todos = $$('[data-todo]').map((el) => ({
    todo: el.dataset.todo,
    element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
    text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
  }));
  if (todos.length) { console.info(`data-todo: ${todos.length} item(s) hidden in production (add ?dev=0 to preview production)`); console.table(todos); }
}

/* ---------- Theme: Auto → Light → Dark, persisted in localStorage.theme ---------- */
function initTheme() {
  const btn = $('[data-theme-toggle]');
  const root = document.documentElement;
  const metas = $$('meta[name="theme-color"]');
  metas.forEach((m) => { m.dataset.orig = m.content; });
  const COLORS = { light: '#FAF8F4', dark: '#121110' };
  const NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
  const LABEL = { auto: 'Auto (follows system)', light: 'Light', dark: 'Dark' };
  const read = () => { try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; } };

  const apply = (state, persist) => {
    if (state === 'auto') delete root.dataset.theme; else root.dataset.theme = state;
    if (persist) { try { state === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', state); } catch { /* private mode */ } }
    metas.forEach((m) => { m.content = state === 'auto' ? m.dataset.orig : COLORS[state]; });
    if (btn) {
      btn.dataset.state = state;
      const next = NEXT[state];
      btn.setAttribute('aria-label', `Theme: ${LABEL[state]}. Switch to ${next === 'auto' ? 'auto' : next}`);
    }
  };
  apply(read(), false);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!prefersReducedMotion()) {
      root.classList.add('theme-transition');
      setTimeout(() => root.classList.remove('theme-transition'), 250);
    }
    apply(NEXT[btn.dataset.state || 'auto'], true);
  });
  // Keep several open tabs in sync.
  addEventListener('storage', (e) => { if (e.key === 'theme') apply(read(), false); });
}

/* ---------- Sticky header: hairline once the page has scrolled ---------- */
function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  let ticking = false;
  const update = () => { header.classList.toggle('is-scrolled', scrollY > 8); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- Mobile menu (<840px): disclosure panel under the header ---------- */
function initMenu() {
  const btn = $('[data-menu-toggle]');
  const panel = btn && document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  const setOpen = (open, returnFocus) => {
    btn.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
    if (!open && returnFocus) btn.focus();
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false, true);
  });
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('is-open') && !panel.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });
  matchMedia('(min-width: 840px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------- Scrollspy: mark the nav link of the section in the middle of the viewport ---------- */
function initScrollspy() {
  const links = $$('.site-nav__link').filter((a) => {
    const url = new URL(a.href, location.href);
    return url.pathname === location.pathname && url.hash.length > 1;
  });
  const map = new Map();
  links.forEach((a) => { const sec = document.getElementById(new URL(a.href).hash.slice(1)); if (sec) map.set(sec, a); });
  if (!map.size || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      map.get(en.target).setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((_, sec) => io.observe(sec));
  // Nothing current while the hero is in view.
  const hero = $('#top');
  if (hero) new IntersectionObserver(([en]) => { if (en.isIntersecting) links.forEach((a) => a.removeAttribute('aria-current')); }, { rootMargin: '-40% 0px -55% 0px' }).observe(hero);
}

/* ---------- Reveal: section heads and plates rise in once (never body text) ---------- */
function initReveal() {
  const els = $$('.reveal');
  if (!els.length || prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('reveal-on');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach((el) => io.observe(el));
  // If the user switches to reduced motion mid-visit, show everything at once.
  reduceMotionMQ.addEventListener('change', (e) => { if (e.matches) els.forEach((el) => el.classList.add('is-in')); });
}

/* ---------- Video plates: autoplay in view, pause off-screen, one at a time ---------- */
function initVideos() {
  const videos = $$('.plate--video video[data-autoplay]');
  if (!videos.length) return;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const autoOK = () => !prefersReducedMotion() && !saveData;
  const visible = new Set();

  videos.forEach((v) => {
    const plate = v.closest('.plate--video');
    const btn = plate.querySelector('[data-vid-toggle]');
    v.controls = false;          // markup ships `controls` for no-JS visitors
    v.removeAttribute('autoplay');
    plate.dataset.state = 'paused';
    const sync = () => {
      const playing = !v.paused && !v.ended;
      plate.dataset.state = playing ? 'playing' : 'paused';
      if (btn) btn.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    };
    v.addEventListener('play', () => { sync(); document.dispatchEvent(new CustomEvent('media:play', { detail: v })); });
    v.addEventListener('pause', sync);
    btn?.addEventListener('click', () => {
      if (v.paused) { delete v.dataset.userPaused; v.play().catch(() => {}); }
      else { v.dataset.userPaused = ''; v.pause(); }
    });
  });

  // Only one thing plays at a time (videos and demos share this event).
  document.addEventListener('media:play', (e) => { videos.forEach((v) => { if (v !== e.detail && !v.paused) v.pause(); }); });

  const tryPlay = (v) => { if (autoOK() && !('userPaused' in v.dataset) && !document.hidden) v.play().catch(() => {}); };

  if ('IntersectionObserver' in window) {
    // Upgrade preload shortly before the video scrolls into view.
    const near = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.preload = 'auto'; near.unobserve(en.target); } });
    }, { rootMargin: '200px' });
    const half = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) { visible.add(v); tryPlay(v); } else { visible.delete(v); if (!v.paused) v.pause(); }
      });
    }, { threshold: 0.5 });
    videos.forEach((v) => { near.observe(v); half.observe(v); });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach((v) => v.pause());
    else visible.forEach(tryPlay);
  });
  reduceMotionMQ.addEventListener('change', (e) => { if (e.matches) videos.forEach((v) => v.pause()); });
}

/* ---------- Lightbox: one native <dialog>, full-size image loaded on open ---------- */
function initLightbox() {
  const triggers = $$('[data-full]');
  if (!triggers.length || typeof HTMLDialogElement !== 'function') return;
  let dlg, img, cap, opener;
  const build = () => {
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Enlarged figure');
    dlg.innerHTML = `<figure class="lightbox__figure"><div class="lightbox__scroll"><div class="lightbox__mat"><img class="lightbox__img" alt=""></div></div><figcaption class="lightbox__cap"></figcaption></figure><button class="lightbox__close" type="button" aria-label="Close enlarged figure">${icon('x', 20)}</button>`;
    document.body.append(dlg);
    img = $('.lightbox__img', dlg);
    cap = $('.lightbox__cap', dlg);
    $('.lightbox__close', dlg).addEventListener('click', () => dlg.close());
    // Backdrop click: the dialog itself (not its content) was clicked.
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lightbox__figure')) dlg.close(); });
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('has-lightbox');
      img.removeAttribute('src');
      opener?.focus();
    });
  };
  const open = (trigger) => {
    if (!dlg) build();
    opener = trigger;
    const thumb = trigger.querySelector('img');
    img.alt = thumb ? thumb.alt : (trigger.getAttribute('aria-label') || '').replace(/^Enlarge figure:\s*/, '');
    img.src = trigger.dataset.full;
    cap.textContent = trigger.dataset.caption || '';
    cap.hidden = !cap.textContent;
    document.documentElement.classList.add('has-lightbox');
    dlg.showModal();
    $('.lightbox__close', dlg).focus();
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-full]');
    if (!t || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(t);
  });
}

/* ---------- Copy: [data-copy="#id"] and BibTeX .code-copy buttons ---------- */
function initCopy() {
  const copyText = async (text, el) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      // Fallback (older iOS Safari, insecure contexts): select the text and use execCommand.
      try {
        const range = document.createRange(); range.selectNodeContents(el);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        const ok = document.execCommand('copy'); sel.removeAllRanges(); return ok;
      } catch { return false; }
    }
  };
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy], .code-copy');
    if (!btn) return;
    const src = btn.dataset.copy ? $(btn.dataset.copy) : btn.closest('.code-wrap')?.querySelector('pre');
    if (!src) return;
    // Code keeps its line breaks; prose (email, bio) is copied as one clean line.
    const raw = src.value ?? src.textContent;
    const text = src.closest('pre') ? raw.replace(/\s+$/, '') : raw.replace(/\s+/g, ' ').trim();
    const ok = await copyText(text, src);
    if (!ok) { announce('Copy failed; select the text manually'); return; }
    btn.classList.add('is-copied');
    announce(btn.dataset.copyMsg || 'Copied');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(() => btn.classList.remove('is-copied'), 1600);
  });
}

/* ---------- Publication filters: topic chips + first-author switch, mirrored to the URL ---------- */
function initPubFilters() {
  const controls = $('[data-pub-controls]');
  const list = $('[data-pub-list]');
  if (!controls || !list) return;
  const chips = $$('.chip[data-topic]', controls);
  const sw = $('[data-first-author-switch]', controls);
  const status = $('[data-pub-status]', controls);
  const pubs = $$('.pub', list);
  const years = $$('.pub-year', list);
  const TOPICS = chips.map((c) => c.dataset.topic);
  const tagsOf = (p) => (p.dataset.tags || '').split(/\s+/);
  const matches = (p, topic, first) => (topic === 'all' || tagsOf(p).includes(topic)) && (!first || p.hasAttribute('data-first-author'));

  const state = { topic: 'all', first: false };
  const params = new URLSearchParams(location.search);
  if (TOPICS.includes(params.get('topic'))) state.topic = params.get('topic');
  state.first = params.get('first') === '1';

  const render = (writeURL) => {
    let shown = 0;
    pubs.forEach((p) => { const ok = matches(p, state.topic, state.first); p.hidden = !ok; if (ok) shown++; });
    years.forEach((y) => { y.hidden = !$$('.pub', y).some((p) => !p.hidden); });
    chips.forEach((c) => {
      c.setAttribute('aria-pressed', String(c.dataset.topic === state.topic));
      const n = pubs.filter((p) => matches(p, c.dataset.topic, state.first)).length;
      const count = $('[data-count]', c); if (count) count.textContent = n;
    });
    sw?.setAttribute('aria-checked', String(state.first));
    if (status) status.textContent = shown ? `Showing ${shown} of ${pubs.length} publication${pubs.length === 1 ? '' : 's'}` : 'No publications match these filters. Choose All or turn off First-author only.';
    if (writeURL) {
      const u = new URL(location.href);
      state.topic === 'all' ? u.searchParams.delete('topic') : u.searchParams.set('topic', state.topic);
      state.first ? u.searchParams.set('first', '1') : u.searchParams.delete('first');
      history.replaceState(history.state, '', u);
    }
  };
  chips.forEach((c) => c.addEventListener('click', () => { state.topic = c.dataset.topic; render(true); }));
  sw?.addEventListener('click', () => { state.first = !state.first; render(true); });

  // A link to a publication that the current filter hides resets the filter first.
  const reveal = (hash) => {
    const target = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target && target.classList.contains('pub') && target.hidden) { state.topic = 'all'; state.first = false; render(true); }
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#pub-"]');
    if (a) reveal(new URL(a.getAttribute('href'), location.href).hash); // getAttribute: SVG <a> (throughline nodes) has no string .href
  }, true);
  addEventListener('hashchange', () => reveal(location.hash));
  render(false);
  reveal(location.hash);
}

/* ---------- Figure A/B toggle: radios select which [data-ab-item] is shown ---------- */
function initAB() {
  $$('[data-ab]').forEach((fig) => {
    const radios = $$('input[type="radio"]', fig);
    const items = $$('[data-ab-item]', fig);
    if (!radios.length) return;
    const show = (key) => items.forEach((el) => {
      const on = el.dataset.abItem === key;
      el.classList.toggle('is-active', on);
      if (el.tagName === 'IMG') el.setAttribute('aria-hidden', String(!on)); else el.hidden = false;
    });
    radios.forEach((r) => r.addEventListener('change', () => r.checked && show(r.value)));
    show((radios.find((r) => r.checked) || radios[0]).value);
    fig.classList.add('is-ready');
  });
}

/* ---------- YouTube facade: swap the link for a no-cookie iframe on click ---------- */
function initYouTube() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.yt[data-yt]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const id = encodeURIComponent(a.dataset.yt);
    const f = document.createElement('iframe');
    f.className = 'yt-frame';
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    f.title = a.dataset.title || a.textContent.trim() || 'YouTube video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    a.replaceWith(f);
    f.focus();
    document.dispatchEvent(new CustomEvent('media:play', { detail: f }));
  });
}

/* Make horizontally scrollable code blocks keyboard-reachable (WCAG 2.1.1). */
function initScrollables() {
  $$('pre.code').forEach((pre) => { if (pre.scrollWidth > pre.clientWidth + 1) pre.tabIndex = 0; });
}

/* Run every init independently so one failure never blocks the rest. */
[initDevMode, initTheme, initHeader, initMenu, initScrollspy, initReveal, initVideos,
 initLightbox, initCopy, initPubFilters, initAB, initYouTube, initScrollables].forEach((fn) => {
  try { fn(); } catch (err) { console.error(`site.js ${fn.name}:`, err); }
});

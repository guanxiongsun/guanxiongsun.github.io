/* =====================================================================
   article.js: project-page behaviour, plus a small helper API for the
   explorable demos in /assets/js/demos/. One ES module; the inits below run
   on import (guarded, like site.js). Everything is progressive enhancement:
   a project page reads completely without this file.

   Hooks (markup → behaviour; full markup in /projects/_template/index.html)
     [data-toc]         <nav class="toc"> with <details class="toc__box"> and <ol class="toc__list">.
                        An empty list is filled from .article__section[id] > h2 (h2[data-toc-label]
                        overrides the text). Scrollspy sets aria-current. At ≥1200 the TOC becomes a
                        sticky left-margin rail and fades while a .wide/.full block passes under it.
     [data-hotspots]    hotspot figure: each button.hotspot names its list item with aria-describedby.
                        Hover/focus highlights the pair; click/tap pins it (and scrolls the item into
                        view); the figure is one tab stop (roving tabindex): arrow keys / Home / End
                        move between hotspots; Esc clears.
     [data-stepper]     frame stepper: rect[data-step="k"] inside svg.stepper__overlay are the holes
                        for step k. Builds the dimming masks and the controls (1…N, All, prev/next,
                        play). data-label="Frame", data-start="all"|k, data-interval=ms (900),
                        data-autoplay (only with motion allowed, only in view). ?debug outlines rects.

   Exports (for demo modules). Import with the SAME ?v= as the page's own <script> tag,
   e.g.  import { createPlayer } from '/assets/js/article.js?v=20261005';
     mulberry32(seed)                  → rand(): float in [0, 1); same seed, same sequence
     reducedMotion()                   → true when the visitor prefers reduced motion (live)
     onReducedMotion(fn)               → fn(matches) on every change; returns an unsubscribe fn
     onNear(el, fn, margin = '300px')  → run fn() once when el comes within margin of the viewport
                                         (or when focus enters el). Demo modules should NOT
                                         gate init() on it: see docs/HOWTO.md "Explorables".
     createPlayer(root, opts)          → playback loop, one-at-a-time across the page:
         opts: { interval = 500 (ms, number or () => number), tick() (return false to stop),
                 onChange(playing), autoplay = false }
         player.play(user = true) / .pause(user = true) / .toggle() / .playing (wanted state)
         Runs only while root is in view (≥50% visible, or as much of it as fits in 90% of the
         viewport) and the tab is visible; resumes when back. After a user play it keeps
         running while any part of root is on screen, and stops once root has fully left.
         Starting dispatches document 'media:play' {detail: root}; any other 'media:play'
         (site.js video plates, the YouTube facade, other demos) pauses it. autoplay never
         happens under reduced motion or after the user paused; a reduced-motion switch pauses.
     createAnnouncer(el, { every = 5 }) → { say(text, { playing = false, force = false }) }
         Writes to a polite live region (el gets aria-live="polite"); while playing only every
         `every`-th call is spoken; identical text is skipped.
     syncPlayButton(btn, playing, { play = 'Play', pause = 'Pause' })
         Sets data-playing on .play-btn and the text of its .play-btn__label.
     bindRange(input, output?, fmt = String) → sync(): keeps the --val fill and <output> in step.
   ===================================================================== */

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SVGNS = 'http://www.w3.org/2000/svg';
const rmMQ = matchMedia('(prefers-reduced-motion: reduce)');
const desktopMQ = matchMedia('(min-width: 1200px)');
const icon = (name) => `<svg class="icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#${name}"/></svg>`;

/* ---------- Exported helpers ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const reducedMotion = () => rmMQ.matches;
export function onReducedMotion(fn) {
  const h = (e) => fn(e.matches);
  rmMQ.addEventListener('change', h);
  return () => rmMQ.removeEventListener('change', h);
}

export function onNear(el, fn, rootMargin = '300px') {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  let done = false;
  const run = () => { if (done) return; done = true; io.disconnect(); el.removeEventListener('focusin', run); fn(); };
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) run(); }, { rootMargin });
  io.observe(el);
  el.addEventListener('focusin', run); // keyboard (or find-in-page) arrival also counts
}

export function createPlayer(root, { interval = 500, tick = () => true, onChange = () => {}, autoplay = false } = {}) {
  let want = false, userPaused = false, userStarted = false, visible = false, ratio = 0, timer = 0, running = false;
  const ms = () => (typeof interval === 'function' ? interval() : interval);
  const canRun = () => want && visible && !document.hidden;
  const stop = () => { clearTimeout(timer); timer = 0; running = false; };
  const loop = () => {
    timer = setTimeout(() => {
      if (!canRun()) { stop(); return; }
      if (tick() === false) { setWant(false); return; }
      loop();
    }, ms());
  };
  const sync = () => {
    if (canRun() && !running) {
      running = true;
      document.dispatchEvent(new CustomEvent('media:play', { detail: root }));
      loop();
    } else if (!canRun() && running) stop();
  };
  function setWant(v) {
    if (want === v) { sync(); return; }
    want = v; sync(); onChange(want);
  }
  const maybeAutoplay = () => { if (autoplay && visible && !userPaused && !want && !rmMQ.matches) setWant(true); };

  document.addEventListener('media:play', (e) => { if (e.detail !== root && want) setWant(false); });
  document.addEventListener('visibilitychange', sync);
  rmMQ.addEventListener('change', (e) => { if (e.matches && want) setWant(false); });
  // "In view" = at least half visible, or as much as fits (a root taller than 2x the viewport
  // can never reach 50%). A user-started player keeps running while any part is on screen and
  // stops once the root has left the viewport completely.
  const seen = () => ratio > 0 && ratio >= Math.min(0.5, (0.9 * innerHeight) / (root.getBoundingClientRect().height || 1));
  const update = () => { visible = seen() || (userStarted && ratio > 0); sync(); maybeAutoplay(); };
  if ('IntersectionObserver' in window) {
    const steps = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5];
    new IntersectionObserver(([en]) => {
      ratio = en.isIntersecting ? en.intersectionRatio : 0;
      if (!ratio) userStarted = false;
      update();
    }, { threshold: steps }).observe(root);
  } else visible = true;

  return {
    get playing() { return want; },
    play(user = true) {
      if (user) { userPaused = false; userStarted = true; if (!visible) visible = true; } // a click proves it is on screen
      setWant(true);
    },
    pause(user = true) { if (user) userPaused = true; setWant(false); },
    toggle() { want ? this.pause() : this.play(); },
  };
}

export function createAnnouncer(el, { every = 5 } = {}) {
  if (el && !el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');
  let n = 0, last = '';
  return {
    say(text, { playing = false, force = false } = {}) {
      if (!el) return;
      if (playing && !force && (n++ % every)) return;
      if (!playing) n = 0;
      if (text !== last) { el.textContent = text; last = text; }
    },
  };
}

export function syncPlayButton(btn, playing, { play = 'Play', pause = 'Pause' } = {}) {
  if (!btn) return;
  btn.dataset.playing = String(!!playing);
  const label = btn.querySelector('.play-btn__label');
  if (label) label.textContent = playing ? pause : play;
  else btn.setAttribute('aria-label', playing ? pause : play);
}

export function bindRange(input, output, fmt = String) {
  const sync = () => {
    const min = +input.min || 0, max = input.max === '' ? 100 : +input.max;
    input.style.setProperty('--val', `${((+input.value - min) / (max - min || 1)) * 100}%`);
    if (output) output.value = fmt(+input.value);
  };
  input.addEventListener('input', sync);
  sync();
  return sync;
}

/* ---------- TOC: fill, scrollspy, desktop rail ---------- */
function initTOC() {
  const toc = document.querySelector('[data-toc]');
  if (!toc) return;
  const box = toc.querySelector('.toc__box');
  const list = toc.querySelector('.toc__list');
  const article = toc.closest('.article');
  if (list && !list.children.length) {
    list.innerHTML = $$('.article__section[id] > h2').map((h) => {
      const sec = h.parentElement;
      const label = h.dataset.tocLabel || h.textContent.trim();
      return `<li><a href="#${sec.id}">${label.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</a></li>`;
    }).join('');
  }
  const links = $$('a[href^="#"]', toc);
  const map = new Map();
  links.forEach((a) => { const t = document.getElementById(decodeURIComponent(a.hash.slice(1))); if (t) map.set(t, a); });

  const setCurrent = (a) => links.forEach((l) => (l === a ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
  if ('IntersectionObserver' in window && map.size) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(map.get(en.target)); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    map.forEach((_, sec) => io.observe(sec));
    // Above the first section nothing is current.
    const first = [...map.keys()][0];
    addEventListener('scroll', () => { if (first.getBoundingClientRect().top > innerHeight * 0.4) setCurrent(null); }, { passive: true });
  }

  // Mobile: a chosen link closes the box. Desktop: always open, summary is a label.
  toc.addEventListener('click', (e) => { if (e.target.closest('a') && !desktopMQ.matches && box) box.open = false; });
  if (!box || !article) return;
  const summary = box.querySelector('summary');
  const wides = $$(':scope > .wide, :scope > .full, :scope > .article__section > .wide, :scope > .article__section > .full', article);
  let ticking = false;
  const cover = () => {
    ticking = false;
    if (!desktopMQ.matches) { toc.classList.remove('is-covered'); return; }
    const r = box.getBoundingClientRect();
    toc.classList.toggle('is-covered', wides.some((w) => { const b = w.getBoundingClientRect(); return b.top < r.bottom + 16 && b.bottom > r.top - 16; }));
  };
  const place = () => {
    if (desktopMQ.matches) {
      // The rail starts where the TOC stands in the flow (the next block's top).
      const next = toc.nextElementSibling;
      toc.style.setProperty('--toc-top', `${next ? next.offsetTop : 0}px`);
      box.open = true;
      summary?.setAttribute('tabindex', '-1');
    } else {
      summary?.removeAttribute('tabindex');
    }
    cover();
  };
  box.addEventListener('toggle', () => { if (desktopMQ.matches && !box.open) box.open = true; });
  desktopMQ.addEventListener('change', place);
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(place)).observe(article);
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(cover); } }, { passive: true });
  place();
}

/* ---------- Hotspot figures ---------- */
function initHotspots() {
  $$('[data-hotspots]').forEach((fig) => {
    const spots = $$('.hotspot', fig);
    const pairs = spots.map((b) => ({ b, li: document.getElementById((b.getAttribute('aria-describedby') || '').split(/\s+/)[0]) }));
    let pinned = null;
    // Roving tabindex: the figure is one tab stop; arrows / Home / End move within it.
    const rove = (b) => spots.forEach((x) => { x.tabIndex = x === b ? 0 : -1; });
    rove(spots[0]);
    const frame = fig.querySelector('.hotspots__frame');
    if (frame && spots.length > 1 && !frame.hasAttribute('role')) {
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-label', `${spots.length} numbered hotspots; arrow keys move between them`);
    }
    const show = (p) => pairs.forEach((q) => { const on = q === p || q === pinned; q.b.classList.toggle('is-active', on); q.li?.classList.toggle('is-active', on); });
    pairs.forEach((p) => {
      p.b.addEventListener('mouseenter', () => show(p));
      p.b.addEventListener('mouseleave', () => show(null));
      p.b.addEventListener('focus', () => { rove(p.b); show(p); });
      p.b.addEventListener('blur', () => show(null));
      p.b.addEventListener('click', () => {
        pinned = pinned === p ? null : p;
        show(p);
        if (pinned && p.li) {
          const r = p.li.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight) p.li.scrollIntoView({ block: 'nearest', behavior: rmMQ.matches ? 'auto' : 'smooth' });
        }
      });
      p.li?.addEventListener('mouseenter', () => show(p));
      p.li?.addEventListener('mouseleave', () => show(null));
    });
    fig.addEventListener('keydown', (e) => {
      const i = spots.indexOf(e.target);
      if (e.key === 'Escape' && (pinned || i > -1)) { pinned = null; show(null); return; }
      if (i < 0) return;
      const n = spots.length;
      const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      spots[(j + n) % n].focus();
    });
    document.addEventListener('click', (e) => { if (pinned && !fig.contains(e.target)) { pinned = null; show(null); } });
  });
}

/* ---------- Frame steppers ---------- */
function initSteppers() {
  const debug = new URLSearchParams(location.search).has('debug');
  $$('[data-stepper]').forEach((fig, fi) => {
    const svg = fig.querySelector('.stepper__overlay');
    if (!svg) return;
    const rects = $$('rect[data-step]', svg);
    const steps = [...new Set(rects.map((r) => r.dataset.step))].sort((a, b) => a - b);
    const N = steps.length;
    if (!N) return;
    const vb = svg.viewBox.baseVal;
    const full = (el) => { ['x', 'y', 'width', 'height'].forEach((k, i) => el.setAttribute(k, [vb.x, vb.y, vb.width, vb.height][i])); return el; };
    const mk = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
    const defs = mk('defs');
    const dims = new Map();
    steps.forEach((k) => {
      const id = `stepper${fi}-m${k}`;
      const mask = full(mk('mask', { id, maskUnits: 'userSpaceOnUse' }));
      mask.append(full(mk('rect', { fill: '#fff' })));
      rects.filter((r) => r.dataset.step === k).forEach((r) => {
        const hole = r.cloneNode();
        hole.removeAttribute('data-step');
        hole.setAttribute('fill', '#000');
        mask.append(hole);
      });
      defs.append(mask);
      const dim = full(mk('rect', { class: 'stepper__dim', mask: `url(#${id})` }));
      dims.set(k, dim);
    });
    svg.prepend(defs);
    dims.forEach((d) => svg.insertBefore(d, defs.nextSibling));
    if (debug) {
      fig.classList.add('is-debug');
      rects.forEach((r) => {
        const t = mk('text', { class: 'stepper__debug', x: +r.getAttribute('x') + 12, y: +r.getAttribute('y') + 48 });
        t.textContent = r.dataset.step;
        svg.append(t);
      });
    }

    const label = fig.dataset.label || 'Step';
    const name = `stepper-${fi}`;
    let controls = fig.querySelector('[data-stepper-controls]');
    if (!controls) { controls = document.createElement('div'); controls.className = 'stepper__controls'; fig.querySelector('.plate__mat')?.after(controls); }
    const opt = (v, text) => `<label class="seg__opt"><input type="radio" name="${name}" value="${v}"${v === 'all' ? '' : ` aria-label="${label} ${v} of ${N}"`}><span>${text}</span></label>`;
    controls.innerHTML = `<fieldset class="seg stepper__seg"><legend class="visually-hidden">Show ${label.toLowerCase()}</legend>${steps.map((k) => opt(k, k)).join('')}${opt('all', 'All')}</fieldset>`
      + `<span class="stepper__btns"><button class="btn-icon" type="button" data-step-prev aria-label="Previous ${label.toLowerCase()}">${icon('step-back')}</button>`
      + `<button class="btn-icon" type="button" data-step-next aria-label="Next ${label.toLowerCase()}">${icon('step-forward')}</button>`
      + `<button class="btn btn--ghost btn--sm play-btn" type="button" data-step-play>${icon('play').replace('class="icon"', 'class="icon play-btn__play"')}${icon('pause').replace('class="icon"', 'class="icon play-btn__pause"')}<span class="play-btn__label">Play</span></button></span>`;
    const radios = $$('input', controls);
    const status = fig.querySelector('[data-stepper-status]');
    const playBtn = controls.querySelector('[data-step-play]');
    let cur = 'all';

    const go = (k) => {
      cur = k;
      dims.forEach((d, key) => d.classList.toggle('is-on', key === k));
      radios.forEach((r) => { r.checked = r.value === k; });
      if (status) status.textContent = k === 'all' ? `All ${N} ${label.toLowerCase()}s` : `${label} ${k} of ${N}`;
    };
    const idx = () => steps.indexOf(cur);
    const next = () => go(steps[(idx() + 1) % N]);          // from "all" (index -1) → first
    const prev = () => { const i = idx(); go(steps[i <= 0 ? N - 1 : i - 1]); }; // from "all" → last

    const player = createPlayer(fig, {
      interval: () => +fig.dataset.interval || 900,
      tick: () => { next(); return true; },
      onChange: (p) => syncPlayButton(playBtn, p),
      autoplay: fig.hasAttribute('data-autoplay'),
    });
    const user = (fn) => () => { player.pause(); fn(); };
    radios.forEach((r) => r.addEventListener('change', () => { if (r.checked) { player.pause(); go(r.value); } }));
    controls.querySelector('[data-step-next]').addEventListener('click', user(next));
    controls.querySelector('[data-step-prev]').addEventListener('click', user(prev));
    playBtn.addEventListener('click', () => {
      if (player.playing) player.pause();
      else { if (cur === 'all') go(steps[0]); player.play(); }
    });
    const start = fig.dataset.start;
    go(steps.includes(start) ? start : 'all');
    syncPlayButton(playBtn, false);
  });
}

/* Run each init independently; the guard stops a second module instance (another ?v=). */
if (!('articleInit' in document.documentElement.dataset)) {
  document.documentElement.dataset.articleInit = '';
  [initTOC, initHotspots, initSteppers].forEach((fn) => {
    try { fn(); } catch (err) { console.error(`article.js ${fn.name}:`, err); }
  });
}

/* throughline.js: "The Throughline", the homepage signature figure (spec §5). No libraries.
   Data: every [data-thread] element on the page (pub cards + vision teaser cards); see index.html §02 and the Vision teaser in §05.
   ≥840px: an inline SVG (lanes × years, the memory thread, a hatched Next column). When the box is
   ≥900px wide the lane legend (ul.throughline__legend) is drawn into the gutter as lane name +
   description, and the usage hint (p.throughline__hint) into the year row; the HTML legend and hint then
   hide (the legend stays for assistive tech). Between 840 and 900px the HTML hint and a compact legend show.
   <840px: a vertical HTML rail grouped by lane (the group headers repeat the legend, which is then
   aria-hidden so it is read once), one row per node.
   The no-JS list (.throughline__fallback) hides once [data-ready] is set.
   Adding a paper = adding a [data-thread] card; the figure redraws itself. */

const box = document.querySelector('[data-throughline]');
const NS = 'http://www.w3.org/2000/svg';
const LANES = ['perceive', 'generate', 'learn', 'act'];
const LANE_Y = [46, 90, 134, 178]; // lane centres (px); the figure is H px tall
const H = 212, TOP = 26, BOT = 206, YEAR_Y = 14; // frame: gridlines run TOP..BOT, year labels at YEAR_Y
const UP = -13, DN = 24; // label baselines above / below a node
const INLINE_W = 900, GUT_INLINE = 300, GUT_NAMES = 128; // gutter: legend inline (name + text) vs names only
const DRAW = 1400; // draw time (= --dur-draw)
const EASE = 'cubic-bezier(.65,0,.35,1)'; // --ease-inout
const wide = matchMedia('(min-width: 840px)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const icon = (id) => `<svg class="icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#${id}"/></svg>`;
const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e);
  return e;
};

if (box) try { init(); } catch (e) { console.error('throughline:', e); }

function init() {
  // ---- Data. Ties on data-date keep page order reversed (the page lists newest first).
  const all = [...document.querySelectorAll('[data-thread]')].map((card, i) => {
    const d = card.dataset, year = +d.date.slice(0, 4), venue = d.venue || '';
    return {
      key: d.key, short: d.short, date: d.date, year, lane: d.lane, note: d.note || '', href: d.href, thumb: d.thumb, i,
      flag: 'flagship' in d, future: d.status === 'in-progress',
      meta: /\d{4}/.test(venue) ? venue : `${venue} · ${year}`,
      title: card.querySelector('.pub__title, h3')?.textContent.trim() || d.short,
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || b.i - a.i);
  const y0 = all[0].year, years = all.at(-1).year - y0 + 1;
  const bx = box.dataset;
  // Lane descriptions come from the HTML legend, so they are written once.
  const legend = document.querySelector('.throughline__legend');
  const laneText = Object.fromEntries(LANES.map((l) => [l, legend?.querySelector(`.lane[data-lane="${l}"] .lane__text`)?.textContent.trim() || '']));
  const hint = document.querySelector('.throughline__hint')?.textContent.trim() || bx.hint || '';
  all.push({ key: 'open', open: true, future: true, lane: 'act', short: bx.openLabel || 'Your project?', href: bx.openHref || '/collaborate/',
    meta: 'Next', title: bx.openLabel || 'Your project?', note: bx.openNote || 'Open problems in memory for perception and action.' });
  const lastPub = all.findLastIndex((n) => !n.future);
  const byKey = Object.fromEntries(all.map((n) => [n.key, n]));
  const nodeOf = (t) => byKey[t?.closest?.('.tl__node')?.dataset.key];
  const kicker = (n) => n.open ? 'Next · Act' : `${n.meta} · ${cap(n.lane)}`;

  let svg, pop, active, cur = all[0], drawn = false, ptype = '', lastW = 0, mode, rt, hideT;
  let io, settle; // entrance observer for the current SVG; settle() skips the entrance (focus arrived first)
  let wrapped = []; // gutter texts to re-wrap once web fonts load: [{ t, s, w }]

  // Greedy word wrap of s into <tspan>s of width ≤ w (measured, so it follows the loaded font).
  function wrapText(t, s, w) {
    t.textContent = '';
    const x = t.getAttribute('x'), lh = +t.dataset.lh;
    let line = null, n = 0;
    for (const word of s.split(' ')) {
      if (line) {
        const was = line.textContent;
        line.textContent = `${was} ${word}`;
        if (line.getComputedTextLength() <= w) continue;
        line.textContent = was;
      }
      line = el('tspan', { x, dy: n++ ? lh : 0 }, t);
      line.textContent = word;
    }
    return n;
  }

  // ---- Desktop: SVG ----
  function drawSvg(W) {
    const inline = W >= INLINE_W, GUT = inline ? GUT_INLINE : GUT_NAMES;
    const cols = years + 1, colW = (W - GUT - 48) / cols, cx = (c) => GUT + colW * (c + 0.5);
    svg = el('svg', { class: 'tl', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'group',
      'aria-label': `Research timeline, ${y0} to ${y0 + years - 1}, then next. Use arrow keys to move between papers.` });
    const pat = el('pattern', { id: 'tl-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
    el('line', { class: 'tl__hatch', x1: 0, y1: 0, x2: 0, y2: 6 }, pat);

    // Frame: gridlines, lane guides and labels, year labels, the hatched Next column.
    const f = el('g', { class: 'tl__frame', 'aria-hidden': 'true' }, svg);
    const text = (cls, x, y, s, anchor = 'middle') => { const t = el('text', { class: cls, x, y, 'text-anchor': anchor }, f); t.textContent = s; return t; };
    for (let c = 0; c < years; c++) {
      el('line', { class: 'tl__grid', x1: GUT + colW * c, y1: TOP, x2: GUT + colW * c, y2: BOT }, f);
      text('tl__year', cx(c), YEAR_Y, y0 + c);
    }
    const nx = GUT + colW * years;
    el('rect', { class: 'tl__next', x: nx + 6, y: TOP, width: colW - 12, height: BOT - TOP, rx: 4 }, f);
    text('tl__year tl__year--next', cx(years), YEAR_Y, 'NEXT');
    // Gutter: lane names; with the legend inline, each lane's description sits under its name
    // (two 11px lines fit the 44px lane pitch) and the usage hint takes the year row.
    wrapped = [];
    const gw = GUT - 24;
    LANES.forEach((l, i) => {
      el('line', { class: 'tl__guide', x1: GUT - 16, y1: LANE_Y[i], x2: W - 24, y2: LANE_Y[i] }, f);
      text(`tl__lane tl__lane--${l}${inline ? ' tl__lane--inline' : ''}`, 0, LANE_Y[i] + (inline ? -8 : 4), l.toUpperCase(), 'start');
      if (inline && laneText[l]) {
        const t = text('tl__lanetext', 0, LANE_Y[i] + 6, '', 'start');
        t.dataset.lh = 13;
        wrapped.push({ t, s: laneText[l], w: gw });
      }
    });
    if (inline && hint) { // the year row is free up to the first year label
      const t = text('tl__hint', 0, YEAR_Y, '', 'start');
      t.dataset.lh = 13;
      wrapped.push({ t, s: hint, w: cx(0) - 36 });
    }
    box.dataset.legend = inline ? 'inline' : '';

    // Positions: nodes sharing a year and lane sit side by side, in date order.
    const cells = {};
    all.forEach((n) => { n.col = n.open ? years : n.year - y0; (cells[n.col + n.lane] ||= []).push(n); });
    Object.values(cells).forEach((list) => list.forEach((n, k) => {
      n.cell = list;
      n.x = cx(n.col) + (k - (list.length - 1) / 2) * (list.length > 2 ? 22 : 24);
      n.y = LANE_Y[LANES.indexOf(n.lane)];
    }));

    // The thread: straight within a lane, an S-curve between lanes.
    const seg = (a, b) => a.lane === b.lane ? `L${b.x} ${b.y}` : `C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
    const path = (list) => list.reduce((d, n, i) => d + (i ? seg(list[i - 1], n) : `M${n.x} ${n.y}`), '');
    const solid = el('path', { class: 'tl__thread' }, svg);
    const future = el('path', { class: 'tl__thread tl__thread--future', d: path(all.slice(lastPub)) }, svg);

    // Nodes: SVG links with roving tabindex. Labels always show for flagship/in-progress/open nodes.
    const g = el('g', { class: 'tl__nodes' }, svg);
    all.forEach((n) => {
      const type = n.open ? 'open' : n.future ? 'future' : n.flag ? 'flag' : 'pub';
      const quiet = type === 'pub', pair = n.cell.length === 2, k = n.cell.indexOf(n);
      const a = n.el = el('a', { class: `tl__node tl__node--${type}${quiet ? ' tl__node--quiet' : ''}`, href: n.href,
        transform: `translate(${n.x} ${n.y})`, tabindex: n === cur ? 0 : -1, 'data-key': n.key,
        'aria-label': n.open ? `${n.short} Next: see open problems.` : `${n.short}, ${n.meta}, ${cap(n.lane)}. ${n.note}` }, g);
      const glyph = el('g', { class: 'tl__glyph' }, a);
      el('circle', { class: 'tl__hit', r: 16 }, glyph);
      el('circle', { class: 'tl__ring', r: n.open ? 14 : 11 }, glyph);
      el('circle', { class: 'tl__dot', r: { pub: 5, flag: 6.5, future: 6, open: 9 }[type] }, glyph);
      if (n.open) el('path', { class: 'tl__plus', d: 'M-4 0H4M0-4V4' }, glyph);
      // Default label spot. In the Act lane the thread arrives from the upper left, so the first
      // in-progress node (Physical AI) labels below; MemVLA and the open node label above, centred,
      // clear of the Next column's border. declutter() starts from n.ly.
      const below = n.future && pair && k === 0;
      const centred = n.open || (n.future && pair && k === 1);
      n.ly = below ? DN : UP;
      el('text', { class: 'tl__label', x: pair && !centred ? (k ? -6 : 6) : 0, y: n.ly,
        'text-anchor': centred ? 'middle' : pair ? (k ? 'start' : 'end') : 'middle' }, a).textContent = n.short;
    });
    box.append(svg);
    wrapped.forEach(({ t, s, w }) => wrapText(t, s, w));
    declutter();

    // Entrance: draw the thread once, on first sight; nodes pop in as the pen reaches them.
    const pubs = all.slice(0, lastPub + 1);
    if (drawn || reduce.matches || !('IntersectionObserver' in window)) { drawn = true; solid.setAttribute('d', path(pubs)); return; }
    const dist = pubs.map((n, i) => { solid.setAttribute('d', path(pubs.slice(0, i + 1))); return i ? solid.getTotalLength() : 0; });
    const L = dist.at(-1) || 1;
    svg.classList.add('is-pending');
    // Keyboard focus can reach a node before the figure scrolls into view: show it at once.
    settle = () => { io.disconnect(); drawn = true; svg.classList.remove('is-pending'); settle = null; };
    io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      settle = null;
      if (drawn) return;
      drawn = true;
      svg.classList.remove('is-pending');
      solid.setAttribute('stroke-dasharray', L);
      solid.animate({ strokeDashoffset: [L, 0] }, { duration: DRAW, easing: EASE }).onfinish = () => solid.removeAttribute('stroke-dasharray');
      const popIn = (n, delay) => {
        const o = { duration: 320, delay, easing: 'cubic-bezier(.22,.8,.26,1)', fill: 'backwards' };
        n.el.animate({ opacity: [0, 1] }, o);
        n.el.firstChild.animate({ transform: ['scale(.6)', 'none'] }, o);
      };
      pubs.forEach((n, i) => popIn(n, invEase(dist[i] / L) * DRAW));
      future.animate({ opacity: [0, 1] }, { duration: 480, delay: DRAW, fill: 'backwards' });
      all.slice(lastPub + 1).forEach((n, k) => popIn(n, DRAW + 120 * k));
    }, { threshold: 0.35 });
    io.observe(svg);
  }

  // An always-on label that would overlap an earlier one (same lane, same side of the line)
  // flips to the other side of its node.
  function declutter() {
    const seen = [];
    all.forEach((n) => {
      if (!n.el || n.el.classList.contains('tl__node--quiet')) return;
      const t = n.el.querySelector('.tl__label');
      let ly = n.ly ?? UP;
      t.setAttribute('y', ly);
      const b = t.getBBox(), l = n.x + b.x, r = l + b.width;
      if (seen.some((o) => o.y === n.y && o.ly === ly && o.l < r + 8 && l < o.r + 8)) t.setAttribute('y', ly = ly < 0 ? DN : UP);
      seen.push({ y: n.y, ly, l, r });
    });
  }

  // ---- Mobile: vertical rail, grouped by lane (the lane header is the legend), one row per node ----
  function drawRail() {
    const item = (n) => {
      const type = n.open ? 'open' : n.future ? 'future' : n.flag ? 'flag' : 'pub';
      const note = n.future ? `<p class="tl-rail__note">${esc(n.note)}</p>` : '';
      return `<li class="tl-rail__item tl-rail__item--${type}"><a class="tl-rail__row" href="${esc(n.href)}">` +
        `<span class="tl-rail__label">${esc(n.short)}</span> <span class="tl-rail__meta">${esc(n.meta)}</span></a>${note}</li>`;
    };
    const ol = document.createElement('ol');
    ol.className = 'tl-rail';
    ol.setAttribute('aria-label', 'Research timeline by lane, oldest first');
    ol.innerHTML = LANES.map((l) => {
      const list = all.filter((n) => n.lane === l);
      return `<li class="tl-rail__lane${list.every((n) => n.future) ? ' is-future' : ''}" data-lane="${l}">` +
        `<p class="kicker tl-rail__name">${cap(l)}</p>${laneText[l] ? `<p class="tl-rail__text">${esc(laneText[l])}</p>` : ''}` +
        `<ol class="tl-rail__list">${list.map(item).join('')}</ol></li>`;
    }).join('');
    box.append(ol);
    box.dataset.legend = 'inline';
  }

  // ---- Popover (desktop): shows on hover or focus; first touch tap shows it without navigating ----
  pop = document.createElement('div');
  pop.className = 'tl-pop';
  pop.hidden = true;
  pop.innerHTML = '<span class="plate plate--thumb tl-pop__plate"><span class="plate__mat"><img alt="" width="640" height="320" decoding="async"></span></span>' +
    '<p class="kicker tl-pop__kicker"></p><p class="tl-pop__title" id="tl-pop-title"></p><p class="tl-pop__note"></p><a class="link-arrow link-arrow--sm tl-pop__cta"></a><span class="tl-pop__arrow" aria-hidden="true"></span>';
  const q = (s) => pop.querySelector(s);

  function show(n, touch) {
    clearTimeout(hideT);
    if (!svg?.isConnected) return;
    if (active !== n) {
      active?.el.removeAttribute('aria-describedby');
      q('.tl-pop__plate').hidden = !n.thumb;
      if (n.thumb) q('img').src = n.thumb;
      q('.tl-pop__kicker').textContent = kicker(n);
      q('.tl-pop__title').textContent = n.title;
      q('.tl-pop__note').textContent = n.note;
      const cta = q('.tl-pop__cta'), down = !n.flag && !n.open;
      cta.href = n.href;
      cta.classList.toggle('link-arrow--down', down);
      cta.innerHTML = (n.open ? 'See open problems' : n.flag ? 'Open project' : n.future ? 'Read more' : 'See paper') + icon(down ? 'arrow-down' : 'arrow-right');
      n.el.setAttribute('aria-describedby', 'tl-pop-title');
      active = n;
    }
    // Dim other lanes; hide crowded cell-mates' labels so a hover label never collides.
    all.forEach((m) => {
      const c = m.el.classList;
      c.toggle('is-active', m === n);
      c.toggle('is-dim', m.lane !== n.lane);
      c.toggle('is-muted', m !== n && m.cell === n.cell && n.cell.length > 2);
    });
    pop.classList.toggle('is-touch', !!touch);
    pop.hidden = false;
    // Above the node when there is room below the sticky header, else below; clamped horizontally.
    const bw = box.clientWidth, pw = pop.offsetWidth, ph = pop.offsetHeight;
    const y = svg.getBoundingClientRect().top - box.getBoundingClientRect().top + n.y;
    const above = box.getBoundingClientRect().top + y - 72 >= ph + 30;
    const left = Math.max(0, Math.min(n.x - pw / 2, bw - pw));
    pop.classList.toggle('is-below', !above);
    pop.style.setProperty('--x', `${left}px`);
    pop.style.setProperty('--y', `${above ? y - 28 - ph : y + 20}px`);
    pop.style.setProperty('--arrow-x', `${Math.max(16, Math.min(n.x - left, pw - 16))}px`);
  }
  function hide() {
    if (!active) return;
    active.el.removeAttribute('aria-describedby');
    all.forEach((m) => m.el?.classList.remove('is-active', 'is-dim', 'is-muted'));
    active = null;
    pop.hidden = true;
  }
  const rove = (n) => { cur = n; all.forEach((m) => m.el?.setAttribute('tabindex', m === n ? 0 : -1)); };

  box.addEventListener('pointerdown', (e) => { ptype = e.pointerType; });
  box.addEventListener('pointerover', (e) => { const n = nodeOf(e.target); if (n && e.pointerType !== 'touch') show(n); });
  // Hiding waits a moment so the pointer can cross the gap onto the popover (it is hoverable).
  const hideSoon = () => {
    clearTimeout(hideT);
    hideT = setTimeout(() => { const f = nodeOf(document.activeElement); f?.el.matches(':focus-visible') ? show(f) : hide(); }, 160);
  };
  box.addEventListener('pointerout', (e) => {
    const n = nodeOf(e.target);
    if (!n || e.pointerType === 'touch' || n.el.contains(e.relatedTarget)) return;
    hideSoon();
  });
  pop.addEventListener('pointerenter', () => clearTimeout(hideT));
  pop.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hideSoon(); });
  box.addEventListener('focusin', (e) => { const n = nodeOf(e.target); if (n) { settle?.(); rove(n); if (ptype !== 'touch') show(n); } });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) hide(); });
  box.addEventListener('click', (e) => {
    const n = nodeOf(e.target);
    if (n && ptype === 'touch' && active !== n) { e.preventDefault(); show(n, true); } else if (n || e.target.closest('.tl-pop__cta')) hide();
  });
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) hide(); });
  // Esc dismisses the popover wherever focus is (e.g. a mouse hover with focus elsewhere).
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active) hide(); });
  // Keys: ←/→ chronological, ↑/↓ nearest node in the adjacent lane, Home/End, Esc closes. Enter follows the link natively.
  box.addEventListener('keydown', (e) => {
    ptype = '';
    const n = nodeOf(e.target);
    if (!n) return;
    const i = all.indexOf(n), k = e.key;
    let t;
    if (k === 'Escape') { if (active) { hide(); e.preventDefault(); } return; }
    if (k === 'ArrowRight') t = all[i + 1];
    else if (k === 'ArrowLeft') t = all[i - 1];
    else if (k === 'Home') t = all[0];
    else if (k === 'End') t = all.at(-1);
    else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const dir = k === 'ArrowUp' ? -1 : 1;
      for (let l = LANES.indexOf(n.lane) + dir; !t && l >= 0 && l < LANES.length; l += dir) {
        t = all.filter((m) => m.lane === LANES[l]).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
      }
    } else return;
    e.preventDefault();
    t?.el.focus();
  });

  // ---- Render, and re-render on width or breakpoint change (debounced) ----
  function render(force) {
    const w = box.clientWidth, m = wide.matches;
    if (!force && w === lastW && m === mode) return;
    const had = box.contains(document.activeElement) && nodeOf(document.activeElement);
    lastW = w; mode = m;
    hide();
    io?.disconnect(); io = settle = null;
    box.querySelector('.tl, .tl-rail')?.remove();
    all.forEach((n) => { n.el = null; });
    svg = null;
    if (m) drawSvg(w); else drawRail();
    legend?.toggleAttribute('aria-hidden', !m); // the rail's lane headers already read the legend out
    box.append(pop); // after the figure, so Tab order is node → popover CTA → onwards
    box.dataset.ready = '';
    if (had && had.el) had.el.focus({ preventScroll: true });
  }
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(render, 100); }).observe(box);
  wide.addEventListener('change', () => render(true));
  reduce.addEventListener('change', () => { drawn = true; render(true); });
  render(true);
  document.fonts?.ready.then(() => { // text widths change once web fonts load
    if (!svg?.isConnected) return;
    wrapped.forEach(({ t, s, w }) => wrapText(t, s, w));
    declutter();
  });
}

// Inverse of the draw easing: the time fraction at which the pen has covered fraction f of the thread.
function invEase(f) {
  const bez = (s, p1, p2) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  let lo = 0, hi = 1, s = 0.5;
  for (let k = 0; k < 24; k++) { s = (lo + hi) / 2; if (bez(s, 0, 1) < f) lo = s; else hi = s; }
  return bez(s, 0.65, 0.35);
}

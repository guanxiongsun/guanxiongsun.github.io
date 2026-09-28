/* mamba-memory.js: Fig. 2 "Queue vs. memory bank" (spec §9.1). Toy sizes, the released rules
   (vfe.pytorch vfe/models/memory.py, test_with_adaptive_stride):
   sample(): all while < K stored, else a random K-subset. update(): append while < CAP, else keep
   a random (len-1)-subset of the old and append the new (drawn: the new one takes the lost slot).
   Frame 0: 14 reference frames at round(i*(T-1)/13) seed the memory; it reads them, writes none.
   Later frames read, then write their top feature (1 of 4, as 75 of 300 proposals).
   The stage shows each memory as frame t READS it: frame t-1's write is in, frame t's is not,
   so the rings are exactly the features read. Reads and writes use separate seeded streams,
   so K changes only what is read. */
import { mulberry32, createPlayer, createAnnouncer, syncPlayButton, bindRange, reducedMotion } from '/assets/js/article.js?v=20261005';

const T = 96, CAP = 48, QF = 12, SEED = 20210202, T0 = 40, K0 = 8;
const REFS = Array.from({ length: 14 }, (_, i) => Math.round(i * (T - 1) / 13));
const root = document.getElementById('demo');

/* ---------- simulation ---------- */
const start = (seed, K) => ({ t: -1, K, q: [], m: [], n: 0, keys: new Set(), neu: [], out: -1, quad: 0,
  rw: mulberry32(seed), rr: mulberry32(seed ^ 0x5bd1e995) });
function step(S) {
  const t = ++S.t;
  S.neu = []; S.out = -1;
  if (!t) {
    REFS.forEach((f, i) => { S.m[i] = { f, w: 0, seed: 1 }; S.neu.push(i); });
    S.n = REFS.length; S.keys = new Set(S.neu);
    return;
  }
  // Frame t-1's writes. Queue: all 4 features, evicting the oldest frame whole.
  S.q.push(t - 1);
  if (S.q.length > QF) S.out = S.q.shift();
  // Bank update(): append, or replace one at random (frame 0 wrote nothing).
  if (t > 1) { const at = S.n < CAP ? S.n++ : Math.floor(S.rw() * CAP); S.m[at] = { f: t - 1, w: t - 1 }; S.neu = [at]; }
  // Frame t's read. Bank sample(): all, or a random K-subset.
  const idx = [...Array(S.n).keys()];
  if (S.n > S.K) {
    for (let i = 0; i < S.K; i++) { const j = i + Math.floor(S.rr() * (S.n - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    idx.length = S.K;
  }
  S.keys = new Set(idx);
  S.quad = Math.floor(S.rw() * 4);              // which of frame t's 4 features scores highest
}
const run = (seed, K, upto) => { const S = start(seed, K); while (S.t < upto) step(S); return S; };

/* ---------- geometry: 1 SVG unit = 1 CSS px ---------- */
function geo(W) {
  const two = W >= 860, per = two ? 96 : W >= 560 ? 48 : 32;
  const fp = W / per, fg = Math.min(11, fp - 2.5), fRow = fg + 16;
  const pw = two ? (W - 56) / 2 : W, cp = Math.min(two ? 41 : 44, (pw - 3) / 12), gap = cp > 32 ? 6 : 5;
  const cs = cp - gap, gw = 12 * cp - gap, gh = 4 * cp - gap;
  const px = two ? [(pw - gw) / 2, W - pw + (pw - gw) / 2] : [(W - gw) / 2, (W - gw) / 2];
  const y0 = 30 + (T / per) * fRow + 12, gy = y0 + 42, ry = gy + gh + 40, cy = ry + 52;
  return { W, two, per, fp, fg, fRow, fx: (W - per * fp + fp - fg) / 2, cp, cs, gw, gh, px, ty: y0 + 12, gy, ry,
    cy: two ? [cy, cy] : [cy, cy + 58], H: cy + (two ? 62 : 120), tp: gw / T };
}
const r = (v) => Math.round(v * 10) / 10;
const cls = (el, c) => el.setAttribute('class', c);

function init() {
  const $ = (s, el = root) => el.querySelector(s), $$ = (s, el) => [...el.querySelectorAll(s)];
  const svg = $('[data-stage]'), kIn = $('#mm-k'), tIn = $('#mm-t'), playBtn = $('[data-action="play"]');
  const view = $('.mm-view'), descEl = $('.explorable__desc'), desc = createAnnouncer(descEl);
  let seedN = 0, S, G, E, shown = 1;
  // Visibility is judged on the stage, not the whole (tall) card.
  const player = createPlayer($('.explorable__stage'), {
    interval: 500,
    tick: () => { step(S); render(true); return S.t < T - 1; },
    onChange: (p) => { syncPlayButton(playBtn, p); if (!p) say(true); },
  });
  // A Play click marks the stage visible even below 50%; pause once the card is fully off screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { if (!en.isIntersecting && player.playing) player.pause(false); }).observe(root);
  }

  /* Static scene for the current width; render() only sets classes and text. */
  function build() {
    const st = getComputedStyle(root);
    const W = Math.max(280, Math.round(root.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)));
    if (G && G.W === W) return false;
    G = geo(W);
    const { fp, fg, fRow, fx, cp, gw } = G, c = r(G.cs), si = c < 30 ? 2.5 : 4, g = r(fg), h = r(fg / 2);
    const fpos = (f) => [r(fx + (f % G.per) * fp), r(30 + Math.floor(f / G.per) * fRow)];
    const slot = (x, y) => `<g class="mm-s" transform="translate(${r(x)} ${r(y)})"><rect class="mm-s__bg" width="${c}" height="${c}" rx="3"/><rect class="mm-s__fill" width="${c}" height="${c}" rx="3"/><rect class="mm-s__seed" x="${si}" y="${si}" width="${c - 2 * si}" height="${c - 2 * si}" rx="2"/><text class="mm-s__lab" x="${c / 2}" y="${r(c / 2 + 3.5)}" text-anchor="middle"></text><rect class="mm-s__ring" x="-2" y="-2" width="${c + 4}" height="${c + 4}" rx="4"/></g>`;
    let s = `<defs><clipPath id="mm-clip"><rect x="-4" y="-4" width="${r(gw + 8)}" height="${r(G.gh + 8)}"/></clipPath></defs>`
      + `<text class="ex-text ex-text--muted" x="${r(fx)}" y="12">Video: ${T} frames (0–${T - 1}), 4 features each</text><text class="ex-text ex-text--acc mm-now" x="${r(W - fx)}" y="12" text-anchor="end"></text>`;
    for (let f = 0; f < T; f++) { const [x, y] = fpos(f); s += `<g class="mm-f" transform="translate(${x} ${y})"><rect width="${g}" height="${g}" rx="1.5"/><path d="M${h} 0V${g}M0 ${h}H${g}"/></g>`; }
    REFS.forEach((f) => { const [x, y] = fpos(f); s += `<circle class="mm-ref" cx="${r(x + fg / 2)}" cy="${r(y - 5)}" r="2"/>`; });
    s += '<path class="ex-focus mm-head mm-move" d="M0 0l4 6h-8z"/>';
    ['Frame-wise queue<tspan class="ex-text ex-text--muted"> (prior designs)</tspan>', 'MAMBA memory bank'].forEach((title, p) => {
      const x = r(G.px[p]), gy = r(G.gy);
      s += `<g class="mm-panel"><text class="ex-text--title" x="${x}" y="${r(G.ty)}">${title}</text><text class="ex-text ex-text--muted mm-sub" x="${x}" y="${r(G.ty + 17)}"></text>`
        + `<g class="mm-links" transform="translate(${x} ${gy})"></g><g transform="translate(${x} ${gy})"><g clip-path="url(#mm-clip)"><g class="mm-slide">`;
      if (p) for (let i = 0; i < CAP; i++) s += slot((i % 12) * cp, Math.floor(i / 12) * cp);
      else for (let col = -1; col < 12; col++) for (let k = 0; k < 4; k++) s += slot(col * cp, k * cp);
      s += `</g></g></g><g transform="translate(${r(G.px[p] + gw / 2 - 11)} ${r(G.ry)})">`;
      for (let k = 0; k < 4; k++) s += `<rect class="mm-q" x="${(k % 2) * 12}" y="${(k >> 1) * 12}" width="10" height="10" rx="1.5"/>`;
      // Coverage strip (the key visual): which frames of the video this memory holds.
      s += `<text class="ex-text mm-rl" x="32" y="15"></text></g></g><g class="mm-cov" transform="translate(${x} ${r(G.cy[p])})">`
        + `<text class="ex-text ex-text--strong">${G.two ? 'Frames held' : p ? 'MAMBA: frames held' : 'Queue: frames held'}</text><text class="ex-text ex-text--acc mm-cnt" x="${r(gw)}" text-anchor="end"></text>`;
      for (let f = 0; f < T; f++) s += `<rect class="mm-tick" x="${r((f + 0.16) * G.tp)}" y="10" width="${r(Math.max(1.4, G.tp * 0.68))}" height="24" rx=".75"/>`;
      s += `<line class="ex-line mm-seen" y1="38.5" y2="38.5"/><line class="ex-line ex-line--rule ex-line--dashed mm-unseen" y1="38.5" y2="38.5" x2="${r(gw)}"/><path class="ex-focus mm-head mm-move" d="M0 40l4 6h-8z"/>`;
      if (G.two || p) s += `<text class="ex-text--mono" y="58">f0</text><text class="ex-text--mono" x="${r(gw)}" y="58" text-anchor="end">f${T - 1}</text>`;
      s += '</g>';
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${Math.ceil(G.H)}`);
    svg.classList.toggle('mm-sm', c < 30);
    svg.innerHTML = s;
    const covs = $$('.mm-cov', svg);
    E = {
      film: $$('.mm-f', svg), now: $('.mm-now', svg), head: $('.mm-head', svg),
      P: $$('.mm-panel', svg).map((el, p) => ({
        el, sub: $('.mm-sub', el), links: $('.mm-links', el), slide: $('.mm-slide', el), quads: $$('.mm-q', el), rl: $('.mm-rl', el),
        slots: $$('.mm-s', el).map((s) => ({ s, lab: $('text', s) })),
        ticks: $$('.mm-tick', covs[p]), cnt: $('.mm-cnt', covs[p]), seen: $('.mm-seen', covs[p]), unseen: $('.mm-unseen', covs[p]), head: $('.mm-head', covs[p]),
      })),
    };
    E.P[0].sub.textContent = 'Reads everything · evicts whole frames';
    if (view) view.hidden = G.two;
    return true;
  }

  const setSlot = (o, d, lvl, key) => {
    cls(o.s, `mm-s${d ? ' is-full' : ''}${d && d.seed ? ' is-seed' : ''}${key ? ' is-key' : ''}`);
    o.s.dataset.l = lvl;
    o.lab.textContent = d ? `f${d.f}` : '';
  };
  const heldOf = () => [new Set(S.q), new Set(S.m.slice(0, S.n).map((d) => d.f))];
  const span = (set) => (set.size ? `f${Math.min(...set)}–f${Math.max(...set)}` : '–');

  function render(anim) {
    anim = anim && !reducedMotion();
    const { t, q, m, n } = S, [Q, M] = E.P, fresh = [], k = S.keys.size, qn = q.length;
    E.film.forEach((el, f) => cls(el, `mm-f mm-f--${f < t ? 'past' : f === t ? 'now' : 'next'}`));
    E.head.style.transform = `translate(${r(G.fx + (t % G.per) * G.fp + G.fg / 2)}px,${r(30 + Math.floor(t / G.per) * G.fRow + G.fg + 3)}px)`;
    E.now.textContent = `frame ${t}`;

    // Queue: column c holds frame q[c], all of it read; column -1 is the frame just evicted (it slides out).
    Q.slots.forEach((o, i) => {
      const col = Math.floor(i / 4) - 1, f = col < 0 ? (anim ? S.out : -1) : col < qn ? q[col] : -1, has = f >= 0;
      setSlot(o, has && { f }, col < 0 ? 3 : Math.floor((qn - 1 - col) * 4 / qn), has && col >= 0);
      if (anim && has && f === t - 1) fresh.push(o.s);
    });
    // Bank: 4 recency levels from the share of features written strictly later (ties share one).
    const ws = m.slice(0, n).map((d) => d.w), lvl = ws.map((w) => Math.floor(ws.filter((v) => v > w).length * 4 / n));
    M.slots.forEach((o, i) => {
      setSlot(o, m[i], lvl[i] ?? 0, S.keys.has(i));
      if (anim && S.neu.includes(i)) fresh.push(o.s);
    });
    M.sub.textContent = `Reads ${k === n ? 'all' : `${k} sampled`} · replaces single features`;

    // Connectors: one line per grid column holding a key, from the grid's bottom edge to the
    // current frame (the rings mark the exact slots).
    const tx = r(G.gw / 2), ty = r(G.ry - G.gy), y1 = r(G.gh + 3);
    const link = (P, qu) => [...new Set(P.slots.flatMap((o, i) => (o.s.classList.contains('is-key') ? [qu ? Math.floor(i / 4) - 1 : i % 12] : [])))]
      .map((col) => `<line x1="${r(col * G.cp + G.cs / 2)}" y1="${y1}" x2="${tx}" y2="${ty}"/>`).join('');
    Q.links.innerHTML = link(Q, 1); M.links.innerHTML = link(M, 0);
    Q.quads.forEach((el) => cls(el, 'mm-q is-on'));
    M.quads.forEach((el, j) => cls(el, `mm-q${t && j === S.quad ? ' is-on' : ''}`));
    Q.rl.textContent = t ? `f${t} reads ${qn * 4} · writes 4` : 'f0 reads 0 · writes 4';
    M.rl.textContent = t ? `f${t} reads ${k} · writes 1` : `f0 reads ${n} seeds · writes 0`;

    // Coverage: held = tall filled; held only as a seed ahead of t = tall hollow; else short.
    const held = heldOf(), xt = r((t + 0.5) * G.tp);
    E.P.forEach((P, p) => {
      P.ticks.forEach((el, f) => cls(el, `mm-tick${held[p].has(f) ? (f > t ? ' is-ahead' : ' is-on') : ''}`));
      P.cnt.textContent = `${held[p].size} of ${T} frames`;
      P.seen.setAttribute('x2', xt); P.unseen.setAttribute('x1', xt);
      P.head.style.transform = `translateX(${xt}px)`;
      P.el.classList.toggle('mm-off', !G.two && p !== shown);
    });

    // Slide the queue one column left on eviction, flash the new writes, fade connectors in.
    const L = [Q.links, M.links];
    if (anim) {
      if (S.out >= 0) { Q.slide.style.transition = 'none'; Q.slide.style.transform = `translateX(${G.cp}px)`; }
      L.forEach((l) => l.classList.remove('is-in'));
      void svg.getBoundingClientRect();
      Q.slide.style.transition = Q.slide.style.transform = '';
      fresh.forEach((el) => el.classList.add('is-new'));
    }
    L.forEach((l) => l.classList.add('is-in'));

    const ro = (a, b) => `<span class="mm-ro"><small>Queue</small>${a}</span><span class="mm-ro"><small>MAMBA</small>${b}</span>`;
    $('[data-out="read"]').innerHTML = ro(qn * 4, k);
    $('[data-out="frames"]').innerHTML = ro(held[0].size, held[1].size);
    $('[data-out="span"]').innerHTML = ro(span(held[0]), span(held[1]));
    tIn.value = t; syncT();
    say(false);
  }

  function say(force, pre = '') {
    const { t, q, n } = S, held = heldOf()[1], k = S.keys.size;
    const [lo, hi] = [Math.min(...held), Math.max(...held)], seeds = S.m.slice(0, n).filter((d) => d.seed).length;
    desc.say(pre + (!t
      ? `Frame 0 of frames 0–${T - 1}. The queue is still empty, so frame 0 has nothing to read. MAMBA’s bank is seeded with one feature from each of 14 reference frames spread over the whole video, and frame 0 reads all 14.`
      : `Frame ${t} of frames 0–${T - 1}. The queue holds ${q.length > 1 ? `frames ${q[0]} to ${q.at(-1)}` : 'frame 0'}${S.out >= 0 ? ` (frame ${S.out} was just evicted whole)` : ''}, and frame ${t} reads all ${q.length * 4} of ${q.length > 1 ? 'their' : 'its'} features. `
        + `MAMBA’s bank holds ${n} features from ${held.size} frames spanning ${lo} to ${hi}, ${seeds} of them seeds, and frame ${t} reads ${k === n ? `all ${n}` : `${k} of the ${n}`}. `
        + `Then the queue stores all 4 features of frame ${t}; MAMBA stores only its top one.`),
    { playing: player.playing, force: force || !!pre });
  }

  const go = (t) => { S = run(SEED + seedN * 7919, +kIn.value, t); render(false); };
  const syncK = bindRange(kIn, $('output[for="mm-k"]')), syncT = bindRange(tIn, $('output[for="mm-t"]'));
  const on = (sel, fn, ev = 'click') => $(sel)?.addEventListener(ev, fn);
  const restart = () => { go(0); say(true, 'Restarted. '); };
  on('#mm-k', () => { player.pause(); go(S.t); }, 'input');
  on('#mm-t', () => { player.pause(); go(+tIn.value); }, 'input');
  on('[data-action="play"]', () => { if (!player.playing && S.t >= T - 1) restart(); player.toggle(); });
  on('[data-action="step"]', () => { player.pause(); if (S.t >= T - 1) restart(); else { step(S); render(true); } });
  on('[data-action="shuffle"]', () => { seedN++; go(S.t); say(true, 'New random draws. '); });
  on('[data-action="reset"]', () => { player.pause(); seedN = 0; kIn.value = K0; syncK(); go(T0); });
  on('.mm-view', (e) => { shown = +e.target.value; render(false); }, 'change');
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (S && build()) render(false); }).observe(root);

  build();
  go(T0);
  syncPlayButton(playBtn, false);
  root.classList.add('is-ready');
}

// Start at once (build() is cheap): the controls must exist for keyboard users before they scroll.
if (root) init();

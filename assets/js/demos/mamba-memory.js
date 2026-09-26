/* mamba-memory.js: Fig. 2 "Queue vs. memory bank" on /projects/mamba/ (spec §9.1).
   A toy of vfe.pytorch's MemoryBank (vfe/models/memory.py) and its test protocol, beside a
   frame-wise queue. Sizes are toy; the rules are the released code's:
   - sample(): the whole memory while it holds fewer than K features, else a random K-subset.
   - update(): append while under CAP; after that keep a random (len - 1)-subset of the old
     features and append the new one, so single features are replaced, never whole frames.
   - frame 0 (test_with_adaptive_stride): 14 reference frames at round(i * (T - 1) / 13) seed the
     memory; frame 0 attends to all of them and writes nothing back.
   - every later frame reads, then writes its top-scoring feature: 1 of its 4, the same ratio as
     the released top-75 of 300 proposals.
   Display choice: a new feature takes the removed one's slot (the same set as the code).
   Reads and writes draw from separate seeded streams, so K changes only what is read. */
import { mulberry32, onNear, createPlayer, createAnnouncer, syncPlayButton, bindRange, reducedMotion } from '/assets/js/article.js?v=20260926';

const T = 96, CAP = 48, QF = CAP / 4, SEED = 20210202, T0 = 40, K0 = 8;
const REFS = Array.from({ length: 14 }, (_, i) => Math.round(i * (T - 1) / 13));
const root = document.getElementById('demo');
if (root) onNear(root, init);

/* ---------- simulation ---------- */
function start(seed, K) {
  return { t: -1, K, q: [], m: [], n: 0, keys: new Set(), neu: [], out: -1, quad: 0, qRead: 0,
    rw: mulberry32(seed), rr: mulberry32(seed ^ 0x5bd1e995) };
}
function step(S) {
  const t = ++S.t;
  S.neu = []; S.out = -1;
  if (!t) {
    S.q.push(0);
    REFS.forEach((f, i) => { S.m[i] = { f, w: 0, seed: 1 }; S.neu.push(i); });
    S.n = REFS.length;
    S.keys = new Set(S.neu);
    return;
  }
  S.qRead = S.q.length * 4;                     // queue: read everything …
  S.q.push(t);                                  // … write all 4 features of frame t …
  if (S.q.length > QF) S.out = S.q.shift();     // … and evict the oldest frame whole
  const idx = [...Array(S.n).keys()];           // MAMBA sample(): all, or a random K-subset
  if (S.n >= S.K) {
    for (let i = 0; i < S.K; i++) { const j = i + Math.floor(S.rr() * (S.n - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    idx.length = S.K;
  }
  S.keys = new Set(idx);
  S.quad = Math.floor(S.rw() * 4);              // which of the frame's 4 features scores highest
  const at = S.n < CAP ? S.n++ : Math.floor(S.rw() * CAP); // update(): append, or replace one at random
  S.m[at] = { f: t, w: t };
  S.neu = [at];
}
function run(seed, K, upto) { const S = start(seed, K); while (S.t < upto) step(S); return S; }

/* ---------- geometry: 1 SVG unit = 1 CSS px, so text stays true to size ---------- */
function geo(W) {
  const two = W >= 860, per = two ? 96 : W >= 560 ? 48 : 32;
  const fp = W / per, fg = Math.min(11, fp - 2.5), fRow = fg + 16;
  const pw = two ? (W - 56) / 2 : W, cp = Math.min(two ? 41 : 44, (pw + 5) / 12), gap = cp > 32 ? 6 : 5;
  const cs = cp - gap, gw = 12 * cp - gap, gh = 4 * cp - gap;
  const px = two ? [(pw - gw) / 2, W - pw + (pw - gw) / 2] : [(W - gw) / 2, (W - gw) / 2];
  const y0 = 30 + (T / per) * fRow + 12, gy = y0 + 42, ry = gy + gh + 26, cy = ry + 58;
  return { W, two, per, fp, fg, fRow, fx: (W - per * fp + fp - fg) / 2, pw, cp, cs, gw, gh, px, ty: y0 + 12, gy, ry,
    cy: two ? [cy, cy] : [cy, cy + 56], H: cy + (two ? 50 : 106), tp: gw / T };
}

function init() {
  const $ = (s) => root.querySelector(s);
  const svg = $('[data-stage]'), kIn = $('#mm-k'), tIn = $('#mm-t'), playBtn = $('[data-action="play"]');
  const view = $('.mm-view'), desc = createAnnouncer($('.explorable__desc'));
  const out = (n) => root.querySelector(`[data-out="${n}"]`);
  let seedN = 0, S, G, E, shown = 1;
  const seed = () => SEED + seedN * 7919;
  const player = createPlayer(root, {
    interval: 500,
    tick: () => { step(S); render(true); return S.t < T - 1; },
    onChange: (p) => { syncPlayButton(playBtn, p); if (!p) say(true); },
  });

  /* Build the static scene for a width; keep references to everything render() touches. */
  function build() {
    const cs = getComputedStyle(root);
    const W = Math.max(280, Math.round(root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    if (G && G.W === W) return false;
    G = geo(W);
    const { fp, fg, fRow, fx, cp, gw, gh } = G, r1 = (v) => Math.round(v * 10) / 10;
    const fpos = (f) => [r1(fx + (f % G.per) * fp), r1(30 + Math.floor(f / G.per) * fRow)];
    const slot = (x, y) => `<g class="mm-s" transform="translate(${r1(x)} ${r1(y)})"><rect class="mm-s__bg" width="${r1(G.cs)}" height="${r1(G.cs)}" rx="3"/><rect class="mm-s__fill" width="${r1(G.cs)}" height="${r1(G.cs)}" rx="3"/><rect class="mm-s__seed" x="4" y="4" width="${r1(G.cs - 8)}" height="${r1(G.cs - 8)}" rx="2"/><text class="mm-s__lab" x="${r1(G.cs / 2)}" y="${r1(G.cs / 2 + 3.5)}" text-anchor="middle"></text><rect class="mm-s__ring" x="-3" y="-3" width="${r1(G.cs + 6)}" height="${r1(G.cs + 6)}" rx="5"/></g>`;
    let s = `<text class="ex-text ex-text--muted" x="${r1(fx)}" y="12">Video: ${T} frames, 4 features each</text><text class="ex-text ex-text--acc mm-now" x="${r1(W - fx)}" y="12" text-anchor="end"></text>`;
    for (let f = 0; f < T; f++) { const [x, y] = fpos(f); s += `<g class="mm-f" transform="translate(${x} ${y})"><rect width="${r1(fg)}" height="${r1(fg)}" rx="1.5"/><path d="M${r1(fg / 2)} 0V${r1(fg)}M0 ${r1(fg / 2)}H${r1(fg)}"/></g>`; }
    REFS.forEach((f) => { const [x, y] = fpos(f); s += `<circle class="mm-ref" cx="${r1(x + fg / 2)}" cy="${r1(y - 5)}" r="2"/>`; });
    s += `<path class="ex-focus mm-head mm-move" d="M0 0l4 6h-8z"/>`;
    [['Frame-wise queue', ' (prior designs)'], ['MAMBA memory bank', '']].forEach(([a, b], p) => {
      const x = G.px[p], cx = r1(x + gw / 2);
      s += `<g class="mm-panel"><text class="ex-text--title" x="${r1(x)}" y="${r1(G.ty)}">${a}<tspan class="ex-text ex-text--muted">${b}</tspan></text><text class="ex-text ex-text--muted mm-sub" x="${r1(x)}" y="${r1(G.ty + 17)}"></text>`
        + `<g class="mm-links" transform="translate(${r1(x)} ${r1(G.gy)})"></g><g transform="translate(${r1(x)} ${r1(G.gy)})"><g clip-path="url(#mm-clip)"><g class="mm-slide">`;
      if (p) for (let i = 0; i < CAP; i++) s += slot((i % 12) * cp, Math.floor(i / 12) * cp);
      else for (let c = -1; c < 12; c++) for (let r = 0; r < 4; r++) s += slot(c * cp, r * cp);
      s += `</g></g></g><g class="mm-reader" transform="translate(${r1(cx - 11)} ${r1(G.ry)})">`;
      for (let k = 0; k < 4; k++) s += `<rect class="mm-q" x="${(k % 2) * 12}" y="${(k >> 1) * 12}" width="10" height="10" rx="1.5"/>`;
      s += `<text class="ex-text mm-rl" x="32" y="15"></text></g></g>`;
    });
    [0, 1].forEach((p) => {
      const x = G.px[p], y = G.cy[p], lab = G.two ? 'Frames held in memory' : p ? 'MAMBA bank: frames held' : 'Queue: frames held';
      s += `<g class="mm-cov" transform="translate(${r1(x)} ${r1(y)})"><text class="ex-text" y="0">${lab}</text><g class="mm-dots"></g>`;
      for (let f = 0; f < T; f++) s += `<rect class="mm-tick" x="${r1(f * G.tp + G.tp * 0.18)}" y="12" width="${r1(Math.max(1.4, G.tp * 0.64))}" height="18" rx="0.75"/>`;
      s += `<line class="ex-line mm-seen" y1="35" y2="35" x1="0"/><line class="ex-line ex-line--rule ex-line--dashed mm-unseen" y1="35" y2="35" x2="${r1(gw)}"/><path class="ex-focus mm-head2 mm-move" d="M0 37l4 6h-8z"/>`;
      if (G.two || p) s += `<text class="ex-text--mono" x="0" y="${55}">f0</text><text class="ex-text--mono" x="${r1(gw)}" y="55" text-anchor="end">f${T - 1}</text>`;
      s += '</g>';
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${Math.ceil(G.H)}`);
    svg.innerHTML = `<defs><clipPath id="mm-clip"><rect x="-5" y="-5" width="${r1(gw + 10)}" height="${r1(gh + 10)}"/></clipPath></defs>${s}`;
    const all = (sel, el = svg) => [...el.querySelectorAll(sel)];
    const panels = all('.mm-panel'), covs = all('.mm-cov');
    E = {
      film: all('.mm-f'), now: svg.querySelector('.mm-now'), head: svg.querySelector('.mm-head'),
      P: panels.map((g, p) => ({
        g, sub: g.querySelector('.mm-sub'), links: g.querySelector('.mm-links'), slide: g.querySelector('.mm-slide'),
        slots: all('.mm-s', g).map((el) => ({ el, lab: el.querySelector('text') })),
        quads: all('.mm-q', g), rl: g.querySelector('.mm-rl'),
        ticks: all('.mm-tick', covs[p]), dots: covs[p].querySelector('.mm-dots'),
        seen: covs[p].querySelector('.mm-seen'), unseen: covs[p].querySelector('.mm-unseen'), head: covs[p].querySelector('.mm-head2'),
      })),
    };
    if (view) view.hidden = G.two;
    return true;
  }

  const setSlot = (o, d, lvl, key) => {
    o.el.setAttribute('class', `mm-s${d ? ' is-full' : ''}${d && d.seed ? ' is-seed' : ''}${key ? ' is-key' : ''}`);
    o.el.dataset.l = lvl;
    o.lab.textContent = d ? `f${d.f}` : '';
  };
  const coords = (i, q) => { const c = q ? Math.floor(i / 4) - 1 : i % 12, r = q ? i % 4 : Math.floor(i / 12); return [c * G.cp + G.cs / 2, r * G.cp + G.cs]; };

  function render(anim) {
    anim = anim && !reducedMotion();
    const { t, q, m, n } = S, [Q, M] = E.P, cp = G.cp, fresh = [];
    E.film.forEach((g, f) => g.setAttribute('class', `mm-f mm-f--${f < t ? 'past' : f === t ? 'now' : 'next'}`));
    const [hx, hy] = [G.fx + (t % G.per) * G.fp + G.fg / 2, 30 + Math.floor(t / G.per) * G.fRow + G.fg + 3];
    E.head.style.transform = `translate(${hx}px,${hy}px)`;
    E.now.textContent = `frame ${t} / ${T - 1}`;

    // Queue: column c holds frame q[c]; column -1 is the frame just evicted (it slides out).
    Q.slots.forEach((o, i) => {
      const c = Math.floor(i / 4) - 1, f = c < 0 ? (anim ? S.out : -1) : q[c];
      const has = f !== undefined && f >= 0, age = q.length - 1 - c;
      setSlot(o, has && { f }, c < 0 ? 3 : Math.floor(age * 4 / q.length), has && f !== t && t > 0);
      if (anim && has && f === t) fresh.push(o.el);
    });
    Q.sub.textContent = 'Reads everything · evicts whole frames';
    // MAMBA: recency level by rank of write time (4 steps, newest darkest).
    const rank = [...Array(n).keys()].sort((a, b) => m[b].w - m[a].w || b - a), lvl = [];
    rank.forEach((i, r) => { lvl[i] = Math.floor(r * 4 / n); });
    M.slots.forEach((o, i) => {
      setSlot(o, m[i], lvl[i] ?? 0, S.keys.has(i) && (!t || !S.neu.includes(i)));
      if (anim && S.neu.includes(i)) fresh.push(o.el);
    });
    M.sub.textContent = `Reads ${S.K} sampled · replaces single features`;

    // Key-set connectors to the current frame, under each panel.
    const tx = G.gw / 2, ty = G.ry - G.gy;
    const line = ([x, y]) => `<line x1="${x.toFixed(1)}" y1="${(y + 3).toFixed(1)}" x2="${tx}" y2="${ty}"/>`;
    Q.links.innerHTML = Q.slots.map((o, i) => (o.el.classList.contains('is-key') && i >= 4 ? line(coords(i, 1)) : '')).join('');
    M.links.innerHTML = M.slots.map((o, i) => (o.el.classList.contains('is-key') ? line(coords(i, 0)) : '')).join('');
    Q.quads.forEach((r) => r.setAttribute('class', 'mm-q is-on'));
    M.quads.forEach((r, k) => r.setAttribute('class', `mm-q${t && k === S.quad ? ' is-on' : ''}`));
    Q.rl.textContent = `f${t} reads ${S.qRead} · writes 4`;
    M.rl.textContent = t ? `f${t} reads ${S.keys.size} · writes 1` : `f0 reads ${n} seeds · writes 0`;

    // Coverage strips: which frames of the video each memory still holds.
    const held = [new Set(q), new Set(m.slice(0, n).map((d) => d.f))];
    E.P.forEach((P, p) => {
      let dots = '';
      P.ticks.forEach((r, f) => {
        const on = held[p].has(f), ahead = on && f > t;
        r.setAttribute('class', `mm-tick${on ? (ahead ? ' is-ahead' : ' is-on') : ''}`);
        if (ahead) dots += `<circle class="mm-ref" cx="${((f + 0.5) * G.tp).toFixed(1)}" cy="5" r="2"/>`;
      });
      P.dots.innerHTML = dots;
      const xt = ((t + 0.5) * G.tp).toFixed(1);
      P.seen.setAttribute('x2', xt); P.unseen.setAttribute('x1', xt);
      P.head.style.transform = `translateX(${xt}px)`;
      P.g.classList.toggle('mm-off', !G.two && p !== shown);
    });

    if (anim) {
      // Slide the queue one column left when a frame was evicted; flash the new writes;
      // fade the connectors in once the step has settled.
      if (S.out >= 0) { Q.slide.style.transition = 'none'; Q.slide.style.transform = `translateX(${cp}px)`; }
      [Q.links, M.links].forEach((l) => l.classList.remove('is-in'));
      void svg.getBoundingClientRect();
      Q.slide.style.transition = ''; Q.slide.style.transform = '';
      fresh.forEach((el) => el.classList.add('is-new'));
    }
    [Q.links, M.links].forEach((l) => l.classList.add('is-in'));

    const hf = [...held[1]], lo = Math.min(...hf), hi = Math.max(...hf);
    const qs = `${q[0]}${q.length > 1 ? `–${q.at(-1)}` : ''}`;
    out('read').innerHTML = ro(S.qRead, t ? S.keys.size : n);
    out('frames').innerHTML = ro(q.length, hf.length);
    out('span').innerHTML = ro(`f${qs.replace('–', '–f')}`, `f${lo}–f${hi}`);
    tIn.value = t; syncT();
    say(false);
  }
  const ro = (a, b) => `<span class="mm-ro"><small>Queue</small>${a}</span><span class="mm-ro"><small>MAMBA</small>${b}</span>`;

  function say(force) {
    const { t, q, n } = S, hf = [...new Set(S.m.slice(0, n).map((d) => d.f))];
    const seeds = S.m.slice(0, n).filter((d) => d.seed).length, k = S.keys.size;
    const text = !t
      ? `Frame 0. The queue stores frame 0 and has nothing to read yet. MAMBA's bank is seeded with one feature from each of 14 reference frames spread over the whole video, 0 to ${T - 1}, and frame 0 reads all 14.`
      : `Frame ${t}. The queue holds frames ${q[0]} to ${q.at(-1)}${S.out >= 0 ? ` (frame ${S.out} was just evicted whole)` : ''} and reads all ${S.qRead} features. `
        + `MAMBA's bank holds features from ${hf.length} frames spanning ${Math.min(...hf)} to ${Math.max(...hf)}, including ${seeds} of its 14 seeds, and reads ${k === n ? `all ${k}` : `${k} of ${n}`}.`;
    desc.say(text, { playing: player.playing, force });
  }

  const go = (t, K = +kIn.value) => { S = run(seed(), K, t); render(false); };
  const syncK = bindRange(kIn, $('output[for="mm-k"]'));
  const syncT = bindRange(tIn, $('output[for="mm-t"]'));
  kIn.addEventListener('input', () => { player.pause(); go(S.t); });
  tIn.addEventListener('input', () => { player.pause(); go(+tIn.value); });
  playBtn.addEventListener('click', () => { if (!player.playing && S.t >= T - 1) go(0); player.toggle(); });
  $('[data-action="step"]').addEventListener('click', () => { player.pause(); if (S.t >= T - 1) go(0); else { step(S); render(true); } });
  $('[data-action="shuffle"]').addEventListener('click', () => { seedN++; go(S.t); desc.say(`New random draws (run ${seedN + 1}). ` + root.querySelector('.explorable__desc').textContent, { force: true }); });
  $('[data-action="reset"]').addEventListener('click', () => { player.pause(); seedN = 0; kIn.value = K0; syncK(); go(T0); });
  view?.addEventListener('change', (e) => { shown = +e.target.value; render(false); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (S && build()) render(false); }).observe(root);

  build();
  go(T0);
  syncPlayButton(playBtn, false);
  root.classList.add('is-ready');
  root.dataset.motion = reducedMotion() ? 'reduced' : 'full';
}

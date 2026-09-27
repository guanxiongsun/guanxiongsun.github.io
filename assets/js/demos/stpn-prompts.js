/* stpn-prompts.js: Fig. 2 "Prompting the backbone" on /projects/stpn/ (spec §9.2). SCHEMATIC.
   Real pixels (crops of the paper's Fig. 1) cut into an 8×5 grid of patch tokens. STPN prepends
   5 prompt tokens predicted from the support frames; the prior pipeline fuses support features
   after the backbone, in a module built for one task. The grid is a radiogroup (the probe):
   pick a patch to draw illustrative attention lines. Layouts: 960×420 when the stage is ≥820px
   wide (text stays ≥9px), else 360×640 (capped in CSS). Built eagerly so its controls are in the
   tab order. Styles: /assets/css/demos/stpn.css (.st-*) plus .ex-* in article.css. */
import { createAnnouncer, reducedMotion } from '/assets/js/article.js?v=20260928';

const IMG = '/assets/img/projects/stpn/stpn-', TASK = ['VOD', 'VIS', 'VOT'], WHAT = ['detection', 'segmentation', 'tracking'];
const DEF = { mode: 'stpn', task: 0, on: true, pin: 21 }; // row 3, column 6: the fox's head
// g: grid x, y, pitch, gap · sup: front tile x, y, w, h, step · box: support-side box x, y, w, h
// st: strip y, prompt x, patch x, pitch, patches shown · bb: backbone x, y, w, h
const L = {
  d: { W: 960, H: 420, g: [250, 28, 34, 2], sup: [24, 50, 110, 68, 9], box: [24, 150, 176, 60], st: [258, 40, 118, 13.5, 40], bb: [24, 304, 632, 88] },
  m: { W: 360, H: 640, g: [18, 134, 41.5, 2], sup: [240, 38, 90, 55, 8], box: [18, 20, 196, 68], st: [364, 18, 108, 16, 8], bb: [18, 404, 330, 62] },
};
const root = document.getElementById('demo');

const T = (x, y, s, c = '', a) => `<text class="ex-text ${c}" x="${x}" y="${y}"${a ? ` text-anchor="${a}"` : ''}>${s}</text>`;
const R = (x, y, w, h, c, r = 3) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const P = (d, c, m) => `<path class="${c}" d="${d}"${m ? ` marker-end="url(#st-${m})"` : ''}/>`;
const V = (k, s, c = '') => `<g class="ex-anim ${c}" data-v="${k}">${s}</g>`; // shown only in state k
const img = (f, x, y, w, h, a = '') => `<image href="${IMG + f}.webp" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${a}/>`;
const mk = (id, c) => `<marker id="st-${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="${c}" d="M0 .5 7.5 4 0 7.5z"/></marker>`;
const name = (i) => `patch ${(i >> 3) + 1}, ${i % 8 + 1}`, cap = (t) => t[0].toUpperCase() + t.slice(1);

function init() {
  const svg = root.querySelector('[data-stage]');
  const say = createAnnouncer(root.querySelector('.explorable__desc')).say;
  const sw = root.querySelector('[data-prepend]');
  const radios = [...root.querySelectorAll('input[type="radio"]')];
  const out = (n, h) => { root.querySelector(`[data-out="${n}"]`).innerHTML = h; };
  const $ = (s) => svg.querySelector(s);
  let S = { ...DEF }, hover = null, k = '', G, tiles = [];

  function build() {
    G = L[k]; const m = k === 'm';
    const [gx, gy, pt, gap] = G.g, tw = pt - gap, [sx, sy, sw_, sh, dd] = G.sup, [vx, vy, vw, vh] = G.box;
    const [ty, p0, x0, st, n] = G.st, [bx, by, bw, bh] = G.bb;
    G.tx = (i) => gx + (i % 8) * pt; G.ty = (i) => gy + (i >> 3) * pt; G.tw = tw;
    let s = `<defs>${mk('a', 'ex-ink3')}${mk('f', 'ex-focus')}${mk('s', 'ex-memory')}<clipPath id="st-zc"><rect x="560" y="28" width="112" height="112" rx="2"/></clipPath>`;
    for (let i = 0; i < n; i++) s += `<clipPath id="st-c${i}"><rect x="${x0 + i * st}" y="${ty}" width="12" height="12" rx="2"/></clipPath>`;
    s += '</defs><g aria-hidden="true">';

    // support frames: three stacked tiles of the real, sharp support frame
    for (let j = 2; j >= 0; j--) s += img('support', sx + j * dd, sy - j * dd, sw_, sh) + R(sx + j * dd, sy - j * dd, sw_, sh, 'st-frame', 1);
    s += m ? T(sx, sy + sh + 16, 'SUPPORT FRAMES', 'ex-text--mono') + P(`M${sx - 6} ${vy + 34}H${vx + vw + 3}`, 'st-sup', 's')
      : T(sx, 18, 'SUPPORT FRAMES', 'ex-text--mono') + V('stpn', T(sx, 134, '14 per video, spread over it', 'ex-text--mono')) + P(`M79 139V${vy - 2}`, 'st-sup', 's');

    // support-side box: DVP predictor (STPN) or a backbone per support frame (prior)
    const cw = (vw - 24) / 5;
    let q = '';
    const qy = m ? vy + 34 : vy + 30;
    for (let j = 0; j < 5; j++) q += R(vx + 12 + j * cw, qy, cw - 6, 22, 'st-q') + T(vx + 12 + j * cw + (cw - 6) / 2, qy + 15, 'q' + (j + 1), 'ex-text--mono', 'middle');
    s += V('stpn', R(vx, vy, vw, vh, 'ex-box ex-box--focus') + T(vx + 12, vy + 20, 'DVP predictor', 'ex-text--title') + T(vx + vw - 10, vy + 20, '5 queries', 'ex-text--mono', 'end') + q, 'st-dvp')
      + V('prior', R(vx, vy, vw, vh, 'ex-box ex-box--memory') + T(vx + 12, vy + 26, 'Backbone', 'ex-text--title') + T(vx + 12, vy + 46, 'run on every support frame', 'ex-text--mono'));

    // prompt path: predictor → the front of the token sequence
    s += V('stpn', P(m ? `M${vx} ${vy + 50}H8V${ty + 6}H${p0 - 3}` : `M73 ${vy + vh}V${ty - 4}`, 'ex-line ex-line--focus', 'f'), 'st-dvp');

    // token strip [p1…p5 | x1…x40]; each patch token shows its own crop of the frame
    let e = '', pp = '', xt = '';
    for (let j = 0; j < 5; j++) { e += R(p0 + j * st, ty, 12, 12, 'ex-empty ex-box--dashed', 2); pp += R(p0 + j * st, ty, 12, 12, 'ex-focus st-p', 2); }
    for (let i = 0; i < n; i++) xt += img('current', x0 + i * st - (i % 8) * 12, ty - (i >> 3) * 12, 96, 60, ` clip-path="url(#st-c${i})"`);
    const fan = m ? '' : `<path class="st-fan" d="M${gx} ${gy + 5 * pt}H${gx + 8 * pt - gap}L${x0 + n * st - 2} ${ty - 6}H${x0}Z"/>`;
    s += fan + V('stpn', e) + `<g class="ex-anim st-pg" data-p>${pp}</g>` + xt
      + (m ? T(x0 + n * st + 2, ty + 10, '+32 more', 'ex-text--mono') : '')
      + V('stpn', T(p0 + 2.5 * st - 1, ty + 28, 'prompts', 'ex-text--mono', 'middle'))
      + T(m ? x0 : x0 + n * st / 2, ty + 28, m ? 'patches, raster order' : 'patch tokens x1 … x40, in raster order', 'ex-text--mono', m ? '' : 'middle');

    // current frame: one image, cut into 8×5 tiles by surface-coloured gaps
    s += T(gx, gy - 10, 'CURRENT FRAME · MOTION-BLURRED', 'ex-text--mono') + img('current', gx, gy, 8 * pt - gap, 5 * pt - gap);
    let cut = '';
    for (let c = 1; c < 8; c++) cut += `M${gx + c * pt - gap / 2} ${gy}v${5 * pt - gap}`;
    for (let r = 1; r < 5; r++) cut += `M${gx} ${gy + r * pt - gap / 2}h${8 * pt - gap}`;
    s += P(cut, 'st-cut');

    // backbone: one standard Swin-T, stage depths 2 / 2 / 6 / 2 (released config)
    const u = (bw - 48) / 12, h2 = m ? 22 : 24;
    s += R(bx, by, bw, bh, 'ex-box st-bb') + T(bx + 12, by + 21, '', 'ex-text--title').replace('<text', '<text data-bb="0"') + T(bx + bw - 12, by + 21, '', 'ex-text--mono', 'end').replace('<text', '<text data-bb="1"');
    let x = bx + 12;
    [2, 2, 6, 2].forEach((d, j) => {
      s += R(x, by + 32, d * u, h2, 'ex-panel', 2) + T(x + d * u / 2, by + 32 + h2 / 2 + 4, '×' + d, 'ex-text--strong', 'middle')
        + (m ? '' : T(x + d * u / 2, by + 32 + h2 + 15, 'stage ' + (j + 1), 'ex-text--mono', 'middle'));
      x += d * u + 8;
    });

    // integration modules (prior) and task heads: task hues on borders only, always labelled
    const box = (c, i, cx, cy, w, a, b) => `<g class="${c}" data-t="${i}">${R(cx - w / 2, cy - 17, w, 34, `ex-box st-h${i}`)}${T(cx, cy - 2, a, 'ex-text--strong', 'middle')}${T(cx, cy + 11, b, 'ex-text--mono', 'middle')}</g>`;
    let hd = '', md = '', ls = '', lp = '', gh = '', sp;
    if (m) {
      const cy = [509, 569];
      sp = P(`M${vx} ${vy + 50}H8V482H300`, 'st-sup');
      [70, 183, 296].forEach((cx, i) => {
        hd += box('st-head', i, cx, cy[1], 100, TASK[i], WHAT[i]);
        md += box('st-mod', i, cx, cy[0], 100, 'Module ' + 'ABC'[i], 'for ' + TASK[i]);
        ls += P(`M${cx} ${by + bh}V${cy[1] - 19}`, 'ex-line', 'a');
        lp += P(`M${cx} ${by + bh}V${cy[0] - 19}`, 'ex-line', 'a') + P(`M${cx} ${cy[0] + 17}V${cy[1] - 19}`, 'ex-line', 'a');
        sp += P(`M${cx + 30} 482V${cy[0] - 19}`, 'st-sup', 's');
      });
      gh = V('stpn', R(18, 492, 330, 34, 'ex-box ex-box--dashed st-ghost') + R(102, 502, 162, 16, 'st-kbg', 0) + T(183, 513, 'no task-specific module', 'ex-text--mono st-knock', 'middle'));
      s += `<text class="ex-text ex-text--strong" x="18" y="614" data-cap="0"></text><text class="ex-text ex-text--muted" x="18" y="632" data-cap="1"></text>`;
    } else {
      const cy = [256, 316, 376];
      s += V('stpn', R(712, 238, 100, 156, 'ex-box ex-box--dashed st-ghost') + T(762, 283, 'no task-specific', 'ex-text--mono st-knock', 'middle') + T(762, 296, 'module', 'ex-text--mono st-knock', 'middle'))
        + V('prior', T(762, 226, 'INTEGRATION MODULE', 'ex-text--mono', 'middle')) + T(894, 226, 'TASK HEAD', 'ex-text--mono', 'middle')
        + P(`M${bx + bw} 348H686M686 256V376`, 'ex-line');
      sp = P(`M${vx} ${vy + 30}H12V400H700V383`, 'st-sup');
      cy.forEach((c, i) => {
        hd += box('st-head', i, 894, c, 92, TASK[i], WHAT[i]);
        md += box('st-mod', i, 762, c, 100, 'Module ' + 'ABC'[i], 'for ' + TASK[i]);
        ls += P(`M686 ${c}H846`, 'ex-line', 'a');
        lp += P(`M686 ${c - 7}H710`, 'ex-line', 'a') + P(`M812 ${c}H846`, 'ex-line', 'a');
        sp += P(`M700 ${c + 7}H710`, 'st-sup', 's');
      });
      s += V('prior', T(940, 414, 'tailored module required', 'ex-text--acc', 'end'))
        + V('on', T(24, 414, 'The prompts pass through all four stages and are dropped before the neck.', 'ex-text--mono'))
        // probe inspector: the chosen patch, enlarged (real pixels)
        + T(560, 18, 'PROBE', 'ex-text--mono') + img('current', 0, 0, 896, 560, ' clip-path="url(#st-zc)" data-zoom') + R(560, 28, 112, 112, 'st-frame', 2)
        + [48, 66, 94, 112, 128].map((y, j) => T(688, y, '', ['ex-text--title', 'ex-text--mono', 'ex-text--strong', 'ex-text--muted', 'ex-text--muted'][j]).replace('<text', `<text data-i="${j}"`)).join('');
    }
    s += V('stpn', ls) + gh + V('prior', lp + sp + md) + hd + '</g>';

    // the probe: a radiogroup of 40 patches (roving tabindex), then its overlay
    s += `<g role="radiogroup" aria-label="Probe: choose a patch of the current frame; arrow keys move" data-grid>`;
    for (let i = 0; i < 40; i++) s += `<g class="st-tile" role="radio" data-i="${i}" aria-label="Row ${(i >> 3) + 1}, column ${i % 8 + 1}">${R(G.tx(i), G.ty(i), tw, tw, 'st-hit', 1)}</g>`;
    s += '</g><g class="st-probe" aria-hidden="true" data-probe></g>';
    svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    svg.classList.toggle('st-m', m);
    svg.innerHTML = s;
    tiles = [...svg.querySelectorAll('.st-tile')];
    tiles.forEach((t, i) => {
      t.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') { hover = i; draw(); } });
      t.addEventListener('click', () => { t.focus(); pick(i); });
      t.addEventListener('focus', () => pick(i));
    });
    const grid = $('[data-grid]');
    grid.addEventListener('pointerleave', () => { if (hover !== null) { hover = null; draw(); } });
    grid.addEventListener('keydown', (ev) => {
      const i = S.pin, r = i >> 3, c = i % 8;
      const j = { ArrowRight: c < 7 ? i + 1 : i, ArrowLeft: c ? i - 1 : i, ArrowDown: r < 4 ? i + 8 : i, ArrowUp: r ? i - 8 : i, Home: r * 8, End: r * 8 + 7 }[ev.key];
      if (j === undefined) { if (ev.key === ' ' || ev.key === 'Enter') ev.preventDefault(); return; }
      ev.preventDefault(); tiles[j].focus();
    });
  }

  function pick(i) { if (S.pin !== i || hover !== null) { S.pin = i; hover = null; update(false, true); } }

  // three in-frame neighbours drawn (the first three that exist: right, below, left, above, diagonals)
  const nb = (i) => [[0, 1], [1, 0], [0, -1], [-1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => [(i >> 3) + a, i % 8 + b])
    .filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 8).slice(0, 3).map(([r, c]) => r * 8 + c);

  function draw() { // the probe overlay and inspector (cheap; runs on hover)
    const i = hover ?? S.pin, pr = S.mode === 'prior', on = !pr && S.on, tw = G.tw, [ty, p0, x0, st, n] = G.st;
    const c = (j) => [G.tx(j) + tw / 2, G.ty(j) + tw / 2], [x, y] = c(i);
    const line = (x2, y2, cl) => `<path class="st-halo" d="M${x} ${y}L${x2} ${y2}"/><path class="${cl}" d="M${x} ${y}L${x2} ${y2}"/>`;
    let s = '';
    nb(i).forEach((q) => { const [a, b] = c(q); s += line(a, b, 'st-nb') + `<circle class="st-nbdot" cx="${a}" cy="${b}" r="3.5"/>`; });
    const ax = x0 + i * st + 6;
    if (i < n) s += `<path class="st-lead" d="M${x} ${G.ty(i) + tw}L${ax} ${ty - 3}"/>`;
    // desktop: attention as arcs over the token sequence; mobile: straight from the patch
    if (on) for (let j = 0; j < 5; j++) {
      const px = p0 + j * st + 6, h = Math.min(92, 20 + (ax - px) * .2);
      s += i < n ? `<path class="st-halo" d="M${ax} ${ty - 2}Q${(ax + px) / 2} ${ty - h} ${px} ${ty - 2}"/><path class="st-att" d="M${ax} ${ty - 2}Q${(ax + px) / 2} ${ty - h} ${px} ${ty - 2}"/>` : line(px, ty - 1, 'st-att');
    }
    s += `<rect class="st-ring" x="${G.tx(i) - 2.5}" y="${G.ty(i) - 2.5}" width="${tw + 5}" height="${tw + 5}" rx="3"/>`;
    const f = (o, c) => `<rect class="${c}" x="${G.tx(S.pin) - o}" y="${G.ty(S.pin) - o}" width="${tw + 2 * o}" height="${tw + 2 * o}" rx="4"/>`;
    s += f(5.5, 'st-fh') + f(5.5, 'st-focus'); // keyboard focus: an ink ring outside the selection
    if (i < n) s += `<rect class="ex-ring" x="${ax - 8}" y="${ty - 2}" width="16" height="16" rx="3"/>`;
    $('[data-probe]').innerHTML = s;
    const N = cap(name(i)), reads = on ? 'reads 5 prompts + its window' : 'reads its window only';
    const note = pr ? ['Temporal information arrives', 'only after the backbone.'] : on ? ['The prompts carry what the', 'sharp support frames saw.'] : ['Without prompts it sees', 'the blurred frame alone.'];
    const txt = [N, `token ${on ? i + 6 : i + 1} of ${on ? 45 : 40}`, reads, ...note];
    svg.querySelectorAll('text[data-i]').forEach((t) => { t.textContent = txt[t.dataset.i]; });
    const z = $('[data-zoom]');
    if (z) { z.setAttribute('x', 560 - (i % 8) * 112); z.setAttribute('y', 28 - (i >> 3) * 112); }
    const cp = svg.querySelectorAll('[data-cap]');
    if (cp.length) { cp[0].textContent = `${N} ${reads}.`; cp[1].textContent = note.join(' '); }
  }

  function update(pulse, probeOnly) {
    const pr = S.mode === 'prior', on = !pr && S.on, v = { stpn: !pr, prior: pr, on }, m = k === 'm';
    svg.querySelectorAll('[data-v]').forEach((g) => g.classList.toggle('ex-hidden', !v[g.dataset.v]));
    svg.querySelectorAll('.st-dvp').forEach((g) => g.classList.toggle('ex-dim', !pr && !S.on));
    const p = $('[data-p]');
    p.classList.toggle('ex-hidden', pr); p.classList.toggle('st-out', !pr && !S.on);
    svg.querySelectorAll('[data-t]').forEach((g) => g.classList.toggle('is-on', +g.dataset.t === S.task));
    tiles.forEach((t, i) => { t.setAttribute('aria-checked', String(i === S.pin)); t.tabIndex = i === S.pin ? 0 : -1; });
    sw.setAttribute('aria-checked', String(on)); sw.setAttribute('aria-disabled', String(pr)); // no prompts in the prior pipeline
    const bb = svg.querySelectorAll('[data-bb]'); // Swin-T is the released VOD detector's backbone
    bb[0].textContent = !pr && !S.task ? 'Backbone · Swin-T' : 'Backbone';
    bb[1].textContent = pr ? 'one per frame' : m ? 'no new layers' : !S.task ? 'released VOD model, no new layers' : 'the task’s own, no new layers';
    radios.forEach((r) => { r.checked = r.name === 'stpn-mode' ? r.value === S.mode : +r.value === S.task; });
    if (pulse && !pr && !reducedMotion()) {
      svg.querySelectorAll('.st-bb, .st-p').forEach((el) => { el.classList.remove('ex-pulse'); void el.getBoundingClientRect(); el.classList.add('ex-pulse'); });
    }
    draw();
    const t = TASK[S.task], w = WHAT[S.task], nm = name(S.pin);
    const probe = `The probe, ${nm}, ${on ? 'reads the 5 prompts and every patch in its window' : 'reads only patches in its window'}.`;
    if (probeOnly) { say(probe); return; }
    out('tokens', on ? '45 <small>5 + 40</small>' : '40');
    out('modules', pr ? '3 <small>A, B, C</small>' : '0');
    out('where', pr ? 'after the backbone' : on ? 'at the input' : 'nowhere <small>one frame</small>');
    say(pr
      ? `Prior pipeline, ${t} (${w}). The support frames go through their own backbone, and integration module ${'ABC'[S.task]}, built for ${w} only, fuses them after the backbone. 40 tokens enter the backbone. ${probe}`
      : on ? `STPN, ${t} (${w}). 45 tokens enter a standard backbone with no new layers: 5 prompts predicted from the support frames, then the 40 patches of the blurred current frame. ${probe} Each task is its own trained model and framework; the prompting design is the same.`
        : `Prompts off: 40 tokens, the blurred current frame alone, as in a single-frame model. ${probe}`);
  }

  const layout = () => {
    const nk = svg.parentElement.clientWidth < 820 ? 'm' : 'd';
    if (nk === k) return;
    const had = svg.contains(document.activeElement); // keep keyboard focus across a rebuild
    k = nk; build(); update();
    if (had) tiles[S.pin].focus({ preventScroll: true });
  };
  radios.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    if (r.name === 'stpn-mode') { S.mode = r.value; update(); } else { S.task = +r.value; update(true); }
  }));
  sw.addEventListener('click', () => { if (S.mode === 'stpn') { S.on = !S.on; update(); } });
  root.querySelector('[data-action="reset"]').addEventListener('click', () => { S = { ...DEF }; hover = null; update(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(layout)).observe(svg.parentElement);
  layout();
  root.classList.add('is-ready');
}

if (root) init(); // after the helpers above are initialised

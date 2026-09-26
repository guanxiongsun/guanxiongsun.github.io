/* stpn-prompts.js: Fig. 2 "Prompting the backbone" on /projects/stpn/ (spec §9.2). SCHEMATIC.
   Real pixels (crops of the paper's Fig. 1) cut into an 8×5 grid of patch tokens. STPN prepends
   5 prompt tokens predicted from the support frames; the prior pipeline fuses support features
   after the backbone in a module built for one task. The grid is a radiogroup ("probe"): pick a
   patch to draw illustrative attention lines. Two layouts: 960×420 and, below 560px, 360×632. */
import { onNear, createAnnouncer, reducedMotion } from '/assets/js/article.js?v=20260926';

const IMG = '/assets/img/projects/stpn/stpn-', TASK = ['VOD', 'VIS', 'VOT'], WHAT = ['detection', 'segmentation', 'tracking'];
const DEF = { mode: 'stpn', task: 0, on: true, pin: 13 }; // patch row 2, column 6: the fox's head
const L = { // g: grid x,y,tile w,gap · sup: front x,y,w,h,dx,dy · dvp: x,y,w,h · st: strip y,p0,x0,step,n · bb: x,y,w,h
  d: { W: 960, H: 420, g: [250, 26, 32, 2], sup: [28, 46, 128, 79, 10, -10], dvp: [24, 164, 172, 68], st: [262, 42, 118, 13.5, 40], bb: [24, 306, 632, 90] },
  m: { W: 360, H: 632, g: [12, 132, 40.25, 2], sup: [244, 34, 88, 54, 8, -8], dvp: [12, 22, 200, 66], st: [362, 12, 100, 16, 8], bb: [12, 402, 336, 66] },
};
const root = document.getElementById('demo');
if (root) onNear(root, init);

const T = (x, y, s, c = '', a = '') => `<text class="ex-text ${c}" x="${x}" y="${y}"${a && ` text-anchor="${a}"`}>${s}</text>`;
const R = (x, y, w, h, c, a = '') => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"${a}/>`;
const P = (d, c, end = '') => `<path class="${c}" d="${d}"${end && ` marker-end="url(#st-${end})"`}/>`;
const pic = (f, x, y, w, h, vb, iw, ih) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="none"><image href="${IMG + f}.webp" width="${iw}" height="${ih}"/></svg>`;
const crop = (i) => `${i % 8 * 40} ${(i >> 3) * 39.6} 40 39.6`;
const V = (k, s) => `<g class="st-mv" data-v="${k}">${s}</g>`; // shown only in state k (stpn | prior | on | off)

function init() {
  const svg = root.querySelector('[data-stage]');
  const desc = createAnnouncer(root.querySelector('.explorable__desc'));
  const sw = root.querySelector('[data-prepend]');
  const radios = [...root.querySelectorAll('input[type="radio"]')];
  const out = (n, h) => { root.querySelector(`[data-out="${n}"]`).innerHTML = h; };
  let S = { ...DEF }, hover = null, k = '', G, tiles = [];

  function build() {
    G = L[k]; const m = k === 'm';
    const [gx, gy, tw, gap] = G.g, th = tw * .99, [sx, sy, sw_, sh, dx, dy] = G.sup, [vx, vy, vw, vh] = G.dvp;
    const [ty, p0, x0, st, n] = G.st, [bx, by, bw, bh] = G.bb;
    const tX = (i) => gx + (i % 8) * (tw + gap), tY = (i) => gy + (i >> 3) * (th + gap);
    G.c = (i) => [tX(i) + tw / 2, tY(i) + th / 2]; G.t = [tX, tY, tw, th];
    let s = `<defs><marker id="st-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="ex-ink3" d="M0 .5 7.5 4 0 7.5z"/></marker>`
      + `<marker id="st-f" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="ex-focus" d="M0 .5 7.5 4 0 7.5z"/></marker>`
      + `<marker id="st-s" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="ex-memory" d="M0 .5 7.5 4 0 7.5z"/></marker></defs><g aria-hidden="true">`;
    // support frames: three stacked tiles of the real (sharp) support frame
    for (let j = 2; j >= 0; j--) s += pic('support', sx + j * dx, sy + j * dy, sw_, sh, '0 0 198 122', 198, 122) + R(sx + j * dx, sy + j * dy, sw_, sh, 'st-frame', ' rx="1"');
    s += m ? T(sx, sy + sh + 16, 'SUPPORT FRAMES', 'ex-text--mono') + P(`M${sx - 6} ${vy + vh / 2}H${vx + vw + 2}`, 'ex-line', 'a')
      : T(24, 18, 'SUPPORT FRAMES', 'ex-text--mono') + T(24, 142, '14 per video, spread out', 'ex-text--mono') + P('M92 146V160', 'ex-line', 'a');
    // DVP predictor (STPN) / a backbone per support frame (prior)
    let q = '';
    for (let j = 0; j < 5; j++) q += R(vx + 10 + j * (vw - 20) / 5, vy + 32, (vw - 20) / 5 - 6, 22, 'st-q') + T(vx + 10 + (j + .5) * (vw - 20) / 5 - 3, vy + 47, 'q' + (j + 1), 'ex-text--mono', 'middle');
    s += V('stpn', R(vx, vy, vw, vh, 'ex-box ex-box--focus') + T(vx + 12, vy + 20, 'DVP predictor', 'ex-text--title') + T(vx + vw - 10, vy + 20, '5 queries', 'ex-text--mono', 'end') + q)
      + V('prior', R(vx, vy, vw, vh, 'ex-box') + T(vx + 12, vy + 26, 'Backbone', 'ex-text--title') + T(vx + 12, vy + 46, 'run on every support frame', 'ex-text--mono'));
    // prompt path: DVP → front of the sequence
    s += `<g class="st-mv" data-v="stpn" data-dim>${P(m ? `M${vx} ${vy + 44}H5V${ty + 6}H${p0 - 2}` : `M75 ${vy + vh}V${ty - 6}`, 'ex-line ex-line--focus', 'f')}</g>`;
    // token strip [p1…p5 | x1…x40]
    let e = '', pt = '', xt = '';
    for (let j = 0; j < 5; j++) { e += R(p0 + j * st, ty, 12, 12, 'ex-empty ex-box--dashed', ' rx="2"'); pt += R(p0 + j * st, ty, 12, 12, 'ex-focus st-p', ' rx="2"'); }
    for (let i = 0; i < n; i++) xt += pic('current', x0 + i * st, ty, 12, 12, crop(i), 320, 198) + R(x0 + i * st, ty, 12, 12, 'st-tk', ' rx="1"');
    const pc = p0 + 2.5 * st - 1;
    s += V('off', e) + `<g class="st-mv" data-p>${pt}</g>` + xt
      + (m ? T(x0 + n * st + 2, ty + 10, '+32 more', 'ex-text--mono') : `<polygon class="st-fan" points="${gx},${tY(39) + th + 5} ${tX(7) + tw},${tY(39) + th + 5} ${x0 + n * st},${ty - 8} ${x0},${ty - 8}"/>`)
      + V('stpn', T(pc, ty + 28, 'prompts', 'ex-text--mono', 'middle'))
      + T(m ? x0 : x0 + n * st / 2, ty + 28, m ? 'patches (8 of 40 shown)' : 'patch tokens x1 … x40, in raster order', 'ex-text--mono', m ? '' : 'middle')
      + T(gx, gy - 8, 'CURRENT FRAME · MOTION-BLURRED', 'ex-text--mono');
    // backbone: one standard Swin-T; stage depths 2 / 2 / 6 / 2 (released config)
    const u = (bw - 48) / 12, bh2 = m ? 20 : 24;
    s += `<g data-bb>${R(bx, by, bw, bh, 'ex-box st-bb')}</g>` + T(bx + 12, by + 20, 'Backbone · Swin-T', 'ex-text--title') + T(bx + bw - 12, by + 20, m ? 'unmodified' : 'standard, unmodified', 'ex-text--mono', 'end');
    let x = bx + 12;
    [2, 2, 6, 2].forEach((d, j) => {
      s += R(x, by + 32, d * u, bh2, 'ex-panel', ' rx="2"') + T(x + d * u / 2, by + 32 + bh2 / 2 + 4, '×' + d, 'ex-text--strong', 'middle')
        + (m ? '' : T(x + d * u / 2, by + 32 + bh2 + 15, 'stage ' + (j + 1), 'ex-text--mono', 'middle'));
      x += d * u + 8;
    });
    // modules (prior) and heads; task hues on the borders only, always with a text label
    const box = (cls, i, cx, cy, w, a, b) => `<g class="${cls}" data-t="${i}">${R(cx - w / 2, cy - 17, w, 34, `ex-box st-h${i}`)}${T(cx, cy - 2, a, 'ex-text--strong', 'middle')}${T(cx, cy + 11, b, 'ex-text--mono', 'middle')}</g>`;
    let hd = '', md = '', ls = '', lp = '', sp = '';
    if (m) {
      const cy = [509, 569];
      s += V('stpn', R(12, 492, 336, 34, 'ex-box ex-box--dashed st-ghost') + T(180, 513, 'no task-specific module', 'ex-text--mono st-ht', 'middle'));
      sp = P(`M${vx} ${vy + 44}H5V482H330`, 'st-sup');
      [64, 180, 296].forEach((cx, i) => {
        hd += box('st-head', i, cx, cy[1], 104, TASK[i], WHAT[i]);
        md += box('st-mod', i, cx, cy[0], 104, 'Module ' + 'ABC'[i], 'for ' + TASK[i]);
        ls += P(`M${cx} ${by + bh}V${cy[1] - 19}`, 'ex-line', 'a');
        lp += P(`M${cx} ${by + bh}V${cy[0] - 19}`, 'ex-line', 'a') + P(`M${cx} ${cy[0] + 17}V${cy[1] - 19}`, 'ex-line', 'a');
        sp += P(`M${cx + 24} 482V${cy[0] - 19}`, 'st-sup', 's');
      });
      s += `<text class="ex-text st-cap" x="12" y="612" data-cap="0"></text><text class="ex-text ex-text--muted" x="12" y="628" data-cap="1"></text>`;
    } else {
      const cy = [256, 316, 376];
      s += V('stpn', R(712, 238, 100, 156, 'ex-box ex-box--dashed st-ghost') + T(762, 282, 'no task-specific', 'ex-text--mono st-ht', 'middle') + T(762, 294, 'module', 'ex-text--mono st-ht', 'middle'))
        + V('prior', T(762, 226, 'INTEGRATION MODULE', 'ex-text--mono', 'middle')) + T(894, 226, 'TASK HEAD', 'ex-text--mono', 'middle')
        + P(`M${bx + bw} 351H686M686 256V376`, 'ex-line');
      sp = P('M24 198H12V404H700V383', 'st-sup');
      cy.forEach((c, i) => {
        hd += box('st-head', i, 894, c, 92, TASK[i], WHAT[i]);
        md += box('st-mod', i, 762, c, 100, 'Module ' + 'ABC'[i], 'for ' + TASK[i]);
        ls += P(`M686 ${c}H846`, 'ex-line', 'a');
        lp += P(`M686 ${c - 7}H710`, 'ex-line', 'a') + P(`M812 ${c}H846`, 'ex-line', 'a');
        sp += P(`M700 ${c + 7}H710`, 'st-sup', 's');
      });
      s += V('prior', T(894, 414, 'tailored module required', 'ex-text--acc', 'middle'));
      // probe inspector: the chosen patch, enlarged (real pixels)
      s += T(590, 18, 'PROBE', 'ex-text--mono') + `<svg x="590" y="30" width="112" height="111" viewBox="${crop(S.pin)}" preserveAspectRatio="none" data-zoom><image href="${IMG}current.webp" width="320" height="198"/></svg>`
        + R(590, 30, 112, 111, 'st-frame', ' rx="1"') + T(716, 46, '', 'ex-text--title', '').replace('<text', '<text data-i="0"')
        + [62, 92, 108, 124].map((y, j) => T(716, y, '', j ? 'ex-text--muted' : 'ex-text--mono').replace('<text', `<text data-i="${j + 1}"`)).join('');
    }
    s += V('stpn', ls) + V('prior', lp + sp + md) + hd + '</g>';
    // the probe: a radiogroup of 40 patches (roving tabindex), plus its overlay
    s += `<g role="radiogroup" aria-label="Probe: choose a patch of the current frame (arrow keys move)" data-grid>${R(gx - 1, gy - 1, 8 * (tw + gap), 5 * (th + gap), 'st-gbg')}`;
    for (let i = 0; i < 40; i++) s += `<g class="st-tile" role="radio" data-i="${i}" aria-label="Patch row ${(i >> 3) + 1}, column ${i % 8 + 1}">${pic('current', tX(i), tY(i), tw, th, crop(i), 320, 198)}</g>`;
    s += '</g><g class="st-probe" aria-hidden="true" data-probe></g>';
    svg.setAttribute('viewBox', `0 0 ${G.W} ${G.H}`);
    svg.innerHTML = s;
    tiles = [...svg.querySelectorAll('.st-tile')];
    const grid = svg.querySelector('[data-grid]');
    tiles.forEach((t, i) => {
      t.addEventListener('pointerenter', () => { hover = i; draw(); });
      t.addEventListener('click', () => { t.focus(); pick(i); });
      t.addEventListener('focus', () => pick(i));
    });
    grid.addEventListener('pointerleave', () => { hover = null; draw(); });
    grid.addEventListener('keydown', (ev) => {
      const i = S.pin, r = i >> 3, c = i % 8;
      const j = { ArrowRight: c < 7 ? i + 1 : i, ArrowLeft: c ? i - 1 : i, ArrowDown: r < 4 ? i + 8 : i, ArrowUp: r ? i - 8 : i, Home: r * 8, End: r * 8 + 7 }[ev.key];
      if (j === undefined) { if (ev.key === ' ' || ev.key === 'Enter') ev.preventDefault(); return; }
      ev.preventDefault(); tiles[j].focus();
    });
  }

  function pick(i) { if (S.pin !== i) { S.pin = i; hover = null; update(); } }

  const nb = (i) => [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([a, b]) => [(i >> 3) + a, i % 8 + b])
    .filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 8).slice(0, 3).map(([r, c]) => r * 8 + c);

  function draw() { // probe overlay only (cheap; runs on hover)
    const i = hover ?? S.pin, on = S.mode === 'stpn' && S.on, [x, y] = G.c(i), [tX, tY, tw, th] = G.t, [ty, p0, x0, st, n] = G.st;
    let s = '';
    const line = (x2, y2, c) => `<path class="st-halo" d="M${x} ${y}L${x2} ${y2}"/><path class="${c}" d="M${x} ${y}L${x2} ${y2}"/>`;
    if (on) for (let j = 0; j < 5; j++) s += line(p0 + j * st + 6, ty - 1, 'st-att');
    nb(i).forEach((q) => { const [a, b] = G.c(q); s += line(a, b, 'st-nb') + `<circle class="st-nbdot" cx="${a}" cy="${b}" r="3.5"/>`; });
    s += `<rect class="st-ringo" x="${tX(i) - 2}" y="${tY(i) - 2}" width="${tw + 4}" height="${th + 4}" rx="3"/><rect class="ex-ring" x="${tX(i) - 2}" y="${tY(i) - 2}" width="${tw + 4}" height="${th + 4}" rx="3"/>`;
    if (i < n) s += `<rect class="ex-ring" x="${x0 + i * st - 2}" y="${ty - 2}" width="16" height="16" rx="3"/>`;
    svg.querySelector('[data-probe]').innerHTML = s;
    const pr = S.mode === 'prior', nm = `Patch ${(i >> 3) + 1}, ${i % 8 + 1}`, reads = on ? 'reads 5 prompts + 3 neighbours' : 'reads its 3 neighbours only';
    const note = pr ? ['Temporal information arrives only', 'after the backbone.'] : on ? ['The prompts carry what the', 'support frames saw.'] : ['Without prompts it sees the', 'blurred frame alone.'];
    const txt = [nm, `token x${i + 1} of 40`, reads, ...note];
    svg.querySelectorAll('[data-i]').forEach((t) => { if (t.tagName === 'text') t.textContent = txt[t.dataset.i]; });
    svg.querySelector('[data-zoom]')?.setAttribute('viewBox', crop(i));
    const cap = svg.querySelectorAll('[data-cap]');
    if (cap.length) { cap[0].textContent = pr ? 'Tailored module required for each task.' : `${nm} ${reads}.`; cap[1].textContent = pr ? 'Temporal information arrives only after the backbone.' : note.join(' '); }
  }

  function update(pulse) {
    const pr = S.mode === 'prior', on = !pr && S.on, st = { stpn: !pr, prior: pr, on, off: !pr && !S.on };
    svg.querySelectorAll('[data-v]').forEach((g) => g.classList.toggle('ex-hidden', !st[g.dataset.v]));
    svg.querySelectorAll('[data-dim]').forEach((g) => g.classList.toggle('ex-dim', !on));
    const p = svg.querySelector('[data-p]');
    p.classList.toggle('ex-hidden', pr); p.classList.toggle('ex-dim', !pr && !S.on);
    p.style.transform = on || pr ? '' : `translateY(${k === 'm' ? 20 : -18}px)`;
    svg.querySelectorAll('[data-t]').forEach((g) => g.classList.toggle('is-on', +g.dataset.t === S.task));
    tiles.forEach((t, i) => { t.setAttribute('aria-checked', String(i === S.pin)); t.setAttribute('tabindex', i === S.pin ? '0' : '-1'); });
    sw.setAttribute('aria-checked', String(S.on)); sw.disabled = pr;
    radios.forEach((r) => { r.checked = r.name === 'stpn-mode' ? r.value === S.mode : +r.value === S.task; });
    if (pulse && !pr && !reducedMotion()) {
      svg.querySelectorAll('.st-bb, .st-p').forEach((el) => { el.classList.remove('ex-pulse'); void el.getBoundingClientRect(); el.classList.add('ex-pulse'); });
    }
    draw();
    const t = TASK[S.task], w = WHAT[S.task], i = S.pin, nm = `patch row ${(i >> 3) + 1}, column ${i % 8 + 1}`;
    out('tokens', on ? '45 <small>5 + 40</small>' : '40');
    out('modules', pr ? '3 <small>A, B, C</small>' : '0');
    out('where', pr ? 'after the backbone' : on ? 'at the input' : 'nowhere <small>one frame only</small>');
    desc.say(pr
      ? `Prior pipeline, ${t} (${w}). The support frames pass through their own backbone, and integration module ${'ABC'[S.task]}, built for ${w} only, fuses them with the current frame after the backbone. 40 tokens enter the backbone; ${nm} reads only its in-frame neighbours, so temporal information arrives only after the backbone.`
      : on ? `STPN, ${t} (${w}). 45 tokens enter one unmodified Swin-T backbone: 5 video prompts predicted from the support frames, then the 40 patches of the blurred current frame. The probe, ${nm}, reads the 5 prompts and 3 neighbours. Changing the task changes only the head; backbone and prompts stay the same.`
        : `Prompts switched off: 40 tokens, the blurred current frame alone, as in a single-frame detector. The probe, ${nm}, reads only its 3 neighbours.`);
  }

  const layout = () => { const nk = svg.parentElement.clientWidth < 560 ? 'm' : 'd'; if (nk !== k) { k = nk; build(); update(); } };
  radios.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    if (r.name === 'stpn-mode') { S.mode = r.value; update(); } else { S.task = +r.value; update(true); }
  }));
  sw.addEventListener('click', () => { S.on = !S.on; update(); });
  root.querySelector('[data-action="reset"]').addEventListener('click', () => { S = { ...DEF }; hover = null; update(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(layout)).observe(svg.parentElement);
  layout();
  root.classList.add('is-ready');
}

/* charts.js (spec §7.20): <table data-chart="dot|bars|dots-multi"> → accessible SVG.
   Attributes and markup: docs/HOWTO.md ("Charts"). Without JS the table shows. */
const T = (c) => c.textContent.trim();
const N = (c) => parseFloat((c.dataset.value || T(c)).replace('−', '-').replace(/[^\d.eE+-]/g, ''));
const E = (s) => String(s).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));
const F = (v) => String(+v.toFixed(3));
const role = (d, n, el) => el.hasAttribute('data-highlight') || n === d.highlight ? 'focus'
  : el.hasAttribute('data-memory-row') || n === (d.memory || d.memoryRow) ? 'memory' : 'context';
const tx = (c, x, y, s, a) => `<text${c ? ` class="${c}"` : ''} x="${x}" y="${y}"${a ? ` text-anchor="${a}"` : ''}>${s}</text>`;
const ln = (c, x1, x2, y1, y2) => `<line class="${c}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}"/>`;

/* Axis: a nice step (1/2/5 × 10^k, about 3 intervals when narrow, 5 when wide); lo and hi are
   rounded OUT to whole steps, so every tick is evenly spaced and labelled. Right margin fits
   the widest value label, so labels end inside the SVG. */
function plot(W, rows, lo, hi, kind, unit) {
  const nS = rows[0].vals.length, gh = nS * 14 - 2, multi = kind == 'multi', bars = kind == 'bars';
  const lw = Math.min(W * .42, 20 + 7.4 * Math.max(...rows.map((r) => r.name.length)));
  const vw = Math.max(0, ...rows.flatMap((r) => r.vals.map((d) => d.s.length)));
  const R = W - (multi ? 12 : Math.max(24, 16 + 7.2 * vw));
  const raw = (hi - lo || 1) / (R - lw < 360 ? 3 : 5), p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  const st = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, q = (v) => +v.toFixed(9);
  lo = q(Math.floor(q(lo / st)) * st); hi = q(Math.ceil(q(hi / st)) * st);
  const X = (v) => lw + (v - lo) / (hi - lo) * (R - lw), tk = [];
  for (let i = 0; i <= Math.round((hi - lo) / st); i++) tk.push(q(lo + i * st));
  const P = bars ? gh + 16 : multi ? 40 : 36, top = multi ? 26 : 4, ay = top + rows.length * P + 4;
  // Tick labels (11px mono ≈ 6.8px/char): the last carries the unit; a middle label that would
  // touch its right-hand neighbour is left out (its gridline stays).
  const lab = tk.map((v, i) => {
    const t = F(v) + (i == tk.length - 1 && unit ? ' ' + unit : ''), w = t.length * 6.8, x = X(v);
    const a = !i ? 'start' : i == tk.length - 1 ? 'end' : 'middle';
    return { t, x, a, l: a == 'start' ? x : a == 'end' ? x - w : x - w / 2, r: a == 'start' ? x + w : a == 'end' ? x : x + w / 2 };
  });
  for (let i = lab.length - 2, next = lab[lab.length - 1]; i > 0; i--) {
    if (lab[i].r + 6 > next.l || lab[i].l - 6 < lab[0].r) lab[i].t = ''; else next = lab[i];
  }
  let s = tk.map((v, i) => ln('ch-grid', X(v), X(v), top - 4, ay)
    + (lab[i].t ? tx('ch-tick', lab[i].x, ay + 16, E(lab[i].t), lab[i].a) : '')).join('')
    + ln('ch-axis', lw, R, ay, ay);
  rows.forEach((r, i) => {
    const y = top + i * P + P / 2;
    s += `<g class="ch-row"><title>${E(r.name)}: ${E(r.vals.map((d) => (nS > 1 ? d.name + ' ' : '') + d.s).join(', '))}</title><rect class="ch-hit" x="0" y="${y - P / 2}" width="${W}" height="${P}"/>`
      + tx(r.role == 'focus' && 'ch-lab--focus', lw - 12, y + 4.5, E(r.name), 'end') + (bars ? '' : ln('ch-guide', lw, R, y, y));
    r.vals.forEach((d, j) => {
      if (isNaN(d.v)) return;
      const x = X(d.v), c = 'ch-' + d.role, vc = 'ch-val' + (d.role == 'focus' ? ' ch-val--focus' : '');
      if (bars) {
        const by = y - gh / 2 + j * 14, w = Math.max(x - lw, 1), q = Math.min(4, w);
        s += `<path class="${c}" d="M${lw} ${by}h${w - q}a${q} ${q} 0 0 1 ${q} ${q}v${12 - 2 * q}a${q} ${q} 0 0 1 -${q} ${q}h${q - w}z"/>` + tx(vc, x + 6, by + 10, E(d.s));
      } else {
        const yy = multi ? y + (j - (nS - 1) / 2) * 9 : y; // dodge series so equal values stay visible
        s += d.role == 'memory' ? `<rect class="${c}" x="${x - 5}" y="${yy - 5}" width="10" height="10" rx="1"/>`
          : `<circle class="${multi && d.role == 'context' ? 'ch-hollow' : c}" cx="${x}" cy="${yy}" r="${d.role == 'focus' ? 6 : 5}"/>`;
        if (!multi) s += tx(vc, x + 11, y + 4, E(d.s));
      }
    });
    if (multi && !i) { // direct labels on the first row, only if every one fits
      let prev = -1e9, out = '';
      if ([...r.vals].sort((a, b) => a.v - b.v).every((d) => {
        const x = X(d.v), h = d.name.length * 3.4 + 6;
        out += tx('ch-dl', x, y - (nS - 1) * 4.5 - 11, E(d.name), 'middle');
        return x - h >= prev && x + h <= W && (prev = x + h);
      })) s += out;
    }
    s += '</g>';
  });
  return `<svg class="chart__svg" width="${W}" height="${ay + 24}" viewBox="0 0 ${W} ${ay + 24}" aria-hidden="true">${s}</svg>`;
}

function init(t) {
  const d = t.dataset, kind = d.chart, cap = t.caption ? T(t.caption) : '', lb = 'lowerBetter' in d, pan = 'panels' in d;
  const ser = [...t.tHead.rows[0].cells].slice(1).map((c) => ({ name: T(c), el: c, role: role(d, T(c), c) }));
  const rows = [...t.tBodies[0].rows].map((tr) => {
    const name = T(tr.cells[0]), rr = role(d, name, tr), cells = [...tr.cells].slice(1);
    return { name, role: rr, cells, vals: cells.map((c, j) => ({ v: N(c), s: T(c), name: ser[j].name, role: ser.length > 1 && !pan ? ser[j].role : rr })) };
  });
  ser.forEach((_, j) => { // best value per column in weight 600
    const vs = rows.map((r) => r.vals[j].v).filter((v) => !isNaN(v)), b = lb ? Math.min(...vs) : Math.max(...vs);
    rows.forEach((r) => r.cells[j].classList.toggle('is-best', r.vals[j].v === b));
  });
  const all = rows.flatMap((r) => r.vals.map((v) => v.v)).filter((v) => !isNaN(v));
  const lo = kind == 'bars' ? 0 : +(d.min ?? Math.min(...all)), hi = +(d.max || Math.max(...all)), unit = d.unit || '';
  const sum = pan ? ser.map((c, j) => `${c.name}: ${rows.map((r) => `${r.name} ${r.vals[j].s}`).join(', ')}`).join('. ')
    : rows.map((r) => r.name + (ser.length > 1 ? ': ' + r.vals.map((v) => `${v.name} ${v.s}`).join(', ') : ' ' + r.vals[0].s) + (r.role == 'focus' ? ' (highlighted)' : '')).join('; ');
  const box = document.createElement('div');
  box.className = 'chart__render';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `${cap}${lb ? ', lower is better' : ''}. ${sum}.${!pan && kind != 'bars' && lo > 0 ? ' The axis does not start at zero.' : ''}`);
  box.innerHTML = `<p class="chart__title">${E(cap)}${lb ? '<span class="chart__lb">↓ lower is better</span>' : ''}</p>`
    + (pan || ser.length < 2 ? '' : `<ul class="chart__legend">${ser.map((c) => `<li><span class="chart__sw chart__sw--${kind == 'bars' ? 'bar chart__sw--' + c.role : c.role == 'context' ? 'hollow' : c.role}"></span>${E(c.name)}</li>`).join('')}</ul>`)
    + '<div class="chart__plot"></div>';
  t.before(box);
  const det = document.createElement('details');
  det.className = 'chart__table';
  det.innerHTML = '<summary>Show as table</summary><div class="chart__scroll"></div>';
  box.after(det);
  det.lastChild.append(t);
  (t.closest('figure') || box.parentElement).classList.add('is-ready');
  const el = box.lastChild;
  let lastW = 0;
  const render = () => {
    const W = Math.round(el.clientWidth);
    if (!W || W == lastW) return;
    lastW = W;
    if (!pan) { el.innerHTML = plot(W, rows, lo, hi, kind == 'dots-multi' ? 'multi' : kind, unit); return; }
    el.innerHTML = `<div class="chart__panels" data-n="${ser.length}">${ser.map((c) => `<div><p class="chart__ptitle">${E(c.name)}${lb ? ' ↓' : ''}</p></div>`).join('')}</div>`;
    [...el.firstChild.children].forEach((p, j) => {
      const pr = rows.map((r) => ({ ...r, vals: [r.vals[j]] }));
      p.insertAdjacentHTML('beforeend', plot(Math.round(p.clientWidth), pr, 0, +(ser[j].el.dataset.max || Math.max(...pr.map((r) => r.vals[0].v).filter((v) => !isNaN(v)))), 'bars', ''));
    });
  };
  render();
  if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(render)).observe(el);
}

document.querySelectorAll('table[data-chart]').forEach((t) => { try { init(t); } catch (e) { console.error('charts.js:', e); } });

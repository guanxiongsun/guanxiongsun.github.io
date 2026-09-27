/* example-demo.js: the template's placeholder explorable. It models nothing; it only shows
   how a demo module uses the article.js helpers. Copy the pattern into
   /assets/js/demos/<name>.js, then delete this file from your project folder.

   Pattern: init eagerly at module load (NOT behind onNear: the controls stay hidden until
   .is-ready, so a lazy init would let keyboard users Tab straight past them) → draw an
   informative, paused initial state →
   Play/Step/Reset/range drive a pure step() on seeded state (mulberry32) → render() updates the
   SVG, the aria-hidden readout and the throttled description → add .is-ready. */
import { mulberry32, createPlayer, createAnnouncer, syncPlayButton, bindRange, reducedMotion } from '/assets/js/article.js?v=20261001';

const T = 24, CAP = 8, SEED = 20260926;
const root = document.getElementById('demo');
if (root) init(); // eager: see the header

function init() {
  const svg = root.querySelector('[data-stage]');
  const k = root.querySelector('#demo-k');
  const desc = createAnnouncer(root.querySelector('.explorable__desc'));
  const out = (name) => root.querySelector(`[data-out="${name}"]`);
  const playBtn = root.querySelector('[data-action="play"]');
  let rand, t, mem, keys;

  const reset = () => { rand = mulberry32(SEED); t = -1; mem = []; keys = []; for (let i = 0; i < 8; i++) step(); };
  function step() {
    if (t >= T - 1) return false;
    t++;
    mem.push(t);
    if (mem.length > CAP) mem.shift();                      // a frame-wise queue: evict the oldest
    const pool = [...mem];                                   // read a random key set of size K
    const n = Math.min(+k.value, pool.length);
    keys = [];
    while (keys.length < n) keys.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return true;
  }

  const X = (i) => 20 + i * 25;
  function render() {
    let s = '';
    for (let i = 0; i < T; i++) {
      const cls = i === t ? 'ex-focus' : i < t ? 'ex-ink3 ex-dim' : 'ex-empty';
      s += `<rect class="${cls} ex-anim" x="${X(i)}" y="20" width="16" height="16" rx="2"/>`;
    }
    s += `<text class="ex-text ex-text--muted" x="20" y="12">Frames</text><text class="ex-text ex-text--muted" x="20" y="84">Memory (${CAP} slots)</text>`;
    for (let j = 0; j < CAP; j++) {
      const f = mem[j], x = 20 + j * 74;
      s += `<rect class="${f === undefined ? 'ex-empty' : 'ex-memory'}" x="${x}" y="96" width="62" height="40" rx="3"/>`;
      if (f !== undefined) s += `<text class="ex-text ex-text--mono" x="${x + 31}" y="152" text-anchor="middle">f${f}</text>`;
      if (keys.includes(f)) s += `<rect class="ex-ring" x="${x - 3}" y="93" width="68" height="46" rx="5"/>`;
    }
    svg.innerHTML = s;
    out('frame').textContent = `${t + 1}/${T}`;
    out('used').textContent = mem.length;
    out('keys').textContent = keys.length;
    desc.say(`Frame ${t + 1} of ${T}. Memory holds frames ${mem[0]} to ${mem.at(-1)} and reads ${keys.length} of them.`, { playing: player.playing });
  }

  const player = createPlayer(root, {
    interval: 600,
    tick: () => { const ok = step(); render(); return ok; },
    onChange: (p) => syncPlayButton(playBtn, p),
  });
  playBtn.addEventListener('click', () => { if (t >= T - 1) { reset(); render(); } player.toggle(); });
  root.querySelector('[data-action="step"]').addEventListener('click', () => { player.pause(); step(); render(); });
  root.querySelector('[data-action="reset"]').addEventListener('click', () => { player.pause(); reset(); render(); });
  bindRange(k, root.querySelector('output[for="demo-k"]'));
  k.addEventListener('input', () => { const tt = t; reset(); while (t < tt) step(); render(); });

  reset();
  render();
  syncPlayButton(playBtn, false);
  root.classList.add('is-ready');
  root.dataset.motion = reducedMotion() ? 'reduced' : 'full';
}

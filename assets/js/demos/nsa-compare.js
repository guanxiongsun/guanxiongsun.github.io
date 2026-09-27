// NSA Fig. 3: real strips; sentence data on the tabs; CSS draws frame --i and the Average view.
import { createPlayer, createAnnouncer, syncPlayButton, bindRange } from '/assets/js/article.js?v=20261001';

const root = document.getElementById('demo');
if (root) init(); // eagerly, so the controls are in the tab order from the start

function init() {
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const on = (el, ev, fn, o) => (typeof el === 'string' ? $(el) : el).addEventListener(ev, fn, o);
  const tabs = $$('[role=tab]'), grid = $('[data-grid]'), range = $('#nsa-frame'), sw = $('[data-action=baseline]');
  const radios = $$('[name=nsa-view]'), playBtn = $('[data-action=play]');
  const views = $$('.nsa-layers').map((l) => {
    const im = l.querySelector('img');
    for (let k = 1; k < 4; k++) { // Average-view ghosts
      const g = im.cloneNode();
      g.alt = ''; g.className = 'nsa-ghost'; g.style.setProperty('--k', k);
      l.append(g);
    }
    return [l, im.dataset.row];
  });
  const phone = matchMedia('(max-width: 599.98px)');
  const src = (s, r) => `/assets/img/projects/nsa/cmp-s${s}-${r}.webp`;
  const out = (k, v) => { $(`[data-out=${k}]`).innerHTML = v; };
  // #demo-desc is the visible caption (every change); #demo-live speaks, throttled while playing.
  const cap = $('#demo-desc'), live = createAnnouncer($('#demo-live')), outEl = $('.ctrl__out');
  const syncRange = bindRange(range, outEl);
  const look = () => { const t = tabs[s - 1]; return t.dataset.look + (base && t.dataset.lookBase ? ` ${t.dataset.lookBase}` : ''); };
  const text = () => (avg
    ? `Average of the four frames: reference signer${base ? ', Stoll et al.' : ''} and Neural Sign Actors. Move the Frame slider to return to single frames.`
    : `Frame ${f} of 4: reference signer${base ? ', Stoll et al.' : ''} and Neural Sign Actors.`);
  let s = 1, f = 2, avg = false, base = true, token = 0, ready = false;

  const render = (lead = '') => {
    grid.style.setProperty('--i', f - 1);
    grid.dataset.view = root.dataset.view = avg ? 'avg' : 'frames';
    grid.classList.toggle('no-base', !base);
    range.value = f; syncRange();
    if (avg) { outEl.value = '–'; range.setAttribute('aria-valuetext', 'All frames averaged; move to pick a frame'); }
    else range.removeAttribute('aria-valuetext');
    radios.forEach((r) => { r.checked = (r.value === 'avg') === avg; });
    sw.setAttribute('aria-checked', base);
    $$('[data-f]').forEach((t) => t.classList.toggle('is-on', !avg && +t.dataset.f === f));
    tabs.forEach((t, j) => { const on = j === s - 1; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    out('s', `${s} <small>of 4</small>`);
    out('f', avg ? 'All 4 <small>averaged</small>' : `${f} <small>of 4</small>`);
    $('.nsa-look').innerHTML = look();
    cap.textContent = text();
    if (ready) live.say(lead + text(), { playing: player.playing });
  };

  const pick = (j, focus) => {
    const t = tabs[j], my = ++token;
    s = j + 1; f = +t.dataset.frame;
    $('[role=tabpanel]').setAttribute('aria-labelledby', t.id);
    $('.nsa-say').textContent = `“${t.dataset.say}”`;
    grid.classList.add('is-busy');
    Promise.all(views.map(([, r]) => { const im = new Image(); im.src = src(s, r); return im.decode().catch(() => {}); }))
      .then(() => {
        if (my !== token) return;
        views.forEach(([l, r]) => l.querySelectorAll('img').forEach((im) => { im.src = src(s, r); }));
        grid.classList.remove('is-busy');
      });
    if (focus) t.focus();
    const tmp = document.createElement('p'); tmp.innerHTML = look();
    render(`Sentence ${s} of 4. ${tmp.textContent} `);
  };

  const go = (k) => { player.pause(); avg = false; f = ((k + 3) % 4) + 1; render(); };
  const player = createPlayer(root, {
    interval: 800,
    tick: () => { f = (f % 4) + 1; render(); },
    onChange: (p) => { syncPlayButton(playBtn, p); if (!p) live.say(text(), { force: true }); },
  });

  on(playBtn, 'click', () => {
    if (player.playing) return player.pause();
    if (avg) { avg = false; render(); }
    player.play();
  });
  on('[data-action=prev]', 'click', () => go(f - 1));
  on('[data-action=next]', 'click', () => go(f + 1));
  on(range, 'input', () => go(+range.value));
  radios.forEach((r) => on(r, 'change', () => { player.pause(); avg = r.value === 'avg'; render(); }));
  on(sw, 'click', () => { base = !base; render(); });
  tabs.forEach((t, j) => on(t, 'click', () => { player.pause(); pick(j); }));
  on('[role=tablist]', 'keydown', (e) => {
    const i = tabs.indexOf(e.target);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: 3 }[e.key];
    if (i < 0 || j === undefined) return;
    e.preventDefault(); player.pause(); pick((j + 4) % 4, true);
  });
  const pre = () => { for (let n = 1; n < 5; n++) views.forEach(([, r]) => { new Image().src = src(n, r); }); };
  on('[role=tablist]', 'pointerenter', pre, { once: true });
  on('[role=tablist]', 'focusin', pre, { once: true });

  // Wide: click a frame. Phone: swipe.
  on(grid, 'click', (e) => {
    const t = e.target.closest('[data-f]'), v = e.target.closest('.nsa-view');
    if (t) go(+t.dataset.f);
    else if (v && !avg && !phone.matches) { const b = v.getBoundingClientRect(); go(1 + Math.min(3, Math.floor(((e.clientX - b.left) / b.width) * 4))); }
  });
  let x0 = null;
  on(grid, 'pointerdown', (e) => { x0 = e.clientX; });
  on(grid, 'pointerup', (e) => {
    const dx = x0 === null ? 0 : e.clientX - x0; x0 = null;
    if (phone.matches && !avg && Math.abs(dx) > 40) go(f + (dx < 0 ? 1 : -1));
  });

  on('[data-action=reset]', 'click', () => { player.pause(); avg = false; base = true; pick(0); });

  syncPlayButton(playBtn, false);
  render();
  ready = true;
  root.classList.add('is-ready');
}

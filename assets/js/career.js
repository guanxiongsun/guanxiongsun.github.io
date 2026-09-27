/* career.js: the horizontal "Experience" line in §07 of the homepage.
   Data: the <li class="career__item"> elements inside [data-career] (see the comment in index.html).
   Each item gets --x (start, % of the axis) and --y (end, %); CSS draws the segment, the dot, the
   leader and the label from those. Without JS the list stays a plain list. */

const box = document.querySelector('[data-career]');
if (box) try { init(box); } catch (e) { console.error('career:', e); }

function init(box) {
  const list = box.querySelector('.career__list');
  const from = +box.dataset.from, to = +box.dataset.to;
  const d = new Date();
  const now = d.getFullYear() + d.getMonth() / 12;
  const pct = (t) => ((Math.min(Math.max(t, from), to) - from) / (to - from)) * 100;

  list.querySelectorAll('.career__item').forEach((li) => {
    const s = +li.dataset.start;
    const e = li.dataset.end === 'now' ? now : li.dataset.end ? +li.dataset.end : s;
    const x = pct(s), y = pct(e);
    li.style.setProperty('--x', x.toFixed(2));
    li.style.setProperty('--y', y.toFixed(2));
    if (!li.dataset.end) li.classList.add('career__item--point');
    // Labels near either edge anchor to that edge instead of centring, so they never clip.
    const mid = (x + y) / 2, align = li.dataset.align;
    if (align === 'start' || (!align && mid < 9)) li.classList.add('career__item--start');
    else if (align === 'end' || (!align && mid > 88)) li.classList.add('career__item--end');
    // Badge + text travel together as one label.
    const label = document.createElement('span');
    label.className = 'career__label';
    label.append(...li.childNodes);
    li.append(label);
  });

  // Year axis: one column per year, label centred in its column.
  const axis = document.createElement('ol');
  axis.className = 'career__axis';
  axis.setAttribute('aria-hidden', 'true');
  for (let yr = from; yr < to; yr++) {
    const li = document.createElement('li');
    li.textContent = yr;
    li.style.setProperty('--x', pct(yr).toFixed(2));
    axis.append(li);
  }
  list.append(axis);
  // On narrow screens the figure scrolls sideways: make the scroller reachable by keyboard.
  box.tabIndex = 0;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Experience timeline, scrolls sideways on small screens');
  const hint = document.createElement('p');
  hint.className = 'career__hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Swipe for more →';
  box.after(hint);
  box.dataset.ready = '';
}

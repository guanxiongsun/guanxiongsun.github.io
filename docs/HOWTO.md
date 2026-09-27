# How to update the site

Plain HTML, CSS and JavaScript. No build step: edit a file, commit to `main`,
and GitHub Pages publishes it within a few minutes. Preview locally with

```bash
python3 -m http.server 8765      # from the repo root, then open http://localhost:8765
```

On `localhost` the site runs in **dev mode**: every unverified item (`data-todo`) is
shown with a pink dashed outline and a label, and the browser console lists them all.
Add `?dev=0` to the URL to see exactly what visitors see. Everything in this repository
is public, including `data-todo` notes, so keep them neutral (no unannounced plans).
Do not `import` `/assets/js/site.js` from another module: it initialises on load (a guard
stops a second copy, but the exports would come from a different instance).

---

## 1. Where things live

| What | File |
|---|---|
| Colours, fonts, type sizes, spacing, motion | `assets/css/tokens.css` (the only place colours are defined) |
| Shared components + homepage sections (incl. the Vision / Collaborate teasers) | `assets/css/site.css` |
| Project-page layout (article grid, TOC, sidenotes, demos, charts) + the `/vision/` and `/collaborate/` page heads | `assets/css/article.css` |
| Behaviour (theme, menu, videos, lightbox, copy, filters, A/B toggle, YouTube) | `assets/js/site.js` |
| The homepage throughline figure | `assets/js/throughline.js` |
| Project pages: TOC, hotspots, frame stepper, demo helpers | `assets/js/article.js` |
| Charts drawn from tables (project pages) | `assets/js/charts.js` |
| One interactive demo per project page | `assets/js/demos/<name>.js` |
| Copy-to-start project page | `projects/_template/` (noindex; see "Add a project page") |
| The full Vision page (essay, pull quote, in-progress cards with schematics) | `vision/index.html` |
| The full Collaborate page (open problems, "On my desk", ways to work together, contact) | `collaborate/index.html` |
| Icons | `assets/icons/sprite.svg`, used as `<svg class="icon"><use href="/assets/icons/sprite.svg#github"/></svg>` |
| Fonts + licences | `assets/fonts/`, `assets/fonts/LICENSES/` |
| Images, videos | `assets/img/`, `assets/video/` (originals stay in `images/`) |

Rules that keep the site easy to edit:

- **No inline styles**, except the custom properties `--x`, `--y`, `--i`.
- **Behaviour attaches through `data-*` attributes**; you never need to touch the JS to add content.
- **Every section must read fine with JavaScript off.**
- **Cache-busting:** CSS and JS links end in `?v=20261004`. When you change a CSS or JS file,
  bump that date everywhere at once: search and replace `?v=20261004` across **all `.html` and
  `.js` files** (the demo modules in `assets/js/demos/` and `projects/_template/example-demo.js`
  import `article.js?v=…`, and that string must match the page's own `<script>` tag).

The homepage runs, in this order: hero, **01 News**, **02 Throughline**, **03 Experience**,
**04 Selected work**, **05 Publications**, **06 Vision** (teaser), **07 Collaborate** (teaser),
**08 Service & background**.
The header nav on every page is News · Work · Publications · Vision · Collaborate (on the homepage
these are `#news #work #publications #vision #collaborate`; elsewhere `/#news /#work /#publications
/vision/ /collaborate/`). Keep that order and the `<nav>` markup identical on every page.

Vision and Collaborate are **teasers** on the homepage: a section head, a short intro, a compact
preview and a link to the full page. Their full content lives on `/vision/` and `/collaborate/`.

Comment fences mark the places you will edit most:

- `index.html`: `<!-- NOW: edit me -->` (the "Now" line in the hero), `<!-- NEWS: add newest at top -->`,
  `<!-- ===== 04 PUBLICATIONS: newest first; copy a .pub block (docs/HOWTO.md) ===== -->`,
  `<!-- ===== 05 VISION (teaser…) -->` and `<!-- ===== 06 COLLABORATE (teaser) -->`.
- `collaborate/index.html`: `<!-- PROBLEM: set data-state="connected" when public -->`.

---

## 2. Honesty rules

- **No number without a source.** Every stat row is followed by a `Source:` line.
- **Every figure, demo or chart carries exactly one badge:**
  `badge--paper` (FROM THE PAPER), `badge--schematic` (SCHEMATIC, illustrative only),
  `badge--real` (REAL OUTPUT, actual model output), `badge--progress` (IN PROGRESS).
- **Papers led by others name their lead authors.**
- **Not sure yet? Mark it `data-todo`.** It ships hidden:

  ```html
  <span data-todo="what is missing">text that is not confirmed yet</span>
  <li data-todo="date">A whole item that waits for confirmation</li>
  ```

  Once confirmed, delete the `data-todo="…"` attribute and the content appears.

---

## 3. Recipes

### Add a news item

In `index.html`, find `<!-- NEWS: add newest at top -->`. Paste the new line at the top of
`<ol class="news">`, then move the list's last item (the sixth) to the top of the list inside
`<details class="news__more">`, so five stay visible:

```html
<li class="news__item"><time datetime="2026-10">Oct 2026</time><p><b>Something</b> happened.</p></li>
```

- `datetime` is `YYYY-MM` (or `YYYY` when the month is unknown; then wrap the missing month in
  `<span data-todo="news month">Mon </span>` until you know it).
- Link the thing the news is about: a paper card (`href="#pub-KEY"`), a project page
  (`/projects/<slug>/`), an in-progress card on the Vision page (`/vision/#physical-ai`) or an external page. Papers led by someone else name them
  ("Zhaoyu Zhang’s <a …>Title</a> (I’m a co-author)").

### Add a publication

1. Put the figure at `images/<key>.png`.
2. Make the web versions: `python3 tools/make_assets.py figure images/<key>.png`
   (writes `assets/img/<key>.webp`, `<key>-640.webp` and, for wide sources, `<key>-1280.webp`).
3. Copy an existing `.pub` block into its year group (create a new
   `<div class="pub-year hang" data-year="YYYY">` group if needed) and fill it in:

```html
<article class="pub" id="pub-KEY" data-thread data-key="KEY" data-short="Short label" data-date="2026-06"
  data-lane="perceive" data-tags="video" data-first-author data-venue="CVPR 2026"
  data-note="One sentence for the throughline popover."
  data-href="#pub-KEY" data-thumb="/assets/img/KEY-640.webp">
  <a class="plate plate--thumb plate__zoom" href="/assets/img/KEY.webp" data-full="/assets/img/KEY.webp" data-caption="What the figure shows (paper Fig. 1)."><span class="visually-hidden">Enlarge figure: </span>
    <span class="plate__mat"><img src="/assets/img/KEY-640.webp" srcset="/assets/img/KEY-640.webp 640w, /assets/img/KEY-1280.webp 1280w" sizes="(min-width: 1024px) 280px, (min-width: 600px) 220px, calc(100vw - 32px)" width="640" height="HEIGHT" loading="lazy" decoding="async" alt="Describe what the figure shows."></span>
    <span class="plate__zoom-icon" aria-hidden="true"><svg class="icon" width="14" height="14" focusable="false"><use href="/assets/icons/sprite.svg#maximize-2"/></svg></span>
  </a>
  <div class="pub__body">
    <p class="pub__meta"><span class="venue">CVPR 2026</span></p>
    <h4 class="pub__title"><a href="PAPER-URL">Full Paper Title</a></h4>
    <p class="pub__authors"><b class="me">Guanxiong Sun</b>, Co Author, Co Author</p>
    <p class="pub__tldr">One-sentence takeaway.</p>
    <div class="pub__links">
      <a class="pill" href="PDF-URL">PDF</a>
      <a class="pill" href="CODE-URL">Code</a>
      <details class="bib"><summary class="pill">BibTeX</summary><div class="code-wrap"><pre class="code"><code>@inproceedings{...}</code></pre><button class="btn-icon code-copy" type="button" aria-label="Copy BibTeX for SHORT NAME"><svg class="icon copy-btn__copy" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#copy"/></svg><svg class="icon copy-btn__done" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#check"/></svg></button></div></details>
    </div>
  </div>
</article>
```

What the attributes do:

| Attribute | Values | Used by |
|---|---|---|
| `data-thread` | (present) | makes the card a node on the throughline |
| `data-key` | short id, same as `id="pub-KEY"` | throughline |
| `data-short` | label on the throughline | throughline |
| `data-date` | `YYYY-MM` | throughline position |
| `data-lane` | `perceive`, `generate`, `learn` or `act` | throughline row |
| `data-tags` | any of `video generative motion multimodal`, space-separated | topic filter chips |
| `data-first-author` | (present when you are first author) | "First-author only" switch |
| `data-flagship` | (present for work with a project page) | throughline accent node |
| `data-venue`, `data-note`, `data-thumb` | text, text, 640px image | throughline popover |
| `data-href` | project page, else `#pub-KEY` | throughline link |

The throughline, filter counts and "Showing N of M" update automatically.
For a paper led by someone else, leave out `data-first-author`, and link their names.

4. If the card has `data-thread`, also add one line to the no-JavaScript fallback list of the
   throughline (`<ol class="throughline__fallback">` near the top of `index.html`), in date order:

   ```html
   <li data-lane="generate"><span class="tf__year">2026</span> <a href="#pub-KEY">Short label</a> <span class="tf__meta">CVPR 2026 · Generate</span></li>
   ```

5. Preview on localhost: the new dot appears on the throughline, the filter chips count it,
   and dev mode lists any `data-todo` you left.

### Add an in-progress item to the throughline (Vision teaser + Vision page)

The throughline is built from every `[data-thread]` element on the **homepage**: the `.pub` cards
plus the two teaser cards in `<section id="vision">` (e.g. `#physical-ai-teaser`).
The full cards on `/vision/` (e.g. `#physical-ai`, with schematics and open questions) carry
**no** `data-thread`, so nothing is counted twice. To add a third in-progress item:

1. On `/vision/`, copy a `<article class="card-progress" id="KEY">` inside `.progress-grid`.
   Its `id` is the deep-link target. Claim no results; keep the `badge--schematic` on any figure.
2. On the homepage, copy a teaser card in `.teaser-grid`:

   ```html
   <article class="card-progress card-progress--teaser" id="KEY-teaser" aria-labelledby="KEY-teaser-title"
     data-thread data-key="KEY" data-short="Short label" data-date="YYYY-MM" data-lane="act" data-status="in-progress"
     data-venue="In progress" data-note="One sentence for the throughline popover."
     data-href="/vision/#KEY">
     <p class="status-pill">In progress · YYYY</p>
     <h3 class="card-progress__title" id="KEY-teaser-title">Same title as the full card</h3>
     <p class="card-progress__text">One sentence.</p>
     <p class="card-progress__cta"><a class="link-arrow" href="/vision/#KEY">Read more<span class="visually-hidden">: Short label</span><svg class="icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#arrow-right"/></svg></a></p>
   </article>
   ```

   The teaser's `id` ends in `-teaser` (never the bare `KEY`, which belongs to the full card), and
   `data-href` points at the Vision page. The node is drawn dashed, in the accent colour; its
   popover title is the card's `<h3>`.
3. Add its line to the no-JavaScript fallback list (`ol.throughline__fallback`), e.g.
   `<li data-lane="act" data-status="in-progress"><span class="tf__year">2027</span> <a href="/vision/#KEY">Short label</a> <span class="tf__meta">In progress · Act</span></li>`.

### Add an open problem (Collaborate page + homepage teaser)

1. On `/collaborate/`, copy a `<li class="problem" id="problem-N" data-state="open">` in
   `<ol class="problems">`: numeral (`problem__num`), `<h2 class="problem__title">`, one paragraph,
   the "Good fit if you work on" tags, and the "Discuss this" `mailto:` link with the title in its
   `subject=`. Number the `id` in order (`problem-5`).
2. On the homepage, add the matching line to `<ol class="problems problems--teaser">` in
   `<section id="collaborate">`: the same numeral, the same title linking to
   `/collaborate/#problem-N`, and the same tags:

   ```html
   <li class="problem">
     <span class="problem__num" aria-hidden="true">V</span>
     <div class="problem__body">
       <h3 class="problem__title"><a href="/collaborate/#problem-5">Problem title<svg class="icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#arrow-right"/></svg></a></h3>
       <ul class="tags"><li class="tag">Tag</li><li class="tag">Tag</li></ul>
     </div>
   </li>
   ```

   The teaser line carries no `data-state` and no description; the state and the details live on
   the Collaborate page only. If the throughline's open node ("Your project?") should mention the
   new count, edit `data-open-note` on `#throughline-figure`.

### Throughline text (legend, hint, open node)

`throughline.js` reads its words from the HTML, so each is written once:

- Lane descriptions: `ul.throughline__legend` (`.lane__text` per lane). The figure draws them into
  the SVG gutter when the box is 900px or wider, the mobile rail repeats them as group headers
  (the list is then `aria-hidden`), and between 840 and ~950px viewports the list shows as a row.
- Usage hint: `p.throughline__hint`, right after `#throughline-figure`. Drawn into the SVG year
  row with the legend inline; shown as a line under the figure between 840 and 900px; not shown
  with the rail or without JavaScript.
- Open node: `data-open-label`, `data-open-href`, `data-open-note` on `#throughline-figure`.
- The no-JS list `ol.throughline__fallback` is written by hand: keep it in step with the cards.

### Add a role to the Experience line (§03)

The horizontal line is built by `assets/js/career.js` from the list inside `<div class="career" data-career>`
in `index.html`. Add one `<li class="career__item">`, oldest first:

```html
<li class="career__item" data-start="2027.2" data-end="now" data-side="below" data-current>
  <span class="career__badge career__badge--mono" aria-hidden="true">ABC</span>
  <span class="career__text"><b class="career__org">Organisation</b><span class="career__role">Role</span><span class="career__years">2027–now</span></span>
</li>
```

- `data-start` / `data-end` are decimal years (2027.5 = mid-2027). Omit `data-end` for a short stint (a dot);
  use `data-end="now"` for the current role, and move `data-current` onto it (accent colour).
- `data-side="above|below"` puts the label above or below the track; `data-align="start|end"` pins it to the
  segment's start or end when centred labels would collide.
- `data-overlap` draws a role that overlaps another (e.g. Bristol inside the Huawei years) as a raised
  dashed bracket.
- Extend the axis with `data-to` on `.career` (it is exclusive: `data-to="2028"` ends after 2027).
- **Logos:** the current marks are official emblems taken from each organisation's own website
  (`assets/img/logos/`: SenseTime, Oosto, Bristol, QUB; Baidu and Huawei are sprite marks). A badge holds a sprite mark (`<svg><use href="/assets/icons/sprite.svg#org-baidu"/></svg>`),
  a monogram, or an official logo file: put it in `assets/img/logos/` and replace the badge contents with
  `<img src="/assets/img/logos/qub.svg" alt="">` (square-ish, transparent background works best).

### A collaboration becomes public ("connected")

Only once the partner has agreed, in public, to be named. In `collaborate/index.html`, find
`<!-- PROBLEM: set data-state="connected" when public -->` and the row in `<ol class="problems">`:

1. Change `data-state="open"` to `data-state="connected"` on its `<li class="problem">`.
2. Inside its `<div class="problem__body">`, directly after the description paragraph, add:

   ```html
   <p class="problem__partner">Now with <a href="https://…">Name, Institution</a></p>
   ```

3. Keep the "Discuss this" link (others may still want to join) or delete it if the problem is closed.
4. Add a News item the same day ("Started working with … on …").

The numeral turns cinnabar and a CONNECTED pill appears; nothing else needs editing (the homepage
teaser line stays as it is; it only links to the row).
Never name anyone as a collaborator before they agree publicly.

### Add a project page

The three live pages (`projects/mamba/`, `projects/stpn/`, `projects/neural-sign-actors/`) are
the best worked examples; the template carries the same structure with every block marked.

1. Copy `projects/_template/` to `projects/<slug>/` and **delete `example-demo.js`** from the copy
   (it is the template's placeholder demo; real demos live in `assets/js/demos/<name>.js`).
2. Remove `<meta name="robots" content="noindex">`.
3. Fill every block marked `<!-- FILL -->`; remove every `class="todo"` and `.todo-note` marker
   (they draw pink dashed outlines, visible everywhere, so a half-filled page is obvious).
   Unconfirmed facts still go in `data-todo` (hidden in production).
4. Replace or delete the **EXAMPLE** components (hero, stepper, hotspots, charts, tables). Their
   numbers are real and sourced, so nothing false can leak, but they belong to other projects.
5. In `<head>`: title "SHORT: Full title · Guanxiong Sun", description, canonical, `og:*`,
   `twitter:*`, and the JSON-LD `ScholarlyArticle`. Swap the demo `<script>` for yours.
6. On the matching `.pub` card: set `data-href="/projects/<slug>/"`, add `data-flagship`,
   and add `<a class="tag tag--accent" href="/projects/<slug>/">Project page</a>` to its meta line
   plus a `Project` pill. (Badges are reserved for Schematic / From the paper / Real output / In progress.)
7. For flagship work, add a feature spread (`<article class="feature">`) in Selected work, with
   "Explore the project" → `/projects/<slug>/` and, if the page has a demo, "Try the interactive"
   → `/projects/<slug>/#demo`. Point the paper's line in `ol.throughline__fallback` at the page too.
8. Update the prev/next cards (`nav.pagenav`) so the order stays one cycle. Today it is
   MAMBA → STPN → Neural Sign Actors → MAMBA; to insert a page, change the "Next" card of the page
   before it and the "Previous" card of the page after it.
9. If the work continues a thread, add a node to the "Where it led" list (`ol.thread`) on the
   related pages (in-progress nodes link to `/vision/#physical-ai` etc.; the "Pick up this thread"
   callout links to `/collaborate/`).
10. Add the URL to `sitemap.xml` (and bump `<lastmod>` on pages you changed).
11. Make its social card: add an entry for `<slug>` to `OG_CARDS` in `tools/make_assets.py`
    (kicker, headline, title, footer, figure), then run `python3 tools/make_assets.py og <slug>`;
    point `og:image` / `twitter:image` at `/assets/og/<slug>.png`.
12. Check it on localhost at 390px and 1440px, light and dark, with `?dev=0`, and once with
    JavaScript switched off (the page must still read: fallback images, static TOC, tables).

### Edit the Vision or Collaborate page

`vision/index.html` and `collaborate/index.html` are plain pages: the same header and footer as
`index.html` (the page's own nav link carries `aria-current="page"`; project pages mark Work
`aria-current="true"` instead, because they belong to that section rather than being it), a `.page-head`, then the
content, then a `nav.pagenext` strip to the other page and back to Selected work. They load
`site.css` + `article.css` and only `site.js`. When you change a title or deck there, mirror it in
the homepage teaser (`#vision` / `#collaborate` in `index.html`); the OG cards come from
`python3 tools/make_assets.py og vision` / `og collaborate`.

**Contents list.** Write the TOC links by hand, one per section, as in the template: that list is
what readers without JavaScript get. (If the list is left empty, `article.js` fills it from the
section headings, but only when JavaScript runs.) Each section is
`<section class="article__section" id="…"><h2>…</h2>…</section>`; `data-toc-label` on the `h2`
gives a shorter entry when the list is generated.

### Project page components (markup lives in `projects/_template/index.html`)

| Want | Markup | Notes |
|---|---|---|
| Break out of the text column | add `wide` (66rem) or `full` to a direct child of `.article` / `.article__section` | text is 42rem |
| Sidenote | `<p>…<sup class="sn-ref">1</sup></p><aside class="sidenote"><sup>1</sup> …</aside>` | the aside must follow its paragraph directly. At ≥1200px it shares the paragraph's row, so keep it no taller than the paragraph (≈ 40 words) or it opens a gap below |
| Numbered hotspots on a figure | `figure.hotspots[data-hotspots]`; `button.hotspot` with `style="--x:37%;--y:60%"` and `aria-describedby` = the `id` of its `li` in `ol.hotspots__list` | positions are % of the image; check them in the browser. The whole figure is one Tab stop; arrow keys move between hotspots. For a spoken name, add `aria-labelledby="<button id> <id of the li's <b> label>"` (see the NSA page) |
| Frame stepper | `figure.stepper[data-stepper][data-label="Frame"]`; `<rect data-step="k" …>` inside `svg.stepper__overlay` (viewBox = image pixels) | controls are generated; `?debug` outlines the rects; `data-autoplay` only plays in view and never under reduced motion |
| Chart | `figure.chart > table[data-chart="dot / bars / dots-multi"]` with `<caption>` + `thead` + `tbody` (first cell of each row = label) | see "Charts" below |
| Plain data table | `div.table-wrap[role=region][tabindex=0][aria-labelledby] > table.data-table` | scrolls sideways on phones |
| Demo | `section.explorable#demo` + `aside.callout.callout--schematic` right after it | see "Demos" below |
| Where it led | `ol.thread > li.thread__node` (current: `aria-current="page"`; future: `thread__node--future`) | then `aside.callout.callout--question` |
| Credit (paper led by others) | `aside.callout.callout--credit` directly under the head | name the lead authors |

**Charts** (`assets/js/charts.js`). The table is the source of truth and stays one click away
("Show as table"); without JavaScript it simply shows. Attributes on the `<table>`:
`data-min`, `data-max` (axis range; bars always start at 0; both are rounded outwards to a whole
tick step, so the axis may start a little lower or end a little higher), `data-unit` (printed after
the last tick),
`data-highlight="Name"` (the row or column that is "ours"), `data-memory="Name"` (painted in the
memory colour, e.g. MAMBA when it is the comparison), `data-lower-better` (adds "↓ lower is better";
the best value per column is then the minimum). `bars` with several value columns draws grouped
bars; add `data-panels` for one small panel per column instead (per-panel axis max from
`<th data-max="80">`). Cells may carry `data-value` if the visible text is not a plain number.
Put `<p class="chart__src">Source: …</p>` (and optionally `p.chart__note`) after the table.

**Demos** (`assets/js/demos/<name>.js`, one per page). Import the helpers from
`/assets/js/article.js?v=…` with the same `?v=` as the page: `mulberry32` (seeded random),
`createPlayer` (play loop that runs while the demo is in view, keeps going after a Play press
until the demo has left the screen, pauses when another video or demo starts, never autoplays
under reduced motion), `createAnnouncer` (throttled screen-reader description), `syncPlayButton`,
`bindRange`, `reducedMotion`, `onReducedMotion`, `onNear`.
Draw the SVG with the `.ex-*` classes in `article.css` (colours follow meaning: focus = ours or
being read, memory = stored, noise = seeds/references, context = baselines), fill the
`[data-out]` readouts and the description, then add `.is-ready` to the `.explorable`: until
then only `.explorable__fallback` shows. `projects/_template/example-demo.js` is a complete,
small example. Rules the three live demos follow:

- **Call `init()` when the module loads**, not behind `onNear()`. The controls stay hidden until
  `.is-ready`, so a lazy start lets keyboard users Tab straight past the demo. (Declare top-level
  `const`s before the `init()` call.)
- **Start paused, in an informative state**, and pair the demo with a "How to read this"
  callout (`aside.callout.callout--schematic`) that says what is illustrative.
- **Budget:** about 12 KB per demo module, measured **gzipped** (`gzip -9c file.js | wc -c`), which
  is how GitHub Pages serves it. The live ones are 2.4–6.9 KB gzipped (5.8–17.7 KB raw).
- **SVG focus:** Chrome does not reliably draw a CSS outline on SVG `<g>`/`<rect>` controls. Draw
  your own ring with `rect.ex-focusring.ex-focusring--halo` + `rect.ex-focusring` (same geometry,
  moved by the module); `article.css` shows it only while the stage has keyboard focus.
- **Nested `<svg>`:** `site.css` gives every `svg` `height: auto`, which collapses a nested `<svg>`
  used as an image crop. Crop with a `clipPath` on an `<image>` instead (as `stpn-prompts.js` does).
- **Controls row:** `.explorable__controls` spaces buttons and `.ctrl` sliders with one gap, so a
  slider that wraps to its own line stays aligned; do not add margins to `.ctrl`.

### Add a silent research loop (video)

Needs ffmpeg on your machine. Keep it ≤ 12 s and ≤ 2 MB, muted, in both formats, plus a poster:

```bash
ffmpeg -i in.mov -an -c:v libvpx-vp9 -crf 34 -b:v 0 out.webm
ffmpeg -i in.mov -an -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart out.mp4
```

Markup (the site pauses it off-screen, respects reduced motion, and adds the play/pause button):

```html
<figure class="plate plate--video">
  <div class="plate__head"><span class="badge badge--real">Real output</span></div>
  <div class="plate__mat">
    <video muted loop playsinline controls preload="none" poster="/assets/img/NAME-poster.webp" width="W" height="H" data-autoplay aria-label="What the video shows">
      <source src="/assets/video/NAME.webm" type="video/webm"><source src="/assets/video/NAME.mp4" type="video/mp4">
    </video>
    <button class="vid-toggle" type="button" data-vid-toggle aria-label="Play animation">
      <svg class="icon vid-toggle__play" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#play"/></svg>
      <svg class="icon vid-toggle__pause" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/icons/sprite.svg#pause"/></svg>
    </button>
  </div>
  <figcaption class="plate__cap">Caption. <span class="plate__src">Source.</span></figcaption>
</figure>
```

(`controls` is for visitors without JavaScript; the script replaces it with the round button.)

### Copy buttons

Any button with `data-copy="#some-id"` copies the text of that element and announces
`data-copy-msg` (default "Copied"). BibTeX blocks use `.code-copy` inside `.code-wrap`.
All of them are hidden when JavaScript is off (they could not work), so the text must be
readable on its own.

### A YouTube talk without loading YouTube up front

```html
<a class="yt" href="https://www.youtube.com/watch?v=ID" data-yt="ID" data-title="Talk title">
  <span class="plate__mat"><img src="/assets/img/…-poster.webp" width="1280" height="720" alt="" loading="lazy"></span>
  <span class="yt__play" aria-hidden="true"><svg class="icon"><use href="/assets/icons/sprite.svg#play"/></svg></span>
  <span class="yt__label">Watch the talk (YouTube)</span>
</a>
```

---

## 4. Things waiting on you

Search the HTML for `data-todo` (or open the site on localhost) for the full list. The main ones:

- CV PDF at `/cv.pdf` (then remove `data-todo` from the CV link in the hero). Until then the
  local link checker reports `/cv.pdf` as missing; visitors never see the link.
- The month you joined Queen's (the Experience line says 2025).
- Recruiting line ("Students & visitors"), office street address, earlier positions.
- HIT supervisor line (Prof. Kuanquan Wang) and the HIT degree years (2016, 2018).
- An image for the Physical AI card, if any.
- Project pages (all from the paper PDFs; never estimate):
  - MAMBA and STPN: author affiliations with superscripts, exactly as printed.
  - STPN: YouTube-VIS 2019 (STPN + MinVIS) and GOT-10k (STPN + MixFormer) numbers and baselines.
  - Neural Sign Actors: your one-sentence contribution; whether the Fig. 1 avatars are model
    output or the 3D fit; the units of the fitting error and of MPVPE / MPJPE; which two
    Saunders et al. papers are (i) and (ii); the exact user-study means.
- BibTeX: the TACTFL entry is hidden until the official BMVC 2025 entry is pasted. The other
  six non-README entries (ICML'25, CVPR'25, ACM MM'24, WACV'24, both ECCV'22) were assembled
  from the official repo READMEs and publisher pages, not exported from DBLP: check them
  against DBLP once and replace any that differ.

## 5. Analytics

The Hitsteps snippet at the end of `index.html` is kept exactly as it was. The old Google
Analytics (Universal Analytics, retired in 2023) tag and the visitor counter were removed.

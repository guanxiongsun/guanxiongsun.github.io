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
| Shared components + homepage sections | `assets/css/site.css` |
| Project-page layout (article grid, TOC, sidenotes, demos, charts) | `assets/css/article.css` |
| Behaviour (theme, menu, videos, lightbox, copy, filters, A/B toggle, YouTube) | `assets/js/site.js` |
| The homepage throughline figure | `assets/js/throughline.js` |
| Icons | `assets/icons/sprite.svg`, used as `<svg class="icon"><use href="/assets/icons/sprite.svg#github"/></svg>` |
| Fonts + licences | `assets/fonts/`, `assets/fonts/LICENSES/` |
| Images, videos | `assets/img/`, `assets/video/` (originals stay in `images/`) |

Rules that keep the site easy to edit:

- **No inline styles**, except the custom properties `--x`, `--y`, `--i`.
- **Behaviour attaches through `data-*` attributes**; you never need to touch the JS to add content.
- **Every section must read fine with JavaScript off.**
- **Cache-busting:** CSS and JS links end in `?v=20260926`. When you change a CSS or JS file,
  bump that date in every HTML file that links it (search and replace `?v=20260926`).

Comment fences in `index.html` mark the places you will edit most:

- `<!-- NOW: edit me -->`: the "Now" line in the hero.
- `<!-- NEWS: add newest at top -->`
- `<!-- ===== 06 PUBLICATIONS: newest first; copy a .pub block (docs/HOWTO.md) ===== -->`
- `<!-- PROBLEM: set data-state="connected" when public -->`

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

Paste at the top of the first `<ol class="news">` and move the sixth item down into
`<details class="news__more">`:

```html
<li class="news__item"><time datetime="2026-10">Oct 2026</time><p><b>Something</b> happened.</p></li>
```

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

### Add an in-progress item to the throughline

Add a card in the Vision section with
`data-thread data-status="in-progress" data-lane="act" data-date="YYYY-MM"` (plus `data-key`,
`data-short`, `data-note`, `data-href`). It is drawn dashed, in the accent colour. Claim no results.

### A collaboration becomes public

On its row in `<ol class="problems">`:

```html
<li class="problem" data-state="connected">
  …
  <p class="problem__partner">Now with <a href="https://…">Name, Institution</a></p>
```

The numeral turns cinnabar and a CONNECTED pill appears. Add a News line at the same time.
Never name anyone as a collaborator before they agree publicly.

### Add a project page

1. Copy `projects/_template/` to `projects/<slug>/`.
2. Remove `<meta name="robots" content="noindex">`.
3. Fill every `<!-- FILL -->` block; delete sections you don't need.
4. On the matching `.pub` card: set `data-href="/projects/<slug>/"`, add `data-flagship`,
   and add `<a class="tag tag--accent" href="/projects/<slug>/">Project page</a>` to its meta line
   plus a `Project` pill. (Badges are reserved for Schematic / From the paper / Real output / In progress.)
5. For flagship work, add a feature spread (`<article class="feature">`) in Selected work.
6. Update the prev/next cards on the other project pages.
7. Add the URL to `sitemap.xml`.
8. Make its social card: first add an entry for `<slug>` to `OG_CARDS` in `tools/make_assets.py`
   (kicker, headline, title, footer, figure), then run `python3 tools/make_assets.py og <slug>`.

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

- CV PDF at `/cv.pdf` (then remove `data-todo` from the CV link in the hero).
- Month of the vfe.pytorch 2.0 release; the date you joined Queen's as a Lecturer.
- Recruiting line ("Students & visitors"), office street address, earlier positions.
- HIT supervisor line (Prof. Kuanquan Wang) and the HIT degree years (2016, 2018).
- MemVLA arXiv link once public; an image for the Physical AI card, if any.
- BibTeX: the TACTFL entry is hidden until the official BMVC 2025 entry is pasted. The other
  six non-README entries (ICML'25, CVPR'25, ACM MM'24, WACV'24, both ECCV'22) were assembled
  from the official repo READMEs and publisher pages, not exported from DBLP: check them
  against DBLP once and replace any that differ.

## 5. Analytics

The Hitsteps snippet at the end of `index.html` is kept exactly as it was. The old Google
Analytics (Universal Analytics, retired in 2023) tag and the visitor counter were removed.

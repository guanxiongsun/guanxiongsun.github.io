#!/usr/bin/env python3
"""Derived media for guanxiongsun.github.io (Pillow only; never loaded by the site).

Run from the repository root:

    python3 tools/make_assets.py figure images/<key>.png   # one publication figure
    python3 tools/make_assets.py project                   # every project-page asset (spec §1.1)
    python3 tools/make_assets.py icons                     # favicon.svg, favicon.ico, apple-touch-icon.png
    python3 tools/make_assets.py og all                    # social cards (or: og home|mamba|stpn|nsa|vision|collaborate)
    python3 tools/make_assets.py all                       # project + icons + og all

Every command is idempotent: it rewrites its outputs from the sources, and the
same sources always give the same files.

Rules (from the design spec):
  * Every source is flattened onto white and converted to sRGB (several figures
    carry Display P3 or Adobe RGB profiles); metadata is stripped.
  * WebP is saved at quality 82, method 6.
  * Nothing is ever upscaled: a requested width larger than the source is
    written at the source width instead.

Neural Sign Actors sources
--------------------------
The NSA figures belong to the official project page and are NOT stored in this
repository (about 27 MB as published, and GitHub Pages would serve a copy of
them). The derived WebPs under assets/img/projects/nsa/ are committed, so you
only need the sources to re-crop. To regenerate:

    mkdir -p tools/sources/nsa
    for f in Teaser.png Method_SignLanguage.png MainFigure.png nsa_cvpr2024_poster.png; do
      curl -fL -o "tools/sources/nsa/$f" "https://raw.githubusercontent.com/baltatzisv/neural-sign-actors/main/static/images/$f"
    done
    python3 tools/make_assets.py project            # or: --nsa-dir /somewhere/else

Keep tools/sources/ out of git (add it to .gitignore). If the folder is missing,
`project` still builds the STPN assets and prints a warning for NSA.

Fonts for the OG cards are read from assets/fonts/*.woff2 (Pillow reads WOFF2
directly); pass --fonts-dir to use another folder.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageCms, ImageDraw, ImageFilter, ImageFont

# --------------------------------------------------------------------------
# Paths and constants
# --------------------------------------------------------------------------

REPO = Path(__file__).resolve().parent.parent
IMG = REPO / "assets" / "img"
PROJ = IMG / "projects"
OG_DIR = REPO / "assets" / "og"
DEFAULT_NSA_DIR = REPO / "tools" / "sources" / "nsa"
DEFAULT_FONTS_DIR = REPO / "assets" / "fonts"

WEBP_QUALITY = 82
WEBP_METHOD = 6
SRGB = ImageCms.createProfile("sRGB")

# Design tokens (light theme, spec §2.1) used by the icons and OG cards.
PAPER = "#FAF8F4"
INK = "#1A1814"
INK_2 = "#4A443B"
INK_3 = "#6B6458"
RULE = "#E3DDD2"
ACCENT = "#B23A17"
BADGE_PAPER = "#2A5EA8"
# Dark-theme values used only inside favicon.svg's media query.
INK_DARK = "#EEE9E0"
ACCENT_DARK = "#F0875A"

# Files that were skipped (missing optional sources); reported at the end.
SKIPPED: list[str] = []


# --------------------------------------------------------------------------
# Generic image helpers
# --------------------------------------------------------------------------

def rel(path: Path) -> str:
    """Repo-relative path for log lines."""
    try:
        return str(path.resolve().relative_to(REPO))
    except ValueError:
        return str(path)


def load_rgb(path: Path, frame: int = 0) -> Image.Image:
    """Open an image as opaque sRGB: flatten alpha on white, apply ICC, drop metadata."""
    Image.MAX_IMAGE_PIXELS = None  # MainFigure.png is 15723x11668
    im = Image.open(path)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(frame)
    icc = im.info.get("icc_profile")

    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
        white = Image.new("RGB", rgba.size, (255, 255, 255))
        white.paste(rgba, mask=rgba.getchannel("A"))
        im = white
    elif im.mode != "RGB":
        im = im.convert("RGB")

    if icc:
        src_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        im = ImageCms.profileToProfile(
            im, src_profile, SRGB,
            renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC, outputMode="RGB",
        )
    out = im.copy()
    out.info = {}
    return out


def fit_width(im: Image.Image, width: int) -> Image.Image:
    """Downscale to `width` (Lanczos). Never upscales: returns the image unchanged if narrower."""
    if width >= im.width:
        return im
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.LANCZOS, reducing_gap=3.0)


def save_webp(im: Image.Image, path: Path, quality: int = WEBP_QUALITY) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = im.copy()
    im.info = {}
    im.save(path, "WEBP", quality=quality, method=WEBP_METHOD)
    print(f"  {rel(path):58s} {im.width:>5}x{im.height:<5} {path.stat().st_size / 1024:7.1f} KB")


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = im.copy()
    im.info = {}
    im.save(path, "PNG", optimize=True)
    print(f"  {rel(path):58s} {im.width:>5}x{im.height:<5} {path.stat().st_size / 1024:7.1f} KB")


def pad_to_height(im: Image.Image, height: int) -> Image.Image:
    """Crop (from the bottom) or pad with white (at the bottom) to an exact height."""
    if im.height == height:
        return im
    if im.height > height:
        return im.crop((0, 0, im.width, height))
    out = Image.new("RGB", (im.width, height), (255, 255, 255))
    out.paste(im, (0, 0))
    return out


# --------------------------------------------------------------------------
# `figure`: one publication figure -> assets/img/<stem>{-640,-1280,}.webp
# --------------------------------------------------------------------------

def cmd_figure(path: Path, frame: int = 0, out_dir: Path = IMG) -> None:
    """Responsive WebPs for a publication figure (spec §13.5 recipe).

    Writes -640 and -1280 only when the source is wider than that, plus the
    full-width <stem>.webp, into assets/img/ (or `out_dir`). Animated GIFs use
    `frame` (default 0).
    """
    src = path if path.is_absolute() else (Path.cwd() / path)
    if not src.exists():
        src = REPO / path
    if not src.exists():
        sys.exit(f"figure: {path} does not exist")
    im = load_rgb(src, frame=frame)
    print(f"figure {rel(src)} ({im.width}x{im.height})")
    for w in (640, 1280):
        if w < im.width:
            save_webp(fit_width(im, w), out_dir / f"{src.stem}-{w}.webp")
    save_webp(im, out_dir / f"{src.stem}.webp")


# --------------------------------------------------------------------------
# `project`: STPN derived assets (source: images/stpn.png, 1936x934)
# --------------------------------------------------------------------------

# Crop boxes (left, top, right, bottom) in stpn.png pixels, measured on the
# image: panel borders were located by colour and the anti-aliased edge
# pixels excluded.
STPN_A = (0, 0, 1000, 934)          # panel "(a) Current pipeline"; its content ends at x~985
STPN_B = (1040, 0, 1936, 934)       # panel "(b) STPN"; its content starts at x~1075
# Inside the orange border of the motion-blurred "Current frame" in (b):
# border at x 1497-1499 / 1824-1826, y 548-550 / 751-753 -> clean 1501-1822 x 552-749.
STPN_CURRENT = (1502, 552, 1822, 750)   # 320x198 (8x5 patch grid -> 40x39.6 px tiles)
# Inside the black border of the front (sharp) support frame in (b):
# border at x 1085-1087 / 1286-1289, y 615-618 / 742-744.
STPN_SUPPORT = (1088, 620, 1286, 742)   # 198x122


def build_stpn() -> None:
    src = REPO / "images" / "stpn.png"
    im = load_rgb(src)
    out = PROJ / "stpn"
    print(f"stpn  <- {rel(src)} ({im.width}x{im.height})")
    a = im.crop(STPN_A)
    b = im.crop(STPN_B)
    save_webp(a, out / "stpn-a.webp")
    save_webp(fit_width(a, 640), out / "stpn-a-640.webp")
    save_webp(b, out / "stpn-b.webp")
    save_webp(fit_width(b, 640), out / "stpn-b-640.webp")
    save_webp(im.crop(STPN_CURRENT), out / "stpn-current.webp")
    save_webp(im.crop(STPN_SUPPORT), out / "stpn-support.webp")


# --------------------------------------------------------------------------
# `project`: Neural Sign Actors derived assets (official figures, see docstring)
# --------------------------------------------------------------------------

NSA_FILES = ("Teaser.png", "Method_SignLanguage.png", "MainFigure.png", "nsa_cvpr2024_poster.png")

# Teaser.png is 3789x1052. The speech bubble ends at y=135 and the green band
# starts at y=140, so this crop drops the bubble (the sentence is HTML on the
# page). The frame-stepper overlay uses this crop's coordinates:
# viewBox="0 0 3789 914".
TEASER_CROP = (0, 138, 3789, 1052)
# Talk poster: 16:9 around signer frame 4 + avatar 4, showing frames 3-5 whole.
# Left edge sits between avatar 2's hand (ends x=1197) and signer 3's hand
# (starts x=1212); the right edge keeps avatar 5 (ends x=2740) and stops before
# signer 6 (starts x=2827). 1600x900 -> downscaled to 1280x720.
TALK_POSTER_CROP = (1204, 140, 2804, 1040)

# MainFigure.png (15723x11668, palette mode) is first converted to RGB and
# downscaled to MAIN_WORK_WIDTH px wide (-> 4000x2968); all boxes below are in
# that working space. Measured on the image:
#  * GT bands are exact band edges (a soft drop shadow surrounds each band, and
#    each speech bubble's bottom border is ~8 px above it, at y 167-170 / 1637-1639);
#  * avatar rows are split inside the Stoll row's floor shadows, a few px above
#    the next row's heads (Stoll torsos end ~y 946-958 / ~2410; "Proposed"
#    heads start at y 966-969 / 2423-2430), so no avatar is cut;
#  * x < 0.03 (rotated row labels "Ground Truth", "Stoll et al.", "Proposed")
#    and both speech bubbles are excluded; the page rebuilds them in HTML.
# Sentence mapping (verified by reading the bubbles):
#   s1 top-left     "Another technique is you can braid the hair on first ..."
#   s2 top-right    "I really like that."
#   s3 bottom-left  "I think we've probably solved our problems."
#   s4 bottom-right "Now, the front squat develops your teardrop."
MAIN_WORK_WIDTH = 4000
CMP_X = {   # [left, right) of each block = its GT band (4 frames, ~470 px each)
    "s1": (127, 2003),
    "s2": (2101, 3984),
    "s3": (121, 2002),
    "s4": (2094, 3977),
}
CMP_Y = {   # [top, bottom) per half
    "top":    {"gt": (179, 444),   "stoll": (461, 962),   "ours": (962, 1500)},
    "bottom": {"gt": (1654, 1919), "stoll": (1937, 2418), "ours": (2418, 2964)},
}
CMP_HALF = {"s1": "top", "s2": "top", "s3": "bottom", "s4": "bottom"}
CMP_WIDTH = 1600
# Every strip of a row type gets the same pixel size, so switching sentences
# never changes the layout: GT strips are trimmed to the shortest (drops at most
# one bottom row); avatar strips are padded with white at the bottom (invisible
# on the white mat, and multiplied into the mat colour in dark mode).

# User study: the "User Study" box of the official poster (3000x1500) at its
# native resolution. The box border is at x 2485-2958, y 1156-1460 (title above).
USER_STUDY_CROP = (2474, 1124, 2970, 1470)   # 496x346, not upscaled


def open_main_figure(path: Path) -> Image.Image:
    im = load_rgb(path)
    return fit_width(im, MAIN_WORK_WIDTH)


def build_nsa(nsa_dir: Path) -> None:
    missing = [f for f in NSA_FILES if not (nsa_dir / f).exists()]
    if missing:
        msg = (f"nsa: sources missing in {nsa_dir} ({', '.join(missing)}); "
               "see the docstring for the download commands or pass --nsa-dir")
        print("WARNING " + msg)
        SKIPPED.append(msg)
        return
    out = PROJ / "nsa"

    # Teaser -> stepper image (bubble removed) + talk poster.
    teaser = load_rgb(nsa_dir / "Teaser.png")
    print(f"nsa   <- Teaser.png ({teaser.width}x{teaser.height})")
    band = teaser.crop(TEASER_CROP)
    save_webp(fit_width(band, 1200), out / "teaser-1200.webp")
    save_webp(fit_width(band, 2400), out / "teaser-2400.webp")
    poster = teaser.crop(TALK_POSTER_CROP).resize((1280, 720), Image.LANCZOS, reducing_gap=3.0)
    save_webp(poster, out / "talk-poster.webp")

    # Method figure (Adobe RGB source -> sRGB).
    method = load_rgb(nsa_dir / "Method_SignLanguage.png")
    print(f"nsa   <- Method_SignLanguage.png ({method.width}x{method.height})")
    save_webp(fit_width(method, 1200), out / "method-1200.webp")
    save_webp(fit_width(method, 2400), out / "method-2400.webp")

    # Qualitative comparison -> 12 strips of 4 frames each.
    main = open_main_figure(nsa_dir / "MainFigure.png")
    print(f"nsa   <- MainFigure.png (working copy {main.width}x{main.height})")
    strips: dict[tuple[str, str], Image.Image] = {}
    for s, (x0, x1) in CMP_X.items():
        for row, (y0, y1) in CMP_Y[CMP_HALF[s]].items():
            strips[(s, row)] = fit_width(main.crop((x0, y0, x1, y1)), CMP_WIDTH)
    for row in ("gt", "stoll", "ours"):
        heights = [strips[(s, row)].height for s in CMP_X]
        target = min(heights) if row == "gt" else max(heights)
        for s in CMP_X:
            save_webp(pad_to_height(strips[(s, row)], target), out / f"cmp-{s}-{row}.webp")

    # Poster (CVPR'24) + user-study panel.
    poster_im = load_rgb(nsa_dir / "nsa_cvpr2024_poster.png")
    print(f"nsa   <- nsa_cvpr2024_poster.png ({poster_im.width}x{poster_im.height})")
    save_webp(fit_width(poster_im, 1600), out / "poster-1600.webp")
    save_webp(fit_width(poster_im, 3000), out / "poster-3000.webp")
    save_webp(poster_im.crop(USER_STUDY_CROP), out / "user-study.webp")


def cmd_project(nsa_dir: Path) -> None:
    build_stpn()
    build_nsa(nsa_dir)


# --------------------------------------------------------------------------
# The memory-slot logomark (spec §4.1): 2x2 squares, three outlined in ink,
# the top-right one filled with the accent.
# --------------------------------------------------------------------------

def draw_slots(size: int, sq: float, gap: float, stroke: float, radius: float,
               ink: str, accent: str, bg: str | None = None, bg_radius: float = 0,
               ss: int = 8) -> Image.Image:
    """Render the logomark centred in a size x size RGBA tile.

    Geometry is in output pixels: `sq` is each square's OUTER size, the stroke
    is drawn inside it (so outer edges land on whole pixels), `gap` is the space
    between squares. Supersampled `ss` times and box-filtered down, so the
    anti-aliasing is exact coverage.
    """
    S = size * ss
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    if bg:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=bg_radius * ss, fill=bg)
    glyph = 2 * sq + gap
    o = (size - glyph) / 2
    for col in (0, 1):
        for row in (0, 1):
            x0 = (o + col * (sq + gap)) * ss
            y0 = (o + row * (sq + gap)) * ss
            box = (round(x0), round(y0), round(x0 + sq * ss) - 1, round(y0 + sq * ss) - 1)
            if (col, row) == (1, 0):   # top-right: filled accent
                d.rounded_rectangle(box, radius=radius * ss, fill=accent)
            else:
                d.rounded_rectangle(box, radius=radius * ss, outline=ink, width=round(stroke * ss))
    return tile.reduce(ss)


FAVICON_SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
  <!-- Memory-slot logomark: 2x2 squares of 6px (outer), 2px gap, 1px outer radius.
       The 1.25px stroke sits inside each square so the outer edges land on whole pixels.
       Generated by tools/make_assets.py (icons). -->
  <style>
    .slot {{ fill: none; stroke: {INK}; stroke-width: 1.25; }}
    .slot--on {{ fill: {ACCENT}; }}
    @media (prefers-color-scheme: dark) {{
      .slot {{ stroke: {INK_DARK}; }}
      .slot--on {{ fill: {ACCENT_DARK}; }}
    }}
  </style>
  <rect class="slot" x="1.625" y="1.625" width="4.75" height="4.75" rx="0.375"/>
  <rect class="slot--on" x="9" y="1" width="6" height="6" rx="1"/>
  <rect class="slot" x="1.625" y="9.625" width="4.75" height="4.75" rx="0.375"/>
  <rect class="slot" x="9.625" y="9.625" width="4.75" height="4.75" rx="0.375"/>
</svg>
"""


def cmd_icons() -> None:
    print("icons")
    svg_path = REPO / "favicon.svg"
    svg_path.write_text(FAVICON_SVG, encoding="utf-8")
    print(f"  {rel(svg_path):58s} {'16x16':<11} {svg_path.stat().st_size / 1024:7.1f} KB")

    # favicon.ico: 32 and 16 px, each drawn for its own pixel grid, on a paper
    # tile so the ink outlines stay visible on dark browser chrome (the .ico is
    # only a fallback; modern browsers use favicon.svg).
    ico32 = draw_slots(32, sq=10, gap=4, stroke=2, radius=2, ink=INK, accent=ACCENT,
                       bg=PAPER, bg_radius=6)
    ico16 = draw_slots(16, sq=5, gap=2, stroke=1, radius=1, ink=INK, accent=ACCENT,
                       bg=PAPER, bg_radius=3)
    ico_path = REPO / "favicon.ico"
    ico32.save(ico_path, format="ICO", sizes=[(32, 32), (16, 16)], append_images=[ico16])
    print(f"  {rel(ico_path):58s} {'32+16':<11} {ico_path.stat().st_size / 1024:7.1f} KB")

    # apple-touch-icon.png: 180 px, opaque paper background (iOS rounds the
    # corners itself), glyph ~98 px wide.
    apple = draw_slots(180, sq=42, gap=14, stroke=9, radius=7, ink=INK, accent=ACCENT, ss=4)
    flat = Image.new("RGB", apple.size, PAPER)
    flat.paste(apple, mask=apple.getchannel("A"))
    save_png(flat, REPO / "apple-touch-icon.png")


# --------------------------------------------------------------------------
# `og`: 1200x630 social cards
# --------------------------------------------------------------------------

FONT_FILES = {
    "serif": "newsreader-latin-opsz-normal.woff2",
    "serif-italic": "newsreader-latin-opsz-italic.woff2",
    "sans": "inter-latin-wght-normal.woff2",
    "mono": "jetbrains-mono-latin-wght-normal.woff2",
}


class Fonts:
    """Loads the site's variable WOFF2 fonts at a given size, weight and optical size."""

    def __init__(self, folder: Path):
        self.folder = folder
        missing = [f for f in FONT_FILES.values() if not (folder / f).exists()]
        if missing:
            sys.exit(f"og: fonts missing in {folder}: {', '.join(missing)} (pass --fonts-dir)")

    def get(self, kind: str, size: int, weight: int = 400) -> ImageFont.FreeTypeFont:
        f = ImageFont.truetype(str(self.folder / FONT_FILES[kind]), size)
        values = []
        for axis in f.get_variation_axes():
            name = axis["name"].decode() if isinstance(axis["name"], bytes) else str(axis["name"])
            if name.startswith("Weight"):
                v = weight
            elif name.startswith("Optical"):
                v = size          # like CSS font-optical-sizing: auto
            else:
                v = axis["default"]
            values.append(max(axis["minimum"], min(axis["maximum"], v)))
        f.set_variation_by_axes(values)
        return f


def text_tracked(d: ImageDraw.ImageDraw, xy: tuple[float, float], text: str,
                 font: ImageFont.FreeTypeFont, fill: str, tracking: float = 0.0) -> float:
    """Draw text on its baseline with extra letter-spacing (px). Returns the end x."""
    x, y = xy
    if not tracking:
        d.text((x, y), text, font=font, fill=fill, anchor="ls")
        return x + font.getlength(text)
    for i, ch in enumerate(text):
        # prefix length keeps the font's own kerning between earlier pairs
        cx = x + font.getlength(text[:i]) + i * tracking
        d.text((cx, y), ch, font=font, fill=fill, anchor="ls")
    return x + font.getlength(text) + len(text) * tracking


def wrap_runs(runs: list[tuple[str, ImageFont.FreeTypeFont, str]], max_width: float):
    """Greedy word wrap for mixed-font text. runs = [(text, font, colour)].

    Spaces may sit at the end of one run or the start of the next ("I build " +
    "memory"). Returns lines as lists of (word, font, colour, x_offset).
    """
    words, pending_space = [], False
    for text, font, colour in runs:
        for i, part in enumerate(text.split(" ")):
            if i > 0:
                pending_space = True
            if part:
                words.append((part, font, colour, pending_space))
                pending_space = False
    lines, line, x = [], [], 0.0
    for w, font, colour, space_before in words:
        space = font.getlength(" ") if (line and space_before) else 0.0
        width = font.getlength(w)
        if line and x + space + width > max_width:
            lines.append(line)
            line, x, space = [], 0.0, 0.0
        line.append((w, font, colour, x + space))
        x += space + width
    if line:
        lines.append(line)
    return lines


def ascent(font: ImageFont.FreeTypeFont, sample: str = "H") -> int:
    """Height above the baseline of `sample` (cap height by default)."""
    return -font.getbbox(sample, anchor="ls")[1]


def descent(font: ImageFont.FreeTypeFont) -> int:
    return font.getbbox("gjpqy", anchor="ls")[3]


class Column:
    """A left-column text block laid out on baselines, measured before it is drawn.

    add_* methods append lines below the previous one (`gap` = baseline-to-baseline
    distance); draw() renders the block with its first cap-height aligned to `top`.
    """

    def __init__(self, x: int, width: int):
        self.x, self.width = x, width
        self.ops = []            # callables (draw, dy)
        self.y = None            # current baseline (block coordinates)
        self.top = 0             # top of the first line's caps
        self.bottom = 0          # lowest descender so far

    def _advance(self, gap: float, font) -> float:
        if self.y is None:
            self.y = 0
            self.top = -ascent(font)
        else:
            self.y += gap
        self.bottom = self.y + descent(font)
        return self.y

    def add_tracked(self, gap, text, font, colour, tracking=0.0, dx=0):
        y = self._advance(gap, font)
        self.ops.append(lambda d, dy: text_tracked(d, (self.x + dx, y + dy), text, font, colour, tracking))

    def add_wrapped(self, gap, runs, line_height, tracking=0.0, dx=0, width=None):
        """Word-wrapped text. `tracking` is only meant for single-font text (headlines)."""

        def draw_tracked_line(d, dy, y, line):
            text = " ".join(w for w, *_ in line)
            text_tracked(d, (self.x + dx, y + dy), text, line[0][1], line[0][2], tracking)

        def draw_mixed_line(d, dy, y, line):
            for w, font, colour, ox in line:
                d.text((self.x + dx + ox, y + dy), w, font=font, fill=colour, anchor="ls")

        draw_line = draw_tracked_line if tracking else draw_mixed_line
        for i, line in enumerate(wrap_runs(runs, width or self.width)):
            y = self._advance(gap if i == 0 else line_height, line[0][1])
            self.ops.append(lambda d, dy, y=y, line=line: draw_line(d, dy, y, line))

    def add_rule(self, gap, width, colour):
        # a 2px rule whose top sits `gap` px below the previous baseline
        y = self.y + gap
        self.y = y
        self.bottom = y + 2
        self.ops.append(lambda d, dy: d.rectangle((self.x, y + dy, self.x + width - 1, y + dy + 1), fill=colour))

    @property
    def height(self) -> float:
        return self.bottom - self.top

    def draw(self, d: ImageDraw.ImageDraw, top: float) -> None:
        dy = round(top - self.top)
        for op in self.ops:
            op(d, dy)


def plate_geometry(fig: Image.Image, max_w: int, max_h: int, pad: int):
    """Scale a figure to fit a mat of at most max_w x max_h (never upscaled)."""
    scale = min((max_w - 2 * pad) / fig.width, (max_h - 2 * pad) / fig.height, 1.0)
    fw, fh = round(fig.width * scale), round(fig.height * scale)
    if (fw, fh) != fig.size:
        fig = fig.resize((fw, fh), Image.LANCZOS, reducing_gap=3.0)
    return fig, fw + 2 * pad, fh + 2 * pad


def paste_plate(card: Image.Image, fig: Image.Image, x0: int, y0: int, pad: int) -> tuple[int, int, int, int]:
    """Mount an already-scaled figure on a white mat at (x0, y0): 1px rule border + plate shadow."""
    mat = (x0, y0, x0 + fig.width + 2 * pad, y0 + fig.height + 2 * pad)
    # --shadow-plate: 0 1px 1px rgb(26 24 20/.04), 0 12px 32px -20px rgb(26 24 20/.28)
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    spread = 20
    sd.rectangle((mat[0] + spread, mat[1] + 12 + spread, mat[2] - spread, mat[3] + 12 - spread),
                 fill=(26, 24, 20, round(255 * 0.28)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    sd = ImageDraw.Draw(shadow)
    sd.rectangle((mat[0], mat[1] + 1, mat[2], mat[3] + 1), fill=(26, 24, 20, round(255 * 0.04)))
    base = card.convert("RGBA")
    base.alpha_composite(shadow)
    card.paste(base.convert("RGB"))

    d = ImageDraw.Draw(card)
    d.rectangle((mat[0], mat[1], mat[2] - 1, mat[3] - 1), fill="#FFFFFF", outline=RULE, width=1)
    card.paste(fig, (x0 + pad, y0 + pad))
    return mat


def draw_badge(d, fonts: Fonts, x: int, top: int, label: str, colour: str) -> None:
    """Outline badge (spec §7.2): mono uppercase, 1px border, 4px radius, 26px tall."""
    f = fonts.get("mono", 13, 500)
    tracking = 13 * 0.08
    w = f.getlength(label) + (len(label) - 1) * tracking
    d.rounded_rectangle((x, top, x + round(w) + 20, top + 26), radius=4, outline=colour, width=1)
    text_tracked(d, (x + 10, top + 18), label, f, colour, tracking)


def trim_white(im: Image.Image, margin: int = 16, threshold: int = 12) -> Image.Image:
    """Crop uniform white margins around a figure, keeping `margin` px of white."""
    diff = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255)))
    bbox = diff.convert("L").point(lambda v: 255 if v > threshold else 0).getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - margin), max(0, y0 - margin),
                    min(im.width, x1 + margin), min(im.height, y1 + margin)))


# Card copy. All strings come from the spec (§4.2, §4.4, §9); edit here.
# "credit" may contain "\n" for a deliberate line break.
OG_CARDS = {
    "home": {
        "kicker": "LECTURER · QUEEN’S UNIVERSITY BELFAST",
        "headline": "Guanxiong Sun",
        "title": "Computer vision & machine learning",
        # hero deck; the (text, italic-accent) pairs mark the <em>
        "deck": [("I build ", False), ("memory", True),
                 (" for machines that see, and next, for machines that act.", False)],
        "footer": "guanxiongsun.github.io",
        "figure": "portrait",
    },
    "mamba": {
        "kicker": "AAAI 2021 · VIDEO OBJECT DETECTION",
        "headline": "MAMBA",
        "title": "Multi-level Aggregation via Memory Bank for Video Object Detection",
        "footer": "guanxiongsun.github.io/projects/mamba/",
        "figure": "mamba",
        "plate": "Fig. 1",
    },
    "stpn": {
        "kicker": "ICCV 2023 · VIDEO UNDERSTANDING",
        "headline": "STPN",
        "title": "Spatio-temporal Prompting Network for Robust Video Feature Extraction",
        "footer": "guanxiongsun.github.io/projects/stpn/",
        "figure": "stpn",
        "plate": "Fig. 1",
    },
    "nsa": {
        "kicker": "CVPR 2024 · 3D HUMANS · SIGN LANGUAGE",
        "headline": "Neural Sign Actors",
        "title": "A diffusion model for 3D sign language production from text",
        "credit": "Led by V. Baltatzis and R. A. Potamias\nImperial College London",
        "footer": "guanxiongsun.github.io/projects/neural-sign-actors/",
        "figure": "nsa",
        "plate": "Fig. 1",
    },
    # Standalone pages moved out of the homepage (/vision/, /collaborate/).
    "vision": {
        "kicker": "VISION · QUEEN’S UNIVERSITY BELFAST",
        "headline": "Vision",
        "title": "Next: memory for machines that act.",
        "footer": "guanxiongsun.github.io/vision/",
        # MAMBA's memory bank: the idea the vision builds on (same still as the project card).
        "figure": "mamba",
        "plate": "MAMBA · AAAI 2021",
    },
    "collaborate": {
        "kicker": "COLLABORATE · QUEEN’S UNIVERSITY BELFAST",
        "headline": "Collaborate",
        "title": "Open problems. Let’s work on them together.",
        "footer": "guanxiongsun.github.io/collaborate/",
        "figure": "portrait",
    },
}


def og_figure(kind: str) -> tuple[Image.Image, int]:
    """The key figure for a card and its mat padding. Uses files committed in the repo."""
    if kind == "portrait":
        return load_rgb(REPO / "images" / "profile25.png"), 0
    if kind == "mamba":
        # frame 38 of the paper animation: the most complete state (same as mamba-still.webp)
        return trim_white(load_rgb(REPO / "images" / "mamba.gif", frame=38), 10), 22
    if kind == "stpn":
        return trim_white(load_rgb(REPO / "images" / "stpn.png").crop(STPN_B), 20), 22
    if kind == "nsa":
        # Two signer frames + avatars (3 and 4) from the committed stepper image;
        # the box is in Teaser.png pixels: it starts after avatar 2's hand (x 1197)
        # and stops before signer 5 (x 2305) and avatar 5 (x 2330).
        path = PROJ / "nsa" / "teaser-2400.webp"
        if not path.exists():
            sys.exit("og nsa: run `project` first (needs assets/img/projects/nsa/teaser-2400.webp)")
        im = load_rgb(path)
        s = im.width / (TEASER_CROP[2] - TEASER_CROP[0])
        x0, y0, x1, y1 = 1204, 140, 2290, 1040
        oy = TEASER_CROP[1]
        return im.crop((round(x0 * s), round((y0 - oy) * s), round(x1 * s), round((y1 - oy) * s))), 22
    raise ValueError(kind)


def build_og(slug: str, fonts: Fonts) -> None:
    """One 1200x630 card: text column on the left, the key figure on a mat on the right."""
    c = OG_CARDS[slug]
    W, H = 1200, 630
    M = 64                      # outer margin (top/bottom)
    L = 72                      # left edge of the text column
    COL_W = 500                 # text column width
    FOOT_RULE, FOOT_BASE = H - 94, H - 60
    is_home = slug == "home"
    is_portrait = c["figure"] == "portrait"
    card = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(card)

    # --- Right: plate header ("FIG. 1" + badge) and the figure on its mat,
    #     centred as one group in the right-hand zone.
    fig, pad = og_figure(c["figure"])
    zx0, zx1 = (756, W - 88) if is_portrait else (604, W - 60)
    header_h = 44 if c.get("plate") else 0
    fig, mw, mh = plate_geometry(fig, zx1 - zx0, H - 2 * 56 - header_h, pad)
    gx = zx0 + (zx1 - zx0 - mw) // 2
    gy = (H - (header_h + mh)) // 2
    mat = paste_plate(card, fig, gx, gy + header_h, pad)
    if c.get("plate"):
        fnum = fonts.get("mono", 13, 500)
        end = text_tracked(d, (mat[0], gy + 18), c["plate"].upper(), fnum, INK_3, 13 * 0.08)
        draw_badge(d, fonts, round(end + 14), gy, "FROM THE PAPER", BADGE_PAPER)

    # --- Top-left wordmark on project cards (on home the name is the headline).
    if not is_home:
        mark = draw_slots(24, sq=9, gap=3, stroke=1.75, radius=1.5, ink=INK, accent=ACCENT)
        card.paste(mark, (L - 2, M - 3), mark)
        text_tracked(d, (L + 32, M + 16), "Guanxiong Sun", fonts.get("serif", 24, 500), INK)

    # --- Left text column, measured first, then centred vertically.
    col = Column(L, COL_W)
    col.add_tracked(0, c["kicker"], fonts.get("mono", 16, 500), INK_3, 16 * 0.08)
    head = fonts.get("serif", 64, 400)            # Newsreader 64px, display weight
    col.add_wrapped(78, [(c["headline"], head, INK)], 64, tracking=-64 * 0.022, dx=-3)
    sans = fonts.get("sans", 28, 400)             # page title: Inter 28px
    col.add_wrapped(52, [(c["title"], sans, INK_2)], 36)
    if c.get("deck"):
        col.add_rule(34, 48, ACCENT)              # hero accent rule, 48x2
        deck = fonts.get("serif", 31, 400)
        deck_i = fonts.get("serif-italic", 31, 400)
        runs = [(t, deck_i if em else deck, ACCENT if em else INK_2) for t, em in c["deck"]]
        col.add_wrapped(66, runs, 41, width=560)
    if c.get("credit"):                           # lead authors are always named
        credit = fonts.get("sans", 19, 400)
        for i, line in enumerate(c["credit"].split("\n")):
            col.add_tracked(44 if i == 0 else 27, line, credit, INK_3)
    space_top = M + 40 if not is_home else M
    space_bot = FOOT_RULE - 24
    col.draw(d, space_top + (space_bot - space_top - col.height) / 2)

    # --- Footer: hairline + URL (home adds the logomark before the URL).
    d.line((L, FOOT_RULE, L + COL_W, FOOT_RULE), fill=RULE, width=1)
    fx = L
    if is_home:
        mark = draw_slots(20, sq=7.5, gap=2.5, stroke=1.5, radius=1.25, ink=INK, accent=ACCENT)
        card.paste(mark, (L - 1, FOOT_BASE - 16), mark)
        fx = L + 30
    text_tracked(d, (fx, FOOT_BASE), c["footer"], fonts.get("mono", 16, 400), INK_3)

    save_png(card, OG_DIR / f"{slug}.png")


def cmd_og(which: str, fonts_dir: Path) -> None:
    slugs = list(OG_CARDS) if which == "all" else [which]
    for s in slugs:
        if s not in OG_CARDS:
            sys.exit(f"og: unknown card '{s}' (choose from {', '.join(OG_CARDS)} or all)")
    fonts = Fonts(fonts_dir)
    print("og")
    for s in slugs:
        build_og(s, fonts)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__.split("\n\n")[0],
        epilog="Download commands for the NSA sources are in this file's docstring.",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--nsa-dir", type=Path, default=DEFAULT_NSA_DIR,
                   help="folder with the official NSA figures (default: tools/sources/nsa)")
    p.add_argument("--fonts-dir", type=Path, default=DEFAULT_FONTS_DIR,
                   help="folder with the site's WOFF2 fonts (default: assets/fonts)")
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("figure", help="responsive WebPs for one publication figure")
    f.add_argument("path", type=Path)
    f.add_argument("--frame", type=int, default=0, help="frame to use for animated GIFs")
    f.add_argument("--out", type=Path, default=IMG, help="output folder (default: assets/img)")
    sub.add_parser("project", help="every derived project-page asset (spec §1.1)")
    sub.add_parser("icons", help="favicon.svg, favicon.ico, apple-touch-icon.png")
    o = sub.add_parser("og", help="1200x630 social cards")
    o.add_argument("slug", choices=[*OG_CARDS, "all"])
    sub.add_parser("all", help="project + icons + og all")
    args = p.parse_args(argv)

    if args.cmd == "figure":
        cmd_figure(args.path, args.frame, args.out)
    elif args.cmd == "project":
        cmd_project(args.nsa_dir)
    elif args.cmd == "icons":
        cmd_icons()
    elif args.cmd == "og":
        cmd_og(args.slug, args.fonts_dir)
    elif args.cmd == "all":
        cmd_project(args.nsa_dir)
        cmd_icons()
        cmd_og("all", args.fonts_dir)

    if SKIPPED:
        print("\nSkipped:\n  " + "\n  ".join(SKIPPED))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

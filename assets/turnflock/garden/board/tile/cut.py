"""Cut the grass tile out of one of the owner's pictures into one texture atlas.

Run from the repo root:  python3 assets/turnflock/garden/board/tile/cut.py [preview.png]
Writes grass-tile.webp next to this file (and a full-size PNG preview to the path given, if any).

The source is 02-tile-grass with its fine fur strokes lifted (the owner's 2026-11-25 wish: visible
grass texture). 26-tile-grass-fur, sent with that wish, is kept below as a choice (second argument):
it is small and soft (607 px, JPEG), so even enlarged and sharpened its top reads flat at game size. Each picture shows the tile
from the front, tilted 26 to 36 degrees from straight down. The atlas holds two pieces, both
"unprojected" back to their true shape:
  rows 0..TOP-1        the top seen straight from above, with its fuzzy edge on a transparent ground
  rows TOP+PAD..end    the fur of the front side, as a strip that repeats sideways without a seam
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent / 'grass-tile.webp'

TOP = 512          # top texture, square
SIDE_H = 112       # side strip height
PAD = 16           # rows between the two, against mipmap bleed
# Measured on each picture (pixels): the paper colour; the tile's left and right fur tips; its back
# fur tips; where the top's front shoulder turns into the side; the side's foot on the shadow; the
# front fringe hidden by the side; the straight middle of the side; how green a pixel must be.
SOURCES = {
    '02-tile-grass.png': dict(bg=(254, 249, 246), left=120, right=1130, back=115, shoulder=1003, foot=1094,
                              fringe=22, side=(330, 930), blend=90, green=(12, 92), blue=None, detail=(5, 2.0),
                              top_mean=(178, 228, 13), side_mean=(87, 150, 1)),
    '26-tile-grass-fur.jpg': dict(bg=(253, 253, 253), left=62, right=550, back=50, shoulder=444, foot=532,
                                  fringe=12, side=(150, 460), blend=60, green=(5, 30), blue=(250, 170),
                                  upscale=2, sharpen=(2.0, 120), detail=(6, 1.6),
                                  top_mean=(170, 213, 67), side_mean=(55, 105, 27)),
}
# The look of 25/26-tile-grass-fur, measured on 26: the mean colour of its top and of its side.
STYLE = dict(top=(170, 213, 67), side=(55, 105, 27), tip=(222, 240, 110), tipLight=0.45, fineKeep=0.5,
             strokes=2600, length=(0.018, 0.04), width=(0.002, 0.0045), lean=62, lightShare=0.55,
             bladeLight=(205, 236, 105), bladeDark=(128, 178, 40), alpha=(0.25, 0.55), seed=26,
             tufts=240, tuftReach=1.5, corner=0.17, tuftRoot=(160, 205, 58), tuftMid=(192, 226, 82))
NAME = sys.argv[2] if len(sys.argv) > 2 else '02-tile-grass.png'
P = SOURCES[NAME]
SRC = ROOT / 'design/reference/turnflock/garden' / NAME
BG = np.array(P['bg'], dtype=np.float64)
K = P.get('upscale', 1)
LEFT, RIGHT, BACK, SHOULDER, FOOT = (K * P[k] for k in ('left', 'right', 'back', 'shoulder', 'foot'))
MARGIN = 4 * K         # transparent margin round the fur tips in the top texture, in picture pixels


def source() -> Image.Image:
    """The picture, enlarged and sharpened when it is small (26 is 607 px wide), so the grass's fine
    strokes survive the resampling to the atlas."""
    im = Image.open(SRC).convert('RGB')
    k = P.get('upscale', 1)
    if k > 1:
        im = im.resize((im.width * k, im.height * k), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=P['sharpen'][0], percent=P['sharpen'][1], threshold=1))
    if 'detail' not in P:
        return im
    # The grass's fine strokes are faint at game size: lift the small detail (the picture less a
    # blurred copy of itself) so the strokes still read at 40 to 65 px per tile.
    radius, amount = P['detail']
    a = np.asarray(im).astype(np.float64)
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float64)
    return Image.fromarray(np.clip(a + amount * (a - blur), 0, 255).astype(np.uint8))


def cutout(rgb: np.ndarray) -> np.ndarray:
    """RGBA with alpha from how green a pixel is, and the paper white taken back out of the edge colours."""
    green = rgb[..., 1] - rgb[..., 2]
    lo, span = P['green'][0], P['green'][1] - P['green'][0]
    a = np.clip((green - lo) / span, 0, 1)
    a = a * a * (3 - 2 * a)
    if P['blue']:
        # On a white ground the blue channel tells coverage better: the grass has little blue.
        top, reach = P['blue']
        a = np.minimum(a, np.clip((top - rgb[..., 2]) / reach, 0, 1))
    safe = np.maximum(a, 1e-3)[..., None]
    col = np.clip((rgb - (1 - a[..., None]) * BG) / safe, 0, 255)
    col = np.where(a[..., None] > 0.02, col, rgb)
    return np.dstack([col, a * 255])


def sample_rows(img: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Rows of `img` at fractional heights `ys`, linearly interpolated."""
    y0 = np.clip(np.floor(ys).astype(int), 0, img.shape[0] - 1)
    y1 = np.clip(y0 + 1, 0, img.shape[0] - 1)
    t = (ys - y0)[:, None, None]
    return img[y0] * (1 - t) + img[y1] * t


def resize(rgba: np.ndarray, w: int, h: int) -> np.ndarray:
    """Resize with premultiplied alpha, so transparent pixels do not darken the edge."""
    im = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA').convert('RGBa')
    return np.asarray(im.resize((w, h), Image.LANCZOS).convert('RGBA')).astype(np.float64)


def bleed(rgba: np.ndarray) -> np.ndarray:
    """Give transparent pixels the colour of the nearest visible ones, so filtering adds no dark rim."""
    out = rgba.copy()
    known = out[..., 3] > 8
    im = Image.fromarray(np.clip(out[..., :3], 0, 255).astype(np.uint8))
    for _ in range(24):
        grown = np.asarray(im.filter(ImageFilter.MaxFilter(3))).astype(np.float64)
        mask = np.asarray(Image.fromarray((known * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
        fill = mask & ~known
        cur = np.asarray(im).astype(np.float64)
        cur[fill] = grown[fill]
        # Use the average of known neighbours rather than the max, to keep the tone.
        blur = np.asarray(Image.fromarray(cur.astype(np.uint8)).filter(ImageFilter.BoxBlur(1))).astype(np.float64)
        cur[fill] = blur[fill]
        im = Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8))
        known = mask
    out[..., :3] = np.asarray(im).astype(np.float64)
    return out


def blur(img: np.ndarray, radius: float) -> np.ndarray:
    """Near-gaussian blur of a float image (any number of channels): three box blurs, edges clamped."""
    out = img.astype(np.float64)
    r = max(1, int(round(radius / 1.7)))
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode='edge'), axis=axis)
            hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
            out = (hi - lo) / (2 * r + 1)
    return out


def strokes(size: int, base: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Grass strokes painted in code, as an RGBA layer: short, thin, lighter and darker blades, most
    leaning the same way, as on 25/26-tile-grass-fur. Their size is set by the game, not the picture:
    a tile is 40 to 65 px on a phone, so a stroke must be about a fortieth of the tile to be seen."""
    from PIL import ImageDraw
    k = 2  # drawn at twice the size, then reduced: smooth edges
    layer = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
    g = ImageDraw.Draw(layer)
    rng = np.random.default_rng(STYLE['seed'])
    n = STYLE['strokes']
    for _ in range(n):
        x, y = rng.uniform(0, size, 2)
        if mask[int(y), int(x)] < 0.5:
            continue
        length = size * rng.uniform(*STYLE['length'])
        width = size * rng.uniform(*STYLE['width'])
        angle = np.radians(STYLE['lean'] + rng.normal(0, 22))
        light = rng.random() < STYLE['lightShare']
        tone = np.array(STYLE['bladeLight'] if light else STYLE['bladeDark'])
        alpha = rng.uniform(*STYLE['alpha'])
        # A blade: wide at the root, a point at the tip, curving a little.
        bend = rng.normal(0, 0.25)
        pts = []
        for t in np.linspace(0, 1, 6):
            ax = angle + bend * t
            pts.append((x + np.cos(ax) * length * t, y - np.sin(ax) * length * t))
        for i in range(len(pts) - 1):
            w = width * (1 - i / (len(pts) - 1)) + 0.5
            g.line([(pts[i][0] * k, pts[i][1] * k), (pts[i + 1][0] * k, pts[i + 1][1] * k)],
                   fill=tuple(int(c) for c in tone) + (int(alpha * 255),), width=max(1, int(round(w * k))))
    return np.asarray(layer.resize((size, size), Image.LANCZOS)).astype(np.float64)


def tufts(size: int, half: float, radius: float, reach: float) -> np.ndarray:
    """The ragged edge of 25/26 painted in code, as an RGBA layer: little bunches of grass blades
    round the rounded-square outline (`half` from the centre to the fur roots, corners `radius`),
    leaning outward, dark at the root and pale yellow at the tip, up to `reach` long."""
    from PIL import ImageDraw
    k = 2
    layer = Image.new('RGBA', (size * k, size * k), (0, 0, 0, 0))
    g = ImageDraw.Draw(layer)
    rng = np.random.default_rng(STYLE['seed'] + 1)
    c = size / 2
    straight = 2 * (half - radius)
    perim = 4 * straight + 2 * np.pi * radius
    count = STYLE['tufts']
    root, mid, tip = (np.array(STYLE[n]) for n in ('tuftRoot', 'tuftMid', 'tip'))

    def at(d: float) -> tuple[float, float, float, float]:
        """Point and outward normal at distance d round the outline, starting top middle, clockwise."""
        d %= perim
        side_len = straight + np.pi * radius / 2
        q, r = divmod(d, side_len)
        # Each quarter: half a straight side, a corner, half the next straight side, rotated.
        if r < straight / 2:
            x, y, nx, ny = r, -half, 0.0, -1.0
        elif r < straight / 2 + np.pi * radius / 2:
            t = (r - straight / 2) / radius
            ang = -np.pi / 2 + t
            x, y = half - radius + np.cos(ang) * radius, -(half - radius) + np.sin(ang) * radius
            nx, ny = np.cos(ang), np.sin(ang)
        else:
            x, y, nx, ny = half, -(half - radius) + (r - straight / 2 - np.pi * radius / 2), 1.0, 0.0
        for _ in range(int(q)):
            x, y, nx, ny = -y, x, -ny, nx
        return x, y, nx, ny

    blades = []
    for i in range(count):
        x, y, nx, ny = at(perim * (i + rng.uniform(0, 0.6)) / count)
        for _ in range(rng.integers(3, 6)):
            spread = np.radians(rng.normal(0, 28))
            dx, dy = nx * np.cos(spread) - ny * np.sin(spread), nx * np.sin(spread) + ny * np.cos(spread)
            length = reach * rng.uniform(0.55, 1.0)
            # The root sits a little inside the edge, so the tuft grows out of the lawn.
            back = reach * rng.uniform(0.4, 0.9)
            bx, by = c + x - nx * back + rng.normal(0, reach * 0.12), c + y - ny * back + rng.normal(0, reach * 0.12)
            width = reach * rng.uniform(0.3, 0.45)
            blades.append((bx, by, dx, dy, length + back, width))
    # Draw roots first, then tips over them, so every tuft shows its light tips.
    for stage, tone in ((0, root), (1, mid), (2, tip)):
        for bx, by, dx, dy, length, width in blades:
            t0, t1 = (0.0, 0.55, 0.8)[stage], (0.6, 0.85, 1.0)[stage]
            w0, w1 = width * (1 - t0), width * (1 - t1) + 0.4
            px, py = -dy, dx
            a0, a1 = (bx + dx * length * t0, by + dy * length * t0), (bx + dx * length * t1, by + dy * length * t1)
            poly = [(a0[0] + px * w0 / 2, a0[1] + py * w0 / 2), (a1[0] + px * w1 / 2, a1[1] + py * w1 / 2),
                    (a1[0] - px * w1 / 2, a1[1] - py * w1 / 2), (a0[0] - px * w0 / 2, a0[1] - py * w0 / 2)]
            g.polygon([(u * k, v * k) for u, v in poly], fill=tuple(int(v) for v in tone) + (255,))
    return np.asarray(layer.resize((size, size), Image.LANCZOS)).astype(np.float64)


def restyle_top(top: np.ndarray) -> np.ndarray:
    """Make the top look like 25/26-tile-grass-fur (owner, 2026-11-25): their calmer yellow-green,
    no clover pattern or mottling, visible grass strokes, and light yellow tips on the ragged edge.
    The broad light of the picture (a 60 px blur) stays; its clovers and mottling go; grass strokes
    are painted over it in code; the fur edge keeps its own blades, lit toward yellow."""
    if not STYLE:
        return top
    a = top[..., 3:4] / 255
    col = top[..., :3]
    low = blur(col * a, 60) / np.maximum(blur(a, 60), 1e-3)
    fine = col - blur(col, 4)
    calm = low + STYLE['fineKeep'] * fine
    inner = np.clip((blur((a > 0.99).astype(np.float64), 24) - 0.6) / 0.4, 0, 1)
    out = col * (1 - inner) + calm * inner
    out = out + (np.array(STYLE['top']) - np.array(P['top_mean']))
    # Strokes over the inside.
    layer = strokes(out.shape[0], out, inner[..., 0])
    la = layer[..., 3:4] / 255
    out = out * (1 - la) + layer[..., :3] * la
    # The edge: the fur round the top lit toward a pale yellow, as the tufts on 26.
    edge = (1 - inner) * a
    out = out * (1 - edge * STYLE['tipLight']) + np.array(STYLE['tip']) * edge * STYLE['tipLight']
    # Tufts round the edge, over the picture's own fur, in colour and in outline.
    size = out.shape[0]
    fringe = P['fringe'] * K
    half = size / 2 - MARGIN - fringe * 1.6
    ring = tufts(size, half, size * STYLE['corner'], fringe * STYLE['tuftReach'])
    ta = ring[..., 3:4] / 255
    out = out * (1 - ta) + ring[..., :3] * ta
    alpha = 255 * (1 - (1 - a) * (1 - ta))
    return np.dstack([np.clip(out, 0, 255), alpha[..., 0]])


def top_texture(rgba: np.ndarray) -> np.ndarray:
    width = RIGHT - LEFT
    span = width + 2 * MARGIN
    # The top's depth on the picture is foreshortened: from the back tips to the shoulder is the
    # tile less its front fringe. Stretch it back to a square.
    fringe = P['fringe'] * K
    stretch = (width - fringe) / (SHOULDER - BACK)
    rows = np.arange(span, dtype=np.float64)
    ys = BACK + (rows - MARGIN) / stretch
    cols = rgba[:, LEFT - MARGIN:RIGHT + MARGIN]
    top = sample_rows(cols, ys)
    # The front edge is hidden by the side on the picture: give it the back edge's fringe, mirrored,
    # cross-faded over a band so the seam does not show.
    mirror = top[::-1]
    band0, band1 = span - MARGIN - fringe - 0.07 * width, span - MARGIN - fringe - 0.01 * width
    t = np.clip((rows - band0) / (band1 - band0), 0, 1)[:, None, None]
    out = top * (1 - t) + mirror * t
    # The outline is the back half's, mirrored: on the picture the front half's outline also takes in
    # the side's fur, which is not part of the top.
    lower = rows[:, None] >= span / 2
    out[..., 3] = np.where(lower, np.minimum(top[..., 3], mirror[..., 3]) * (1 - t[..., 0]) + mirror[..., 3] * t[..., 0], top[..., 3])
    return resize(restyle_top(out), TOP, TOP)


def side_strip(rgba: np.ndarray) -> np.ndarray:
    # The straight middle of the front side, between the rounded corners.
    x0, x1 = (K * x for x in P['side'])
    band = rgba[SHOULDER + 2 * K:FOOT + 3 * K, x0:x1].copy()
    # Repeat without a seam: cross-fade the last columns into the first.
    blend = P['blend'] * K
    w = band.shape[1] - blend
    t = (np.arange(blend) / blend)[None, :, None]
    head = band[:, :blend] * t + band[:, w:] * (1 - t)
    strip = np.concatenate([head, band[:, blend:w]], axis=1)
    # Top of the strip fully opaque (it meets the top's overhang), the foot keeps its ragged fur.
    strip[:8] = strip[8]
    strip[:, :, 3][:10] = 255
    if STYLE:
        # The side in 26 is a deep, slightly olive green: scale toward it.
        gain = np.array(STYLE['side']) / np.maximum(np.array(P['side_mean']), 1)
        shift = np.where(np.array(P['side_mean']) < 10, np.array(STYLE['side']), 0)
        strip[..., :3] = np.clip(strip[..., :3] * np.minimum(gain, 1.5) + shift, 0, 255)
    return resize(strip, TOP, SIDE_H)


def main() -> None:
    rgb = np.asarray(source()).astype(np.float64)
    rgba = cutout(rgb)
    atlas = np.zeros((TOP + PAD + SIDE_H, TOP, 4))
    atlas[:TOP] = bleed(top_texture(rgba))
    side = bleed(side_strip(rgba))
    atlas[TOP + PAD:] = side
    # The padding rows take the strip's top row, so mipmaps of the strip do not pull in transparency.
    atlas[TOP:TOP + PAD] = side[0]
    img = Image.fromarray(np.clip(atlas, 0, 255).astype(np.uint8), 'RGBA')
    img.save(OUT, 'WEBP', quality=82, alpha_quality=90, method=6)
    if len(sys.argv) > 1:
        img.save(sys.argv[1])
    tips = (RIGHT - LEFT) / (RIGHT - LEFT + 2 * MARGIN)
    print(f'{OUT.name} from {NAME}: {img.size[0]}x{img.size[1]}, {OUT.stat().st_size / 1024:.1f} kB, fur tips {tips:.3f} of the top (image.tips)')


if __name__ == '__main__':
    main()

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
                              fringe=22, side=(330, 930), blend=90, green=(12, 92), blue=None, detail=(5, 2.0)),
    '26-tile-grass-fur.jpg': dict(bg=(253, 253, 253), left=62, right=550, back=50, shoulder=444, foot=532,
                                  fringe=12, side=(150, 460), blend=60, green=(5, 30), blue=(250, 170),
                                  upscale=2, sharpen=(2.0, 120), detail=(6, 1.6)),
}
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
    return resize(out, TOP, TOP)


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

"""Redraw the garden cloud puff, and one ball of it, crisp at high resolution.

Writes assets/turnflock/garden/effects/
       cloud.webp       the whole cloud puff, 448x480 (8x the sheet crop box (119, 6, 175, 66))
       cloud-ball.webp  one ball of it (the front bottom one), 192x192 (8x the box (133, 38, 157, 62))

The owner's effects sheet (design/reference/turnflock/garden/21-sheet-effects.png)
holds the cloud only about 56 px wide, so enlarging it stays soft. This script
paints the cloud again as vector shapes: eight shaded balls and the small curl
at the upper left, each a circle with a radial ramp from a white highlight near
its top to lavender blue underneath and a thin outline that is pale on top and
darker grey-blue underneath, plus the soft grey shadow the sheet shows below the
cloud. The circles, colours and shadow in PARAMS were fitted to the sheet: the
picture, scaled back down to the sheet's size and laid on white, matches the
sheet crop pixel for pixel to within a few levels (see the compare sheet in
production/qa/evidence/garden-effects/hd-cloud-compare.png).

The framing is the same as the old 4x cuts made by cut-garden-effects.py, so the
game's config needs no change. The body is fully opaque with an anti-aliased
edge; the shadow is dark grey with partial alpha, so on the lawn it reads as a
shadow, never as a pale rim. Set SHADOW = False to leave it out. The ball is
the ball alone (no neighbours, no shadow).

Run from the repo root:  python3 tools/asset-pipeline/garden-effects-hd/cloud.py
          (add --compare to also write the evidence sheet)
Needs Pillow and numpy (tools only; the game has no new dependency). Re-runnable.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

SRC = 'design/reference/turnflock/garden/21-sheet-effects.png'
OUT = 'assets/turnflock/garden/effects/'
EVIDENCE = 'production/qa/evidence/garden-effects/hd-cloud-compare.png'
SCALE = 8           # output pixels per sheet pixel
SS = 2              # extra supersampling when painting the output
SHADOW = True
CLOUD_BOX = (119, 6, 175, 66)   # sheet crop boxes (left, top, right, bottom), as in cut-garden-effects.py
BALL_BOX = (133, 38, 157, 62)
FRONT = 'front'                 # the ball copied as cloud-ball

# Fitted to the sheet. Circles in sheet pixels relative to CLOUD_BOX's top-left: (cx, cy, r),
# painted back to front. Colours are RGB 0..255.
PARAMS = {
    'balls': {
        'curl':   (11.6, 16.6, 3.6),
        'left':   (14.3, 31.0, 10.4),
        'right':  (41.6, 23.6, 10.4),
        'top':    (27.3, 16.4, 11.0),
        'middle': (29.3, 28.3, 5.9),
        'hidden': (32.8, 32.0, 4.5),
        'botr':   (40.2, 39.7, 8.6),
        'front':  (26.2, 43.6, 9.9),
    },
    # Highlight point, in ball radii from the centre.
    'hl': (0.05, -0.7),
    # Body ramp: (distance from highlight in radii, colour).
    'ramp': [(0.0, (254, 254, 254)), (0.35, (250, 250, 252)), (0.75, (222, 226, 242)),
             (1.15, (180, 195, 234)), (1.55, (146, 170, 228))],
    # Outline: width in sheet px, pale (top) and dark (bottom) colours and strengths,
    # mix = clip(a + b * normal_y).
    'rim_w': 0.9, 'rim_pale': (205, 212, 236), 'rim_dark': (128, 142, 180),
    'rim_s_pale': 0.5, 'rim_s_dark': 1.0, 'rim_a': 0.45, 'rim_b': 0.8,
    # Thin outline: width (sheet px), pale and dark colours and strengths, same mix.
    'line_w': 0.6, 'line_pale': (200, 206, 230), 'line_dark': (120, 132, 170),
    'line_s_pale': 0.4, 'line_s_dark': 0.9,
    # Shadow: offset (sheet px), blur sigma (sheet px), colour, opacity.
    'sh_dx': -0.6, 'sh_dy': 2.4, 'sh_sigma': 1.6, 'sh_col': (95, 100, 118), 'sh_op': 0.75,
}


def ramp(d: np.ndarray, stops) -> np.ndarray:
    """Piecewise linear colour along `d` through (position, colour) stops; clamps at the ends."""
    xs = np.array([s[0] for s in stops], float)
    cs = np.array([s[1] for s in stops], float)
    return np.stack([np.interp(d, xs, cs[:, k]) for k in range(3)], -1)


def box_blur(a: np.ndarray, radius: int, axis: int) -> np.ndarray:
    """Mean over 2*radius+1 samples along `axis` (edges padded with zero)."""
    if radius < 1:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (radius + 1, radius)
    c = np.cumsum(np.pad(a, pad), axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * radius + 1, 2 * radius + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * radius + 1)


def gauss(a: np.ndarray, sigma_px: float) -> np.ndarray:
    """Approximate Gaussian blur: three box blurs per axis."""
    r = int(round(np.sqrt(12 * sigma_px ** 2 / 3 + 1) / 2 - 0.5)) if sigma_px > 0.3 else 0
    for axis in (0, 1):
        for _ in range(3):
            a = box_blur(a, r, axis)
    return a


def paint(p: dict, w: float, h: float, ppu: float, names=None, shadow=True, origin=(0.0, 0.0)):
    """Paint the cloud (or the balls in `names`) into a (h*ppu, w*ppu) grid.

    w, h: area size in sheet px; ppu: pixels per sheet px; origin: area's top-left in
    cloud-crop coordinates. Returns (premultiplied RGB float 0..255, alpha 0..1).
    """
    H, W = int(round(h * ppu)), int(round(w * ppu))
    ys = (np.arange(H) + 0.5) / ppu + origin[1]
    xs = (np.arange(W) + 0.5) / ppu + origin[0]
    X, Y = np.meshgrid(xs, ys)
    pre = np.zeros((H, W, 3))
    alpha = np.zeros((H, W))
    px = 1.0 / ppu
    hx, hy = p['hl']
    pale, dark = np.array(p['rim_pale'], float), np.array(p['rim_dark'], float)
    lpale, ldark = np.array(p['line_pale'], float), np.array(p['line_dark'], float)
    for name, (cx, cy, r) in p['balls'].items():
        if names is not None and name not in names:
            continue
        dx, dy = X - cx, Y - cy
        dist = np.hypot(dx, dy)
        cov = np.clip((r - dist) / px + 0.5, 0, 1)
        if not cov.any():
            continue
        col = ramp(np.hypot(dx / r - hx, dy / r - hy), p['ramp'])
        t = np.clip(1 - (r - dist) / p['rim_w'], 0, 1) ** 2
        m = np.clip(p['rim_a'] + p['rim_b'] * dy / np.maximum(dist, 1e-6), 0, 1)
        rim_col = pale + (dark - pale) * m[..., None]
        s = (p['rim_s_pale'] + (p['rim_s_dark'] - p['rim_s_pale']) * m) * t
        col = col + (rim_col - col) * s[..., None]
        # The thin drawn outline: a crisp band line_w wide just inside the edge.
        lt = np.clip((p['line_w'] - (r - dist)) / 0.3, 0, 1)
        line_col = lpale + (ldark - lpale) * m[..., None]
        ls = (p['line_s_pale'] + (p['line_s_dark'] - p['line_s_pale']) * m) * lt
        col = col + (line_col - col) * np.clip(ls, 0, 1)[..., None]
        pre = col * cov[..., None] + pre * (1 - cov[..., None])
        alpha = cov + alpha * (1 - cov)
    if shadow:
        sh = gauss(alpha, p['sh_sigma'] * ppu)
        sx, sy = int(round(p['sh_dx'] * ppu)), int(round(p['sh_dy'] * ppu))
        sh = np.roll(np.roll(sh, sy, 0), sx, 1)
        if sy > 0:
            sh[:sy] = 0
        if sx < 0:
            sh[:, sx:] = 0
        sa = np.clip(sh * p['sh_op'], 0, 1)
        pre = pre + np.array(p['sh_col'], float) * (sa * (1 - alpha))[..., None]
        alpha = alpha + sa * (1 - alpha)
    return pre, alpha


def downsample(a: np.ndarray, f: int) -> np.ndarray:
    """Box-average by an integer factor."""
    h, w = a.shape[0] // f, a.shape[1] // f
    return a[:h * f, :w * f].reshape(h, f, w, f, *a.shape[2:]).mean(axis=(1, 3))


def to_image(pre: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """Premultiplied float to straight-alpha RGBA."""
    a = np.maximum(alpha, 1e-6)[..., None]
    rgb = np.clip(pre / a, 0, 255)
    rgb = np.where(alpha[..., None] > 1 / 512, rgb, 0)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), 'RGBA')


def make(p: dict = PARAMS):
    """Return (cloud, ball) RGBA images at SCALE."""
    cw, ch = CLOUD_BOX[2] - CLOUD_BOX[0], CLOUD_BOX[3] - CLOUD_BOX[1]
    pre, a = paint(p, cw, ch, SCALE * SS, shadow=SHADOW)
    cloud = to_image(downsample(pre, SS), downsample(a, SS))
    bw, bh = BALL_BOX[2] - BALL_BOX[0], BALL_BOX[3] - BALL_BOX[1]
    origin = (BALL_BOX[0] - CLOUD_BOX[0], BALL_BOX[1] - CLOUD_BOX[1])
    pre, a = paint(p, bw, bh, SCALE * SS, names={FRONT}, shadow=False, origin=origin)
    ball = to_image(downsample(pre, SS), downsample(a, SS))
    return cloud, ball


def save(img: Image.Image, path: str, quality: int) -> float:
    img.save(path, 'WEBP', quality=quality, alpha_quality=90, method=6)
    return os.path.getsize(path) / 1024


def over(img: Image.Image, colour) -> Image.Image:
    bg = Image.new('RGBA', img.size, colour + (255,))
    return Image.alpha_composite(bg, img).convert('RGB')


def compare(cloud: Image.Image, ball: Image.Image) -> None:
    """Evidence sheet: original 8x (smooth) | new on white | new on lawn | new scaled down next to original."""
    sheet = Image.open(SRC).convert('RGB')
    oc, ob = sheet.crop(CLOUD_BOX), sheet.crop(BALL_BOX)
    rows = []
    for orig, new in ((oc, cloud), (ob, ball)):
        big = orig.resize(new.size, Image.BICUBIC)
        small = over(new, (255, 255, 255)).resize(orig.size, Image.BOX)
        pair = Image.new('RGB', (orig.width * 2 + 2, orig.height), 'white')
        pair.paste(orig, (0, 0))
        pair.paste(small, (orig.width + 2, 0))
        pair = pair.resize((pair.width * 4, pair.height * 4), Image.NEAREST)
        rows.append([big, over(new, (255, 255, 255)), over(new, (139, 203, 79)), pair])
    gap, label_h = 12, 18
    width = gap + sum(max(r[i].width for r in rows) + gap for i in range(4))
    height = label_h + sum(max(im.height for im in r) + gap for r in rows) + gap
    out = Image.new('RGB', (width, height), (226, 226, 226))
    d = ImageDraw.Draw(out)
    titles = ['1 original 8x (smooth)', '2 new on white', '3 new on #8BCB4F',
              '4 sheet size, 4x nearest: original | new']
    x = gap
    colx = []
    for i in range(4):
        colx.append(x)
        d.text((x, 4), titles[i], fill=(0, 0, 0))
        x += max(r[i].width for r in rows) + gap
    y = label_h
    for r in rows:
        for i, im in enumerate(r):
            out.paste(im, (colx[i], y))
        y += max(im.height for im in r) + gap
    os.makedirs(os.path.dirname(EVIDENCE), exist_ok=True)
    out.save(EVIDENCE)
    print(f'{EVIDENCE}: {out.width}x{out.height}')


def main() -> None:
    cloud, ball = make()
    os.makedirs(OUT, exist_ok=True)
    for img, name, q in ((cloud, 'cloud', 88), (ball, 'cloud-ball', 88)):
        path = os.path.join(OUT, name + '.webp')
        kb = save(img, path, q)
        print(f'{path}: {img.width}x{img.height}, {kb:.1f} kB')
    if '--compare' in sys.argv:
        compare(cloud, ball)


if __name__ == '__main__':
    main()

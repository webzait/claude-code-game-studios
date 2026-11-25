"""Paint the garden theme's blue energy ring at high resolution.

Makes  production/qa/evidence/garden-effects/redraw-8x/ring.webp  (528x544, WebP with alpha)

A redraw, not an enlargement, of the blue ring on the owner's effects sheet
(design/reference/turnflock/garden/21-sheet-effects.png, crop box left 176,
top 4, right 242, bottom 72). The framing is that crop at 8x, so the game's
config for the old cut keeps working.

The ring is painted analytically with numpy, in the crop's own pixel units
(SHEET coordinates below are crop pixels, 66x68), sampled at 8x:
  - halo: soft blue light outside the ring's outer ellipse (semi-transparent);
  - body: the torus, opaque, shaded deep blue on the inner wall seen above the
    hole and brighter blue / cyan on the top surface;
  - hole: deep blue light fading to about 25% alpha in the middle, so the
    board shows through as blue light, not as a pale patch;
  - streaks: thin white swirl lines with a cyan glow, each an elliptical arc
    (centre, radii, angle range, slight spiral drift) with tapered ends,
    placed to follow the streaks on the sheet.

Edges are anti-aliased from analytic distances; colours are composited as
premultiplied RGBA, so over white it matches the sheet and over the lawn the
glow reads as light.

Run from the repo root:  python3 tools/asset-pipeline/garden-effects-hd/ring.py
Needs Pillow and numpy (tools only). Re-runnable; overwrites the output.
"""
import os

import numpy as np
from PIL import Image

OUT = 'production/qa/evidence/garden-effects/redraw-8x/ring.webp'
SCALE = 8
W0, H0 = 66, 68                      # the sheet crop, in sheet pixels
QUALITY = 78
CORE_GAIN = 1.05                      # streak core width multiplier
GLOW_GAIN = 2.4                      # streak glow width multiplier

# Ellipses in crop pixels: (centre x, centre y, half width, half height).
OUTER = (31.7, 33.35, 26.2, 23.8)    # outer silhouette of the torus
HOLE = (31.85, 32.1, 11.9, 7.4)      # where the hole's light begins
RIM = (31.2, 25.4, 18.2, 14.2)       # inner rim: above it the far inner wall shows

DEEP = np.array([0, 112, 206.])      # inner wall, hole
DEEP_HI = np.array([0, 140, 232.])   # inner wall near the top rim
BLUE = np.array([0, 160, 246.])      # top surface
CYAN = np.array([20, 212, 253.])     # sheen and streak glow
WHITE = np.array([215, 254, 255.])   # streak cores
GLOW = np.array([90, 232, 255.])     # light round the streaks
HALO = np.array([0, 140, 240.])

# Streaks: centre x, centre y, rx, ry, start angle, end angle (degrees, 0 = right,
# 90 = down; drawn from start to end, either direction), core width, glow width,
# core strength (0..1), spiral drift (radius grows by this fraction from start to end).
STREAKS = [
    # outer right sweep: top, down the right side
    (31.0, 31.6, 24.4, 22.6, 252, 400, 1.25, 2.6, 1.0, 0.00),
    # long left-and-bottom streak, upper left round the bottom to the right
    (31.2, 32.0, 22.4, 21.6, 236, 22, 1.5, 3.0, 1.0, 0.02),
    # outer left companion
    (31.2, 32.2, 24.3, 22.9, 228, 108, 1.3, 2.6, 1.0, 0.00),
    # lower inner arc above the near side
    (31.0, 30.0, 18.4, 15.6, 168, 52, 1.45, 3.0, 1.0, -0.02),
    # short highlight on the hole's near rim
    (31.8, 31.2, 12.6, 10.4, 108, 40, 1.0, 2.2, 0.8, 0.00),
    # inner rim's top edge, cyan with a white start on the left
    (31.0, 27.6, 17.6, 11.0, 155, 383, 0.8, 2.4, 0.55, 0.00),
    # cyan highlight inside the right sweep, upper right
    (30.2, 31.0, 20.2, 21.2, 283, 342, 0.7, 2.2, 0.35, 0.00),
    # lower right swirl crossing the right side
    (30.0, 30.6, 21.0, 16.8, 60, -5, 1.0, 2.4, 0.9, 0.05),
    # bottom-left inner swirl
    (31.4, 31.0, 20.6, 19.0, 160, 115, 0.9, 2.2, 0.8, 0.00),
    # down the left inner wall into the hole's near rim
    (31.5, 30.5, 17.0, 10.0, 215, 118, 1.2, 2.6, 1.0, 0.00),
    # middle of the near side, mostly cyan
    (31.0, 31.0, 21.0, 17.2, 150, 60, 0.9, 2.8, 0.6, 0.00),
    # right inner wall, faint
    (31.5, 30.5, 16.0, 10.0, -45, 40, 0.7, 2.4, 0.3, 0.00),
]


def grid():
    """Sample positions (crop pixels) of the output pixel centres."""
    ys, xs = np.mgrid[0:H0 * SCALE, 0:W0 * SCALE].astype(np.float64)
    return (xs + 0.5) / SCALE, (ys + 0.5) / SCALE


def ell(x, y, e):
    """Normalised radius, signed distance in crop pixels (approximate) and angle for ellipse e."""
    cx, cy, rx, ry = e
    dx, dy = x - cx, y - cy
    r = np.hypot(dx / rx, dy / ry)
    g = np.hypot(dx / rx ** 2, dy / ry ** 2) / np.maximum(r, 1e-6)
    d = (r - 1) / np.maximum(g, 1e-6)
    th = np.degrees(np.arctan2(dy / ry, dx / rx)) % 360
    return r, d, th


def cover(d, px=1.0 / SCALE):
    """Anti-aliased coverage of the inside (d < 0) of an edge, one output pixel wide."""
    return np.clip(0.5 - d / px, 0, 1)


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def over(dst, col, alpha):
    """Composite a straight-colour layer over a premultiplied RGBA buffer."""
    a = alpha[..., None]
    dst[..., :3] = col * a + dst[..., :3] * (1 - a)
    dst[..., 3:] = a + dst[..., 3:] * (1 - a)


def paint() -> np.ndarray:
    x, y = grid()
    buf = np.zeros(x.shape + (4,))

    # Halo: light outside the outer ellipse, falling off over about 9 px.
    ro, do, tho = ell(x, y, OUTER)
    halo = np.clip(1.1 * np.exp(-np.maximum(do, 0) / 3.4), 0, 1)
    over(buf, HALO, halo * (do > -1.5))

    # Body base colour.
    rr, drim, thr = ell(x, y, RIM)
    rh, dh, thh = ell(x, y, HOLE)
    inner_wall = smooth(0.6, -0.6, drim)                   # inside the rim ellipse
    # inner wall: lighter near the top rim, deepest just above the hole
    wall_t = smooth(RIM[1] - RIM[3] + 1, HOLE[1] - 2, y)
    wall = DEEP_HI[None, None] * (1 - wall_t[..., None]) + DEEP[None, None] * wall_t[..., None]
    # the wall's sides catch more light
    side = smooth(0.35, 0.9, np.abs(x - RIM[0]) / RIM[2])
    wall = wall * (1 - side[..., None] * 0.6) + BLUE * (side[..., None] * 0.6)
    # top surface: blue, cyan sheen on the near (lower) side
    lower_left = np.clip(np.cos(np.radians(tho - 125)), 0, 1)
    sheen = smooth(-0.3, 0.7, lower_left) * smooth(0.5, 0.75, ro) * smooth(1.0, 0.9, ro) * 0.85
    top = BLUE[None, None] * (1 - sheen[..., None]) + CYAN[None, None] * sheen[..., None]
    # darker blue at the very outside of the silhouette
    edge_dark = smooth(-2.5, 0, do)[..., None] * 0.35
    top = top * (1 - edge_dark) + np.array([0, 150, 240.]) * edge_dark
    base = top * (1 - inner_wall[..., None]) + wall * inner_wall[..., None]
    # the hole: deep blue light, about 25% in the middle
    hole_in = smooth(1.05, 0.35, rh)
    col = base * (1 - hole_in[..., None]) + DEEP * hole_in[..., None]
    body_a = cover(do, 1.5) * (1 - 0.75 * hole_in)
    over(buf, col, body_a)

    # Streaks.
    glow_layer = np.zeros(x.shape)
    core_layer = np.zeros(x.shape)
    for cx, cy, rx, ry, a0, a1, wcore, wglow, strength, drift in STREAKS:
        dx, dy = x - cx, y - cy
        th = np.degrees(np.arctan2(dy / ry, dx / rx))
        span = a1 - a0
        t = ((th - a0) * np.sign(span)) % 360 / abs(span)
        inside = t <= 1
        t = np.clip(t, 0, 1)
        k = 1 + drift * (t - 0.5)
        _, d, _ = ell(x, y, (cx, cy, rx * k, ry * k))
        taper = np.sin(np.pi * t) ** 0.45 * inside
        wc = wcore * CORE_GAIN * taper
        core = np.clip((wc / 2 - np.abs(d)) * SCALE / 2 + 0.5, 0, 1) * np.clip(wc * SCALE, 0, 1) * strength
        glow = np.exp(-(d / (wglow * GLOW_GAIN * 0.5)) ** 2) * taper
        core_layer = np.maximum(core_layer, core)
        glow_layer = np.maximum(glow_layer, glow)
    body_mask = cover(do + 0.5, 1.5) * (1 - hole_in)
    over(buf, GLOW, glow_layer * body_mask)
    over(buf, WHITE, core_layer * body_mask)

    a = buf[..., 3]
    rgb = np.where(a[..., None] > 1e-4, buf[..., :3] / np.maximum(a, 1e-4)[..., None], 0)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).round().astype(np.uint8)


def main() -> None:
    rgba = paint()
    img = Image.fromarray(rgba, 'RGBA')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, 'WEBP', quality=QUALITY, alpha_quality=80, method=6)
    print(f'{OUT}: {img.width}x{img.height}, {os.path.getsize(OUT) / 1024:.1f} kB')


if __name__ == '__main__':
    main()

"""Cut the glow rim out of the owner's 12-sheet-tile-highlight and measure its profile.

The picture has no transparency: the glow sits on white, and its bright line is as white as
the background. So the cut-out cannot key white away; it works along the tile outline instead:
a rounded rectangle fitted to the line (FIT below, in source pixels). For every pixel, d is its
distance to that outline (negative inside). Then:
  outside the line: the halo over white, alpha from the blue channel against the halo yellow;
  on the line: opaque, its own colour;
  inside the line: the yellow fading into the green top, alpha from the red channel against
  the green of the top, so the rim can lie on any tile.
Writes glow-rim.webp (square, the tile outline mapped onto body = 0.9 cell, reach REACH cells
round it) and prints the profile (colour and alpha against d, in cells) that highlight.json holds.
Run from the repo root: python3 -I assets/turnflock/garden/board/highlight/cutout.py .
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
src = root / 'design/reference/turnflock/garden/12-sheet-tile-highlight.png'
out = Path(__file__).with_name('glow-rim.webp')

# Line centre: left 10.5, right 99, top 15, bottom 98.5 px; corner radius from the diagonal.
FIT = dict(cx=54.75, cy=56.75, hx=44.25, hy=41.75, r=23.0)
BODY = 0.9          # tile body in cells (data/themes/garden/tile.json)
REACH = 0.16        # cells of glow kept round the body
HALF_LINE = 2.2     # source px
HALO = np.array([236, 236, 40.0])
INNER = np.array([240, 246, 20.0])
TOP_R = 132.0       # red of the green top, inside the inner glow
OUT_PX = 176        # twice the largest phone size: a 65 px tile spans 1.2/0.9 x 65 = 87 px with its glow


def sdf(x, y):
    f = FIT
    qx = np.abs(x - f['cx']) - (f['hx'] - f['r'])
    qy = np.abs(y - f['cy']) - (f['hy'] - f['r'])
    ox, oy = np.maximum(qx, 0), np.maximum(qy, 0)
    return np.hypot(ox, oy) + np.minimum(np.maximum(qx, qy), 0) - f['r']


a = np.asarray(Image.open(src).convert('RGB')).astype(float)
h, w, _ = a.shape
ys, xs = np.mgrid[0:h, 0:w] + 0.5
d = sdf(xs, ys)
rgb = np.empty_like(a)
alpha = np.zeros((h, w))
out_m = d > HALF_LINE
line_m = np.abs(d) <= HALF_LINE
in_m = d < -HALF_LINE
alpha[out_m] = np.clip((255 - a[..., 2][out_m]) / (255 - HALO[2]), 0, 1)
rgb[out_m] = HALO
alpha[line_m] = 1
rgb[line_m] = a[line_m]
# The green under the inner glow is not even (darker at the top, lighter lower down), so the
# inner glow is measured against the green a little further in along the outline's normal.
eps = 0.5
nx = (sdf(xs + eps, ys) - sdf(xs - eps, ys)) / (2 * eps)
ny = (sdf(xs, ys + eps) - sdf(xs, ys - eps)) / (2 * eps)
depth = 15 + d  # how far further in the reference green lies
bx = np.clip(np.round(xs - 0.5 - nx * depth).astype(int), 0, w - 1)
by = np.clip(np.round(ys - 0.5 - ny * depth).astype(int), 0, h - 1)
base_r = a[by, bx, 0]
alpha[in_m] = np.clip((a[..., 0] - base_r)[in_m] / np.maximum(INNER[0] - base_r, 1)[in_m], 0, 1)
rgb[in_m] = INNER
alpha[d < -12] = 0
# Where the line is a little wider than the fit, and where it blends into the halo, it is opaque
# in the picture (cream into yellow): keep its own colour there, not a gap.
wide = (np.abs(d) < 4.5) & ((a.min(2) > 235) | ((d > 0) & (a[..., 2] > 60)))
alpha[wide] = 1
rgb[wide] = a[wide]
# Soften the hard switch at the line's edges by one pixel.
alpha[np.abs(np.abs(d) - HALF_LINE) < 0.5] = np.maximum(alpha[np.abs(np.abs(d) - HALF_LINE) < 0.5], 0.85)

# Profile: mean colour and alpha per band of d, in cells (88.5 px = BODY).
px_per_cell = (FIT['hx'] + FIT['hy']) / BODY
profile = []
for lo in np.arange(-12, 13, 1.0):
    m = (d >= lo) & (d < lo + 1) & (xs > 2) & (xs < 106)
    if not m.any():
        continue
    c = rgb[m].mean(0)
    profile.append([round((lo + 0.5) / px_per_cell, 3), *[int(round(v)) for v in c], round(float(alpha[m].mean()), 2)])
print(json.dumps(profile))

# Square texture: tile units u, v in [-span/2, span/2]. Every quadrant is taken from the picture's
# top-right quadrant, mirrored: that one is whole (the halo runs off the picture on the left, and
# the line is wider at the bottom), so the rim comes out even all round. Sampled 4x finer, then
# scaled down, so the edge is smooth.
FINE = OUT_PX * 4
span = BODY + 2 * REACH
uu = ((np.arange(FINE) + 0.5) / FINE - 0.5) * span
U, V = np.meshgrid(uu, uu)
sx = FIT['cx'] + np.abs(U) / (BODY / 2) * FIT['hx'] - 0.5
sy = FIT['cy'] - np.abs(V) / (BODY / 2) * FIT['hy'] - 0.5
rgba = np.dstack([rgb, alpha * 255])


def sample(img, x, y):
    x0 = np.clip(np.floor(x).astype(int), 0, img.shape[1] - 2)
    y0 = np.clip(np.floor(y).astype(int), 0, img.shape[0] - 2)
    fx = np.clip(x - x0, 0, 1)[..., None]
    fy = np.clip(y - y0, 0, 1)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy)
            + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)


tex = sample(rgba, sx, sy)
tex[sdf(sx + 0.5, sy + 0.5) > 11.5, 3] = 0
# Premultiply for the downscale, so no dark or white fringe creeps in where alpha is low.
pm = tex.copy()
pm[..., :3] *= pm[..., 3:4] / 255
big = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), 'RGBA')
small = np.asarray(big.resize((OUT_PX, OUT_PX), Image.LANCZOS)).astype(float)
a_ = small[..., 3:4]
small[..., :3] = np.where(a_ > 0, small[..., :3] * 255 / np.maximum(a_, 1), 0)
Image.fromarray(np.clip(small, 0, 255).astype(np.uint8), 'RGBA').save(out, 'WEBP', quality=90, alpha_quality=100, method=6)
print('wrote', out, out.stat().st_size, 'bytes')

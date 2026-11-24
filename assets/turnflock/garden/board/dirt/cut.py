"""Cut the dirt tile out of the owner's picture 13-sheet-tile-dirt into one texture atlas.

Run from the repo root:  python3 assets/turnflock/garden/board/dirt/cut.py
Writes dirt-tile.webp next to this script. Not part of the game build (nothing imports it).

The source is 105 x 105 px on white, drawn from about the game's own angle: the tile's top
(the soil floor in its frame of clay blocks) above a thin band of its front wall. The atlas is
  rows   0..255  the top, stretched to a square (it is foreshortened in the picture; the game's
                 tilted camera foreshortens it again), transparent outside the rounded corners;
  rows 256..271  padding, so mipmaps of the top and the band do not bleed into each other;
  rows 272..319  the front wall, each source row stretched to the full tile width (so the
                 rounded corners, which the picture shows end-on, unroll onto the wall).
Colours at the white edge are un-blended from white and bled outward, so no white halo shows.
"""
import json
import pathlib
import numpy as np
from PIL import Image, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SRC = ROOT / 'design/reference/turnflock/garden/13-sheet-tile-dirt.png'
DATA = json.loads((ROOT / 'data/themes/garden/dirt.json').read_text())['picture']

W = DATA['atlas']['width']          # 256
TOP = DATA['atlas']['top']          # 256 rows
PAD = DATA['atlas']['pad']          # 16 rows
BAND = DATA['atlas']['band']        # 48 rows
SS = 4                              # supersampling of the corner mask

src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
H0, W0, _ = src.shape

# 1. Which pixels are tile. The tile is all warm clay, soil and grass (saturated colour); the paper
# is white and the soft drop shadow round the tile is grey, both nearly colourless. So colour
# saturation, not brightness, tells tile from background: this keeps the grey shadow out too.
sat = src.max(axis=2) - src.min(axis=2)
alpha = np.clip((sat - 10.0) / 40.0, 0, 1)
clean = src

# 2. Bleed tile colours outward over the paper and the shadow, so resampling never mixes them in.
known = sat > 34
# The outermost pixel of the tile is half paper (pale, but still coloured): drop it too, and
# let the bleed refill it from just inside.
inner = known.copy()
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        inner &= np.roll(np.roll(known, dy, 0), dx, 1)
known = inner
col = np.where(known[..., None], clean, 0)
for _ in range(12):
    acc = np.zeros_like(col)
    cnt = np.zeros(known.shape)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            acc += np.roll(np.roll(col * known[..., None], dy, 0), dx, 1)
            cnt += np.roll(np.roll(known, dy, 0), dx, 1)
    grow = (~known) & (cnt > 0)
    col[grow] = acc[grow] / cnt[grow][:, None]
    known = known | grow

def edge(profile, start, step):
    """Sub-pixel position where `profile` first rises through 0.5, walking from `start` by `step`."""
    i = start
    while profile[i] < 0.5:
        i += step
    p0, p1 = profile[i - step], profile[i]
    return (i - step) + step * (0.5 - p0) / (p1 - p0)

# 3. Where the tile is in the picture: its sides at mid height, its far edge at mid width.
mid_rows = alpha[30:70]
left = np.mean([edge(r, 0, 1) for r in mid_rows])
right = np.mean([edge(r, W0 - 1, -1) for r in mid_rows]) + 1
top = np.mean([edge(alpha[:, c], 0, 1) for c in range(35, 70)])
front = DATA['source']['frontEdge']   # the row where the frame's near top edge meets the front wall
foot = np.mean([edge(alpha[:, c], H0 - 1, -1) for c in range(35, 70)]) + 1
# The near foot sits in a soft shadow: take the darkest-to-paper step instead, from the profile.
foot = DATA['source']['foot']
print(f'tile in picture: x {left:.2f}..{right:.2f}, top {top:.2f}, front edge {front}, foot {foot}')

img = Image.fromarray(col.astype(np.uint8))

def crop_scale(box, size):
    # PIL's transform with EXTENT takes a float box: resample the region with Lanczos via a 4x detour.
    big = img.resize((W0 * 4, H0 * 4), Image.LANCZOS)
    b = tuple(int(round(v * 4)) for v in box)
    return big.crop(b).resize(size, Image.LANCZOS)

# 4. The top, stretched to a square.
top_img = crop_scale((left, top, right, front), (W, TOP))
top_img = top_img.filter(ImageFilter.UnsharpMask(radius=DATA['sharpen']['radius'], percent=DATA['sharpen']['percent'], threshold=1))
# Transparent outside the rounded corners: the same corner radius the 3D tile has.
r = DATA['corner'] * W * SS
yy, xx = np.mgrid[0:W * SS, 0:TOP * SS] + 0.5
cx = np.clip(xx, r, W * SS - r)
cy = np.clip(yy, r, TOP * SS - r)
inside = ((xx - cx) ** 2 + (yy - cy) ** 2 <= r * r).astype(np.float64)
mask = inside.reshape(TOP, SS, W, SS).mean(axis=(1, 3))
top_rgba = np.dstack([np.asarray(top_img), (mask * 255).round()]).astype(np.uint8)

# 5. The front wall: each source row from the tile's left to right edge, stretched to full width.
rows = []
for y in np.arange(front, foot, 0.25):
    yi = int(y)
    a_row = alpha[min(yi, H0 - 1)]
    l = edge(a_row, 0, 1) if a_row.max() > 0.5 else left
    rr = edge(a_row, W0 - 1, -1) + 1 if a_row.max() > 0.5 else right
    xs = np.linspace(l + 0.5, rr - 0.5, W * 2)
    line = np.array([[np.interp(xs, np.arange(W0), col[min(yi, H0 - 1), :, k]) for k in range(3)]]).transpose(0, 2, 1)
    rows.append(line[0])
band = Image.fromarray(np.array(rows).clip(0, 255).astype(np.uint8)).resize((W, BAND), Image.LANCZOS)
band_rgba = np.dstack([np.asarray(band), np.full((BAND, W), 255)]).astype(np.uint8)

# 6. The atlas, with padding rows copied from the neighbouring edge rows.
pad_top = np.repeat(np.dstack([np.asarray(top_img)[-1:], np.full((1, W), 0)]).astype(np.uint8), PAD // 2, axis=0)
pad_band = np.repeat(band_rgba[:1], PAD - PAD // 2, axis=0)
atlas = np.concatenate([top_rgba, pad_top, pad_band, band_rgba], axis=0)
out = HERE / 'dirt-tile.webp'
Image.fromarray(atlas, 'RGBA').save(out, 'WEBP', quality=DATA['quality'], method=6, exact=True, alpha_quality=100)
print(f'{out.relative_to(ROOT)}: {atlas.shape[1]} x {atlas.shape[0]} px, {out.stat().st_size / 1024:.1f} kB')

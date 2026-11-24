"""Rebuild the garden green beam at 8x, crisp, with a transparent background.

Reads  design/reference/turnflock/garden/21-sheet-effects.png (the owner's 242x76 sheet)
Writes production/qa/evidence/garden-effects/redraw-8x/beam.webp   (512x552, WebP with alpha)
       production/qa/evidence/garden-effects/hd-beam-compare.png  (side-by-side check)

What it makes: the beam piece of the sheet (crop box left 0, top 3, right 64,
bottom 72 in sheet pixels, the same framing as cut-garden-effects.py) drawn at
8x: the white ring with its green band under it, the lime pad inside the ring,
the column of light with its upright streaks and the soft glow round it all.

How: the picture is split into parts with crisp, hand-measured outlines
(three ellipses for ring, pad and band; vertical band edges for the streaks of
the column). Every part takes its colours from the owner's pixels that lie
fully inside that part, spread smoothly inside the part only (normalized
convolution). So shapes are sharp at 8x, and colours, proportions and glow
are the owner's own; the downscaled result matches the sheet crop closely.
The column is smoothed more along the streaks than across them.

Transparency: ring, pad and band are opaque. The column and glow are made
"light": each pixel gets a colour and alpha that give exactly the sheet's
colour over white, with alpha LIGHT_ALPHA times the least possible
(colour-to-alpha), so over the lawn they tint it instead of painting a pale
patch.

Run from the repo root:  python3 tools/asset-pipeline/garden-effects-hd/beam.py
Needs Pillow and numpy (tools only). Re-runnable; overwrites its outputs.
"""
import os

import numpy as np
from PIL import Image, ImageDraw

SRC = 'design/reference/turnflock/garden/21-sheet-effects.png'
OUT = 'production/qa/evidence/garden-effects/redraw-8x/beam.webp'
EVIDENCE = 'production/qa/evidence/garden-effects/hd-beam-compare.png'
BOX = (0, 3, 64, 72)       # sheet crop, same as cut-garden-effects.py
S = 8                      # enlargement
QUALITY = 80               # WebP quality (colour); alpha is stored lossless
LIGHT_ALPHA = 1.8          # alpha of the light, as a multiple of the least alpha that reproduces it over white
COLUMN_FLOOR = 0.6         # least alpha inside the middle streak (its core is almost white)
LAWN = (0x8B, 0xCB, 0x4F)

# Ellipses in crop pixels (sheet y minus 3): centre x, centre y, half width, half height.
# Fitted so the result, boxed down to 64x69, matches the sheet crop best.
RING = (31.5, 46.9, 24.75, 9.8)     # outer edge of the white ring
PAD = (32.05, 46.25, 22.2, 7.5)      # the lime pad inside the ring
BAND = (31.65, 50.15, 25.5, 9.7)    # outer edge of the green band under the ring

BAND_SOFT = 0.9                    # crop px over which the band's outer edge fades
RING_WHITE = (0.98, 0.995, 0.93)   # ring colour where the sheet has no clean ring pixel

# The column: vertical edges between streaks, in crop pixels, left to right.
COLUMN = (11.5, 52.5)              # outer extent, blends into the glow over COLUMN_SOFT
COLUMN_SOFT = 1.0
STREAK_EDGES = (13.0, 14.0, 16.0, 17.0, 20.0, 22.0, 27.25, 31.0, 32.0, 35.1, 41.0, 42.0, 48.0, 50.0)
SPIRE = (31.5, 27.25, 35.1, 17.0, 2.5, 0.45)   # centre x, left, right, full width below y, tip y, tip half width
SIGMA = 0.5                        # smoothing inside a part, crop pixels
SIGMA_STREAK = (0.42, 0.75)        # across, along the streaks


def load_crop() -> np.ndarray:
    """The sheet crop as float RGB, 0..1, shape (69, 64, 3)."""
    return np.asarray(Image.open(SRC).convert('RGB').crop(BOX), np.float32) / 255.0


def ellipse_distance(e, x, y):
    """Approximate signed distance (crop px) from an ellipse edge, negative inside."""
    cx, cy, a, b = e
    u, v = (x - cx) / a, (y - cy) / b
    f = u * u + v * v - 1.0
    g = 2.0 * np.sqrt((u / a) ** 2 + (v / b) ** 2) + 1e-6
    return f / g


def inside(d, px):
    """Antialiased coverage from a signed distance `d` in crop px, edge one output px wide."""
    return np.clip(0.5 - d * px, 0.0, 1.0)


def gauss_blur(a: np.ndarray, sx: float, sy: float) -> np.ndarray:
    """Separable Gaussian blur, zero outside (callers normalize)."""
    def k(s):
        r = max(1, int(3 * s + 0.5))
        t = np.arange(-r, r + 1, dtype=np.float32)
        w = np.exp(-0.5 * (t / s) ** 2)
        return w / w.sum(), r
    out = a
    for axis, s in ((1, sx), (0, sy)):
        w, r = k(s)
        pad = [(0, 0)] * out.ndim
        pad[axis] = (r, r)
        p = np.pad(out, pad)
        acc = np.zeros_like(out)
        n = out.shape[axis]
        for i, wi in enumerate(w):
            sl = [slice(None)] * out.ndim
            sl[axis] = slice(i, i + n)
            acc += wi * p[tuple(sl)]
        out = acc
    return out


def upsample(a: np.ndarray, scale: int) -> np.ndarray:
    """Linear interpolation between crop-pixel centres, edges held."""
    for axis in (0, 1):
        n = a.shape[axis]
        t = (np.arange(n * scale, dtype=np.float32) + 0.5) / scale - 0.5
        t = np.clip(t, 0, n - 1)
        i0 = np.floor(t).astype(int)
        i1 = np.minimum(i0 + 1, n - 1)
        f = (t - i0).reshape([-1 if k == axis else 1 for k in range(a.ndim)])
        a = np.take(a, i0, axis) * (1 - f) + np.take(a, i1, axis) * f
    return a


def spread(crop, weight, scale, sx, sy, fallback=None):
    """Colours of the crop pixels with `weight`, spread smoothly over the whole canvas at `scale`.

    Far from any weighted pixel the result fades to `fallback` (a canvas-size colour field) instead of black.
    """
    w = upsample(weight[..., None], scale)
    num = gauss_blur(upsample(crop * weight[..., None], scale), sx * scale, sy * scale)
    den = gauss_blur(w, sx * scale, sy * scale)
    if fallback is None:
        return num / np.maximum(den, 1e-6)
    eps = 2e-3
    return (num + eps * fallback) / (den + eps)


def build(crop: np.ndarray, scale: int):
    """Return (rgb over white, opaque coverage) at `scale`, both float."""
    h, w, _ = crop.shape
    # Centres of output pixels and of crop pixels, in crop px.
    yy, xx = np.mgrid[0:h * scale, 0:w * scale].astype(np.float32)
    X, Y = (xx + 0.5) / scale, (yy + 0.5) / scale
    ly, lx = np.mgrid[0:h, 0:w].astype(np.float32)
    LX, LY = lx + 0.5, ly + 0.5

    d_ring, d_pad, d_band = (ellipse_distance(e, X, Y) for e in (RING, PAD, BAND))
    m_ring_out, m_pad = inside(d_ring, scale), inside(d_pad, scale)
    m_band_out = inside(d_band, 1.0 / BAND_SOFT)   # the band's lower edge melts into the glow
    l_ring, l_pad, l_band = (ellipse_distance(e, LX, LY) for e in (RING, PAD, BAND))
    deep = 0.62  # a crop pixel counts for a part only when it lies this far inside it

    out_lr = (l_ring > deep) & (l_band > deep)
    glow = spread(crop, out_lr.astype(np.float32), scale, 1.5, 1.5)
    parts = []
    # Pad, ring, band.
    pad_w = ((l_pad < -0.3) & (crop[..., 2] < 0.8)).astype(np.float32)   # keeps the yellow inner rim, not the ring's white
    parts.append((m_pad, spread(crop, pad_w, scale, SIGMA, SIGMA, glow)))
    ring_w = ((l_ring < 0) & (l_pad > 0) & (crop[..., 2] > 0.9)).astype(np.float32)  # the clean white of the ring
    white = np.ones_like(glow) * np.array(RING_WHITE, np.float32)
    parts.append((m_ring_out * (1 - m_pad), spread(crop, ring_w, scale, 2.0, 2.0, white)))
    band_w = ((l_band < -deep) & (l_ring > 1.0)).astype(np.float32)
    parts.append((m_band_out * (1 - m_ring_out), spread(crop, band_w, scale, SIGMA, SIGMA, glow)))

    outside = (1 - m_ring_out) * (1 - m_band_out)
    # Column: from the top down to the ring, between COLUMN, cut into streaks.
    soft = COLUMN_SOFT
    col = np.clip((X - COLUMN[0]) / soft + 0.5, 0, 1) * np.clip((COLUMN[1] - X) / soft + 0.5, 0, 1)
    col = col * (Y < RING[1]).astype(np.float32)
    # The middle streak narrows to a spire at the top; beside the spire is glow.
    cx, x0, x1, y_full, y_tip, w_tip = SPIRE
    hw = (cx - x0) + (w_tip - (cx - x0)) * np.clip((y_full - Y) / (y_full - y_tip), 0, 1)
    beside = inside(hw - np.abs(X - cx), scale) * inside(x0 - X, scale) * inside(X - x1, scale)
    col = col * (1 - beside)
    col_lr_y = LY < RING[1] - 0.5
    edges = (COLUMN[0] - 4.0,) + STREAK_EDGES + (COLUMN[1] + 4.0,)
    for a, b in zip(edges[:-1], edges[1:]):
        m = inside(a - X, scale) * inside(X - b, scale)   # a <= x < b, crisp
        # crop pixels at least 80 % inside [a, b)
        overlap = np.clip(np.minimum(LX + 0.5, b) - np.maximum(LX - 0.5, a), 0, 1)
        wgt = ((overlap >= 0.8) & out_lr & col_lr_y).astype(np.float32)
        if wgt.sum() == 0:
            continue
        parts.append((outside * col * m, spread(crop, wgt, scale, *SIGMA_STREAK, fallback=glow)))
    # Glow: the rest.
    parts.append((outside * (1 - col), spread(crop, out_lr.astype(np.float32), scale, SIGMA, SIGMA, glow)))

    rgb = np.zeros((h * scale, w * scale, 3), np.float32)
    cover = np.zeros((h * scale, w * scale), np.float32)
    for m, c in parts:
        rgb += m[..., None] * c
        cover += m
    rgb = rgb / np.maximum(cover, 1e-6)[..., None] + (1 - np.minimum(cover, 1))[..., None]
    opaque = np.clip(m_ring_out + m_band_out, 0, 1)
    light = outside * col * inside(x0 - X, scale) * inside(X - x1, scale)   # the middle streak, for the alpha floor
    return np.clip(rgb, 0, 1), opaque, light


def to_rgba(rgb, opaque, light):
    """Opaque where `opaque`, else light: colour and alpha that give `rgb` over white.

    Inside the middle streak (`light`) the alpha is at least COLUMN_FLOOR (faded out
    where it fades to white), so its pale, nearly white core stays pale over the lawn
    instead of turning into dark lines.
    """
    deficit = (1.0 - rgb).max(axis=2)
    floor = COLUMN_FLOOR * light * np.clip(deficit / 0.15, 0, 1)
    a_light = np.clip(np.maximum(deficit * LIGHT_ALPHA, floor), 0, 1)
    alpha = opaque + (1 - opaque) * a_light
    colour = 1.0 - (1.0 - rgb) / np.maximum(alpha, 1e-6)[..., None]
    colour = np.where(alpha[..., None] > 1e-4, np.clip(colour, 0, 1), 1.0)
    return np.dstack([colour, alpha])


def over(rgba, bg):
    """Composite straight-alpha float RGBA over a solid colour (0..255 tuple)."""
    a = rgba[..., 3:4]
    return rgba[..., :3] * a + np.array(bg, np.float32) / 255.0 * (1 - a)


def u8(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def compare(crop, rgba, saved: Image.Image):
    """Side-by-side evidence: sheet 8x smooth | new on white | new on lawn | new on dark | 64x69 pairs."""
    h, w, _ = crop.shape
    W, H = w * S, h * S
    orig8 = u8(crop).resize((W, H), Image.BICUBIC)
    rgba_s = np.asarray(saved.convert('RGBA'), np.float32) / 255.0
    panels = [orig8, u8(over(rgba_s, (255, 255, 255))), u8(over(rgba_s, LAWN)), u8(over(rgba_s, (24, 30, 28)))]
    # Downscale: premultiplied box over white.
    small_new = u8(over(rgba_s, (255, 255, 255))).resize((w, h), Image.BOX)
    pair = Image.new('RGB', (W, H), (255, 255, 255))
    z = 3
    pair.paste(u8(crop).resize((w * z, h * z), Image.NEAREST), (8, 40))
    pair.paste(small_new.resize((w * z, h * z), Image.NEAREST), (16 + w * z, 40))
    pair.paste(u8(crop), (8, 60 + h * z))
    pair.paste(small_new, (16 + w * z, 60 + h * z))
    diff = np.abs(np.asarray(small_new, np.float32) - crop * 255).mean()
    d = ImageDraw.Draw(pair)
    d.text((8, 8), 'sheet 64x69 | new downscaled', fill=(0, 0, 0))
    d.text((8, 22), f'mean abs diff {diff:.1f}/255', fill=(0, 0, 0))
    panels.append(pair)
    labels = ['1 sheet crop 8x (bicubic)', '2 new on white', '3 new on lawn #8BCB4F', '4 new on dark', '5 3x nearest + 1x']
    sheet = Image.new('RGB', (len(panels) * (W + 12) + 12, H + 40), (200, 200, 200))
    d = ImageDraw.Draw(sheet)
    for i, (p, t) in enumerate(zip(panels, labels)):
        sheet.paste(p, (12 + i * (W + 12), 32))
        d.text((12 + i * (W + 12), 10), t, fill=(0, 0, 0))
    os.makedirs(os.path.dirname(EVIDENCE), exist_ok=True)
    sheet.save(EVIDENCE)
    return diff


def main():
    crop = load_crop()
    rgb, opaque, light = build(crop, S)
    rgba = to_rgba(rgb, opaque, light)
    img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
    img.save(OUT, 'WEBP', quality=QUALITY, alpha_quality=100, method=6, exact=False)
    saved = Image.open(OUT)
    diff = compare(crop, rgba, saved)
    print(f'{OUT}: {img.size[0]}x{img.size[1]}, {os.path.getsize(OUT) / 1024:.1f} kB; '
          f'downscaled vs sheet mean abs diff {diff:.2f}/255')


if __name__ == '__main__':
    main()

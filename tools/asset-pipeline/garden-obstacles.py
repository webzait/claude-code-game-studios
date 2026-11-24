#!/usr/bin/env python3
"""Cut the garden-theme obstacles out of the owner's pictures.

Reads  design/reference/turnflock/garden/25-rock-hd.webp, 26-rock-moss-light-hd.webp,
       27-rock-mossy-hd.webp, 28-stump-hd.webp (already cut out by the owner),
       06-bush-flowers.png, 17-sheet-bushes-plants.png
Writes assets/turnflock/garden/obstacles/*.webp   (transparent, baked shadow kept)
       data/themes/garden/obstacle-sprites.json   (size and foot of each picture)

The owner's picture is the part: nothing is drawn. Per picture:
1. The background colour is read from the border.
2. The object is everything not reachable from the border through
   background-like pixels (so white flowers inside the bush stay solid).
3. Inside the object alpha is 1. On its outer ring alpha and colour are
   un-mixed from the background (clean edge, no white or grey halo).
4. Outside the object, the soft baked shadow is kept as a semi-transparent
   dark lavender, so the piece still sits on the tile.
5. Cropped, scaled with premultiplied alpha (no dark fringe) and saved as WebP.

The three rocks and the stump come already cut out (transparent, no shadow):
their own edge is kept and a soft lavender contact shadow, in the colour and
strength of the bushes' baked shadow, is added under them so they sit on the
tile. The pink bush is made from 06-bush-flowers by retinting its white
flowers pink and lilac, as on 17-sheet-bushes-plants, because the pink bush
exists only at 83 px there; the smallest flower stays white, as on the sheet.

Run from the repo root:  python3 tools/asset-pipeline/garden-obstacles.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = Path('design/reference/turnflock/garden')
OUT = Path('assets/turnflock/garden/obstacles')
DATA = Path('data/themes/garden/obstacle-sprites.json')
LONGEST = 224          # px, longest side of an obstacle picture (game shows it ~50 CSS px wide)
PLANT_SCALE = 2        # sprig and grass come from a small sheet: twice its size
PLANT_FLOWER = 128     # px, longest side of a loose flower
OBJECT_STEP = 40       # colour distance from the background that ends "background"
SHADOW = np.array([92.0, 74.0, 124.0])   # colour the baked shadow is kept in
QUALITY = 88
SHADOW_LUM = 172       # for a grey object (default of cut()): baked-shadow pixels are lighter than this
DARK_FOOT = 80         # ... and a grey object's foot line is darker than this
COLOURED_SHADOW_LUM = 60   # bushes are never grey, so every grey-lavender pixel low down is shadow
CONTACT_SHADOW = 0.5   # strength of the shadow added under the owner's ready cut-outs, at its centre


def load(name):
    im = Image.open(SRC / name).convert('RGBA')
    a = np.asarray(im).astype(np.float64)
    rgb = a[..., :3]
    # Sheets carry their own transparency: put them on white first.
    alpha = a[..., 3:4] / 255.0
    return rgb * alpha + 255.0 * (1 - alpha)


def background_of(rgb):
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    return np.median(border, axis=0)


def outside_mask(rgb, bg, step=OBJECT_STEP):
    """Pixels reachable from the border through background-like (and shadow) pixels."""
    diff = np.abs(rgb - bg).max(axis=2)
    open_ = Image.fromarray(np.where(diff < step, 255, 0).astype(np.uint8)).copy()
    h, w = diff.shape
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)] + \
            [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    for s in seeds:
        if open_.getpixel(s) == 255:
            ImageDraw.floodfill(open_, s, 128)
    return np.asarray(open_) == 128


def morph(mask, size, grow):
    im = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8))
    im = im.filter(ImageFilter.MaxFilter(size) if grow else ImageFilter.MinFilter(size))
    return np.asarray(im) > 127


def box_blur(a, r):
    """Mean over a (2r+1)-square, edges clamped."""
    pad = np.pad(a, [(r + 1, r)] + [(r + 1, r)] + [(0, 0)] * (a.ndim - 2), mode='edge')
    c = pad.cumsum(0).cumsum(1)
    k = 2 * r + 1
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def cut(rgb, keep_shadow=1.0, shadow_lum=None):
    """Return straight RGBA (float 0..255 colour, 0..1 alpha) and the object mask."""
    bg = background_of(rgb)
    blob = ~outside_mask(rgb, bg)
    # The baked shadow is part of the blob: light, nearly grey-lavender pixels in its lower part.
    sat, _ = saturation_value(rgb)
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    rows = np.nonzero(blob.any(1))[0]
    low = np.zeros_like(blob)
    if rows.size:
        low[rows[0] + int(0.6 * (rows[-1] - rows[0])):] = True
    shadow = blob & low & (lum > (SHADOW_LUM if shadow_lum is None else shadow_lum)) & (sat < 0.14)
    if shadow_lum is None:
        # Grey rock: its foot ends in a dark contact line; everything in the blob below that line is shadow.
        dark = blob & low & (lum < DARK_FOOT)
        yy = np.arange(blob.shape[0])[:, None]
        has = dark.any(0)
        last = np.where(has, (np.where(dark, yy, -1)).max(0), 0).astype(float)
        if has.any():
            # Columns at the ends with no dark line take the line of the nearest column that has one.
            cols = np.arange(blob.shape[1])
            last = np.interp(cols, cols[has], last[has])
        shadow = shadow | (blob & low & (yy > last[None, :] + 1) & (sat < 0.2))
    obj = blob & ~shadow
    # Keep only the object's largest part and fill its holes (white flowers stay solid).
    obj = ~outside_mask(np.where(obj[..., None], 0.0, bg), bg, 1)
    core = morph(obj, 5, grow=False)
    ring = morph(obj, 3, grow=True) & ~core
    # Colour of the solid object next to each ring pixel.
    w = box_blur(core[..., None].astype(float), 4)
    near = box_blur(rgb * core[..., None], 4) / np.maximum(w, 1e-6)
    near = np.where(w > 1e-3, near, rgb)
    d = near - bg
    a_ring = np.clip(((rgb - bg) * d).sum(2) / np.maximum((d * d).sum(2), 1e-6), 0, 1)
    s = bg - SHADOW
    a_shadow = np.clip(((bg - rgb) * s).sum(2) / (s * s).sum(), 0, 1) * keep_shadow
    alpha = np.where(core, 1.0, 0.0)
    alpha = np.where(ring, a_ring, alpha)
    outside = ~core & ~ring
    alpha = np.where(outside, a_shadow, alpha)
    colour = rgb.copy()
    unmixed = np.clip(bg + (rgb - bg) / np.maximum(a_ring, 1e-3)[..., None], 0, 255)
    colour = np.where(ring[..., None], np.where((a_ring > 0.97)[..., None], rgb, unmixed), colour)
    # Where the shadow is stronger than the object's edge (ring pixels on the shadow side), keep the shadow.
    # Ring pixels touching the baked shadow are shadow too (un-mixing them against the background
    # would leave a light rim under the object).
    by_shadow = ring & morph(shadow, 5, grow=True)
    shadow_side = ring & ((a_shadow > a_ring) | by_shadow)
    use_shadow = outside | shadow_side
    alpha = np.where(shadow_side, np.maximum(a_shadow, np.where(by_shadow, 0, a_ring)), alpha)
    colour = np.where(use_shadow[..., None], SHADOW, colour)
    alpha = np.where(alpha < 0.03, 0, alpha)
    return colour, alpha, obj


def saturation_value(rgb):
    mx = rgb.max(2)
    mn = rgb.min(2)
    return (mx - mn) / np.maximum(mx, 1), mx / 255.0


def components(mask, min_area):
    """Label connected parts of a mask (flood fill); returns a list of boolean masks."""
    # .copy(): an image made from an array shares its memory and ignores flood fills.
    im = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8)).copy()
    out = []
    ys, xs = np.nonzero(mask)
    label = 1
    for y, x in zip(ys[::97], xs[::97]):
        if im.getpixel((int(x), int(y))) != 255:
            continue
        ImageDraw.floodfill(im, (int(x), int(y)), label)
        part = np.asarray(im) == label
        if part.sum() >= min_area:
            out.append(part)
        label += 1
        if label > 250:
            break
    return out


def flower_masks(rgb, obj):
    """The white flowers on a bush picture, largest first, each with its yellow centre filled in."""
    sat, val = saturation_value(rgb)
    white = obj & (sat < 0.16) & (val > 0.7)
    flowers = sorted(components(white, 4000), key=lambda m: -m.sum())
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yellow = (r > 200) & (g > 120) & (b < 120) & (r > g)
    filled = []
    h, w = flowers[0].shape if flowers else (0, 0)
    yy, xx = np.mgrid[0:h, 0:w]
    for part in flowers:
        # The yellow centre sits inside the ring of petals: fill it as a round disc.
        centre = yellow & morph(part, 41, grow=True)
        cy, cx = np.nonzero(centre)
        if cy.size:
            radius = np.sqrt(cy.size / np.pi) * 1.45
            part = part | ((yy - cy.mean()) ** 2 + (xx - cx.mean()) ** 2 <= radius ** 2)
        filled.append(part)
    return filled


def flower_cut(rgb, mask):
    """One flower lifted off the bush: solid inside, edge alpha from how white the petal rim still is."""
    sat, val = saturation_value(rgb)
    whiteness = np.clip((val - 0.55) / 0.3, 0, 1) * np.clip(1 - (sat - 0.1) * 3, 0, 1)
    core = morph(mask, 3, grow=False)
    ring = morph(mask, 3, grow=True) & ~core
    alpha = np.where(core, 1.0, np.where(ring, whiteness, 0.0))
    # Colour at the rim: the nearest solid petal colour, so no green from the leaves shows.
    w = box_blur(core[..., None].astype(float), 3)
    near = box_blur(rgb * core[..., None], 3) / np.maximum(w, 1e-6)
    colour = np.where(core[..., None], rgb, np.where(w > 1e-3, near, rgb))
    return colour, alpha, mask


def pink_flowers(rgb, obj, tints):
    """The pink bush: the white flowers of 06-bush-flowers retinted, one tint per flower (largest first)."""
    sat, val = saturation_value(rgb)
    flowers = flower_masks(rgb, obj)
    out = rgb.copy()
    lum = rgb.mean(2) / 255.0
    for part, tint in zip(flowers, tints):
        zone = morph(part, 7, grow=True)
        whiteness = np.clip((lum - 0.55) / 0.3, 0, 1) * np.clip(1 - sat * 4, 0, 1)
        weight = (zone * whiteness)[..., None]
        shade = np.clip(lum / 0.96, 0, 1)[..., None] ** 1.3
        coloured = np.array(tint, float) * shade
        # Keep a soft highlight on the brightest petal tops.
        coloured = coloured + (255 - coloured) * np.clip((lum - 0.95) / 0.05, 0, 1)[..., None] * 0.35
        out = out * (1 - weight) + coloured * weight
    return out


def from_cutout(name):
    """A picture the owner supplied already cut out: its own alpha, stray specks dropped, a soft contact shadow added."""
    a = np.asarray(Image.open(SRC / name).convert('RGBA')).astype(np.float64)
    rgb, alpha = a[..., :3], a[..., 3] / 255.0
    # The owner's cut-outs top out just under full alpha (253): make the body solid.
    alpha = np.clip(alpha / 0.98, 0, 1)
    parts = components(alpha > 0.5, 200)
    keep = max(parts, key=lambda m: m.sum())
    big = [m for m in parts if m.sum() > 0.02 * keep.sum()]
    near = morph(np.any(big, axis=0), 5, grow=True)
    alpha = np.where(near, alpha, 0)
    obj = alpha > 0.5
    ys, xs = np.nonzero(obj)
    foot, left, right = ys.max(), xs.min(), xs.max()
    width = right - left
    yy, xx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
    d = ((xx - (left + right) / 2) / (0.6 * width)) ** 2 + ((yy - foot + 0.02 * width) / (0.11 * width)) ** 2
    shade = CONTACT_SHADOW * np.exp(-2.4 * d)
    out_a = alpha + shade * (1 - alpha)
    colour = (rgb * alpha[..., None] + SHADOW * (shade * (1 - alpha))[..., None]) / np.maximum(out_a, 1e-6)[..., None]
    return colour, out_a, obj


def save(colour, alpha, obj, name, longest=None, scale=None):
    ys, xs = np.nonzero(alpha > 0.02)
    y0, y1 = max(0, ys.min() - 4), min(alpha.shape[0], ys.max() + 5)
    x0, x1 = max(0, xs.min() - 4), min(alpha.shape[1], xs.max() + 5)
    colour, alpha, obj = colour[y0:y1, x0:x1], alpha[y0:y1, x0:x1], obj[y0:y1, x0:x1]
    h, w = alpha.shape
    f = (longest / max(w, h)) if longest else scale
    size = (max(1, round(w * f)), max(1, round(h * f)))
    pre = np.dstack([colour * alpha[..., None], alpha * 255]).clip(0, 255).astype(np.uint8)
    small = np.asarray(Image.fromarray(pre, 'RGBA').resize(size, Image.LANCZOS)).astype(np.float64)
    a = small[..., 3:4] / 255.0
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{name}.webp'
    Image.fromarray(out, 'RGBA').save(path, 'WEBP', quality=QUALITY, alpha_quality=100, method=6)
    oys, oxs = np.nonzero(obj)
    return {
        'file': path.name,
        'px': list(size),
        'bytes': path.stat().st_size,
        # Where the object itself (not its shadow) sits in the picture, as shares of width and height.
        'objectLeft': round(oxs.min() / w, 4),
        'objectRight': round((oxs.max() + 1) / w, 4),
        'objectTop': round(oys.min() / h, 4),
        'foot': round((oys.max() + 1) / h, 4),
    }


def main():
    meta = {}
    for kind, name, source in [('rock', 'rock', '25-rock-hd.webp'), ('rockMossLight', 'rock-moss-light', '26-rock-moss-light-hd.webp'),
                               ('rockMossy', 'rock-mossy', '27-rock-mossy-hd.webp'), ('stump', 'stump', '28-stump-hd.webp')]:
        c, a, o = from_cutout(source)
        meta[kind] = save(c, a, o, name, LONGEST)
    bush = load('06-bush-flowers.png')
    c, a, o = cut(bush, shadow_lum=COLOURED_SHADOW_LUM)
    meta['bushWhite'] = save(c, a, o, 'bush-white', LONGEST)
    white_flower = flower_masks(bush, o)[0]
    pink = pink_flowers(bush, o, [(255, 112, 172), (226, 150, 238), (244, 84, 150)])
    c, a, o = cut(pink, shadow_lum=COLOURED_SHADOW_LUM)
    meta['bushPink'] = save(c, a, o, 'bush-pink', LONGEST)
    # Loose plants. The four-leaf sprig and the grass tuft come from 17-sheet-bushes-plants (429 x 83),
    # kept at twice the sheet's size; only the largest part of each column is kept.
    sheet = load('17-sheet-bushes-plants.png')
    plants = {}
    for name, (x0, x1) in {'plant-sprig': (190, 255), 'plant-grass': (255, 318)}.items():
        c, a, o = cut(sheet[:, x0:x1], keep_shadow=0.0)
        keep = max(components(a > 0.5, 50), key=lambda m: m.sum())
        a = np.where(morph(keep, 3, grow=True), a, 0)
        plants[name] = save(c, a, o & keep, name, scale=PLANT_SCALE)
    # The flowers come from the large bush picture (much sharper than the sheet): its biggest white
    # flower, and the same flower from the retinted pink bush.
    c, a, o = flower_cut(bush, white_flower)
    plants['plant-flower-white'] = save(c, a, o, 'plant-flower-white', longest=PLANT_FLOWER)
    # Same outline as the white one (the rim is judged on the white petals), pink colours.
    c_pink, _, _ = flower_cut(pink, white_flower)
    plants['plant-flower-pink'] = save(c_pink, a, o, 'plant-flower-pink', longest=PLANT_FLOWER)
    DATA.write_text(json.dumps({'_note': 'Written by tools/asset-pipeline/garden-obstacles.py; do not edit by hand.',
                                'obstacles': meta, 'plants': plants}, indent=2) + '\n')
    total = sum(m['bytes'] for m in meta.values())
    for k, m in {**meta, **plants}.items():
        print(f"{k:22s} {m['px'][0]:4d}x{m['px'][1]:<4d} {m['bytes'] / 1024:6.1f} kB")
    print(f"obstacles total {total / 1024:.1f} kB, plants total {sum(m['bytes'] for m in plants.values()) / 1024:.1f} kB")


if __name__ == '__main__':
    main()

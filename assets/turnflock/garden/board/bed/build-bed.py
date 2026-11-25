#!/usr/bin/env python3
"""
Build the garden board's grass bed (the green between the tiles) as one repeating WebP.

    python3 assets/turnflock/garden/board/bed/build-bed.py

Needs Pillow and numpy. Writes next to this file:
  bed.webp     the bed, laid over the underlay's top, repeating every `bedRepeat` cells
  blades.webp  strips of upright blades on a see-through ground, for the blade cards that
               make up the whole bed (`underlay.blades`)
src/render/parts/garden/underlay.ts lays both out (sizes in data/themes/garden/underlay.json).

Why it is built and not cut: in the owner's picture 01-board-full the bed shows only in thin
strips and small diamonds between the tiles, too little to cut a clean repeating patch from (the
earlier 128 px patch was blurred and blotchy at phone size). So the bed is drawn here, compact
and fine like the fur round the edge of the owner's tile pictures (02-tile-grass, 11):

  - a mid green ground with only fine, small variation (no blotches);
  - short leaf-shaped blades (narrow at the root, widest at a third, pointed), packed close on a
    jittered grid, each shaded from a green root to a light lime tip with a lit edge;
  - the blades point to the top of the picture, which is away from the camera on the board, so
    they read as standing grass seen from the front;
  - the grid wraps round the edges and every blade and its wrapped copies are drawn back to
    front together, so the patch repeats without a seam and without rows.

It is drawn at 3x and scaled down, so every blade edge is sharp and antialiased. Fixed seed: the
same file every run.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

SIZE = 256           # px of the finished patch (one repeat); only the shade between the blades shows
SS = 3               # drawn this many times larger, then scaled down
REPEAT = 1.25        # cells per repeat; keep equal to underlay.bedRepeat (px per cell = SIZE / REPEAT)
SEED = 11
QUALITY = 74         # WebP quality

# Colours from 01-board-full (the bed between the tiles) and the tile's fur edge (02, 11).
GROUND = (58, 118, 0)        # the green between the leaves
GROUND_DEEP = (40, 94, 0)    # the deepest slits
ROOT = (70, 140, 0)          # a leaf at its root
MID = (132, 204, 0)          # a leaf's body
TIP = (196, 240, 36)         # a leaf's light tip
EDGE = (212, 246, 74)        # the lit edge down one side of a leaf

# Sizes in cells (one tile pitch is about 1 cell; the gap between tiles is about 0.1). Short,
# leaf-shaped blades packed close, like the fur round the tile's edge: compact, not tufty.
BLADE_LEN = (0.045, 0.07)
BLADE_WIDTH = (0.02, 0.028)
LEAF_STEP = 0.022            # grid step of the leaves
TILT = 0.38                  # largest lean either way, radians

# The blade cards: the whole bed is rows of see-through cards standing in the gaps
# (underlay.blades). Each card shows a row of upright blades from this atlas: BLADE_VARIANTS
# strips stacked, each BLADE_W cells wide (it repeats along a row) and BLADE_H cells tall, at
# BLADE_PX px per cell. Keep BLADE_W, BLADE_H and the variant count equal to underlay.blades.
BLADE_PX = 1024
BLADE_W = 0.5
BLADE_H = 0.12
BLADE_VARIANTS = 4
BLADE_PAD = 8                # see-through px between strips, so mipmaps do not bleed
BLADE_STEP = 0.012           # cells between roots along a strip
BLADE_LENGTHS = (0.5, 1.0)   # blade length as a fraction of the strip's height
BLADE_WIDTHS = (0.012, 0.018)
# The blades' own colours: deeper and less yellow than the tiles, as the bed in 01-board-full
# (about 0.55 of the tiles' red and 0.7 of their green), with light lime tips.
B_ROOT = (64, 142, 0)
B_MID = (104, 192, 0)
B_TIP = (156, 226, 4)
B_EDGE = (176, 236, 16)
BACK_SHADE = 0.86           # the blades standing behind: only a little darker, so the bed stays clear green


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def blade_colour(t, shade, palette=None):
    """Colour at fraction t from root (0) to tip (1), darkened by shade (0..1)."""
    root, mid, tip = palette[:3] if palette else (ROOT, MID, TIP)
    c = lerp(root, mid, t / 0.45) if t < 0.45 else lerp(mid, tip, (t - 0.45) / 0.55)
    return tuple(int(v * shade) for v in c)


def blade(draw, x, y, length, width, angle, bend, shade, cell, palette=None):
    """One pointed blade from root (x, y), pointing up (-y) turned by angle, bending by bend.
    Drawn as stacked quads, each its own colour, so the root-to-tip shading is smooth."""
    segs = 8
    pts_l, pts_r, cols = [], [], []
    for i in range(segs + 1):
        t = i / segs
        a = angle + bend * t * t
        # Centre line: integrate the bending direction.
        if i == 0:
            cx, cy = x, y
        else:
            cx += np.sin(a) * length / segs
            cy -= np.cos(a) * length / segs
        # Leaf-shaped: narrow at the root, widest at a third, coming to a point.
        w = width * 0.5 * ((0.55 + 0.45 * t / 0.35) if t < 0.35 else ((1 - t) / 0.65) ** 0.75)
        nx, ny = np.cos(a), np.sin(a)
        pts_l.append((cx - nx * w, cy - ny * w))
        pts_r.append((cx + nx * w, cy + ny * w))
        cols.append(blade_colour(t, shade, palette))
    for i in range(segs):
        quad = [pts_l[i], pts_r[i], pts_r[i + 1], pts_l[i + 1]]
        draw.polygon(quad, fill=cols[i + 1])
        # The lit edge: a thin strip down the left side, fading out toward the root.
        t = (i + 1) / segs
        mid_l = [(pts_l[i][0] * 0.7 + pts_r[i][0] * 0.3, pts_l[i][1] * 0.7 + pts_r[i][1] * 0.3),
                 (pts_l[i + 1][0] * 0.7 + pts_r[i + 1][0] * 0.3, pts_l[i + 1][1] * 0.7 + pts_r[i + 1][1] * 0.3)]
        if t > 0.3:
            edge = lerp(cols[i + 1], tuple(int(v * shade) for v in (palette[3] if palette else EDGE)), min(1, (t - 0.3) * 1.2) * 0.8)
            draw.polygon([pts_l[i], mid_l[0], mid_l[1], pts_l[i + 1]], fill=edge)


def build():
    rand = np.random.default_rng(SEED)
    n = SIZE * SS
    cell = n / REPEAT                      # drawing px per cell
    img = Image.new('RGB', (n, n), GROUND)
    draw = ImageDraw.Draw(img)

    # Fine ground variation: small soft specks of the deep green, no large patches.
    for _ in range(int(2500 * REPEAT * REPEAT)):
        x, y = rand.uniform(0, n), rand.uniform(0, n)
        r = rand.uniform(0.004, 0.009) * cell
        c = lerp(GROUND, GROUND_DEEP, rand.uniform(0.3, 1))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                draw.ellipse([x + ox - r, y + oy - r * 0.6, x + ox + r, y + oy + r * 0.6], fill=c)
    img = img.filter(ImageFilter.GaussianBlur(0.006 * cell))
    draw = ImageDraw.Draw(img)

    # Leaves on a dense jittered grid that wraps round, every row offset by half a step.
    step = LEAF_STEP * cell
    k = int(round(n / step))
    step = n / k
    leaves = []
    for gy in range(k):
        for gx in range(k):
            x = ((gx + 0.5 + rand.uniform(-0.45, 0.45) + (0.5 if gy % 2 else 0)) * step) % n
            y = (gy + 0.5 + rand.uniform(-0.4, 0.4)) * step
            leaves.append(dict(
                x=x, y=y,
                length=rand.uniform(*BLADE_LEN) * cell,
                width=rand.uniform(*BLADE_WIDTH) * cell,
                angle=rand.uniform(-TILT, TILT),
                bend=rand.uniform(-0.25, 0.25),
                shade=rand.uniform(0.84, 1.0),
            ))
    # Every leaf and its wrapped copies, drawn back to front by root row: a root lower in the
    # picture is nearer the camera and covers the leaves behind it. Sorting the copies together
    # keeps the overlap the same on both sides of an edge, so there is no seam.
    copies = []
    for leaf in leaves:
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                x, y = leaf['x'] + ox, leaf['y'] + oy
                if -0.1 * cell < x < n + 0.1 * cell and -0.02 * cell < y < n + 0.1 * cell:
                    copies.append((y, x, leaf))
    copies.sort(key=lambda c: c[0])
    for y, x, l in copies:
        blade(draw, x, y, l['length'], l['width'], l['angle'], l['bend'], l['shade'], cell)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def build_blades():
    """The blade atlas: BLADE_VARIANTS strips of upright blades rooted along each strip's
    bottom edge, on a see-through ground, each repeating along its length. Within a strip some
    blades stand behind the others, darker, so the light tips of the front ones stand out.
    See-through pixels take a blade colour, so filtered edges show no dark halo."""
    rand = np.random.default_rng(SEED + 2)
    sw, sh = int(BLADE_W * BLADE_PX), int(round(BLADE_H * BLADE_PX))
    W, H = sw * SS, (sh + BLADE_PAD) * BLADE_VARIANTS * SS
    cell = BLADE_PX * SS
    img = Image.new('RGB', (W, H), B_MID)
    mask = Image.new('L', (W, H), 0)
    draw, mdraw = ImageDraw.Draw(img), ImageDraw.Draw(mask)
    for v in range(BLADE_VARIANTS):
        top = v * (sh + BLADE_PAD) * SS + BLADE_PAD // 2 * SS
        bottom = top + sh * SS
        k = int(round(BLADE_W / BLADE_STEP))
        step = sw * SS / k
        blades = []
        for i in range(k):
            blades.append(dict(
                x=(i + rand.uniform(0, 1)) * step,
                y=bottom + rand.uniform(0.0, 0.04) * sh * SS,
                length=rand.uniform(*BLADE_LENGTHS) * sh * SS * 0.98,
                width=rand.uniform(*BLADE_WIDTHS) * cell,
                angle=rand.uniform(-TILT, TILT) * 0.7,
                bend=rand.uniform(-0.3, 0.3),
                shade=rand.uniform(0.86, 1.0),
                back=rand.uniform(0, 1),
            ))
        blades.sort(key=lambda b: b['back'])
        # Clip each strip to its own band, so no blade reaches into the next.
        band = Image.new('L', (W, H), 0)
        ImageDraw.Draw(band).rectangle([0, top, W, bottom], fill=255)
        layer = Image.new('RGB', (W, H), B_MID)
        lmask = Image.new('L', (W, H), 0)
        ld, lm = ImageDraw.Draw(layer), ImageDraw.Draw(lmask)
        for b in blades:
            shade = b['shade'] * (BACK_SHADE if b['back'] < 0.35 else 1.0)
            length = min(b['length'], b['y'] - top - 2 * SS)
            for ox in (-sw * SS, 0, sw * SS):
                blade(ld, b['x'] + ox, b['y'], length, b['width'], b['angle'], b['bend'], shade, cell, (B_ROOT, B_MID, B_TIP, B_EDGE))
                blade_mask(lm, b['x'] + ox, b['y'], length, b['width'], b['angle'], b['bend'])
        from PIL import ImageChops
        lmask = ImageChops.multiply(lmask, band)
        img.paste(layer, (0, 0), band)
        mask = ImageChops.lighter(mask, lmask)
    size = (sw, (sh + BLADE_PAD) * BLADE_VARIANTS)
    img = img.resize(size, Image.LANCZOS)
    mask = mask.resize(size, Image.LANCZOS)
    rgba = img.convert('RGBA')
    rgba.putalpha(mask)
    return rgba


def blade_mask(draw, x, y, length, width, angle, bend):
    """The same outline as blade(), filled white, for the blade atlas's see-through mask."""
    segs = 8
    left, right = [], []
    cx, cy = x, y
    for i in range(segs + 1):
        t = i / segs
        a = angle + bend * t * t
        if i:
            cx += np.sin(a) * length / segs
            cy -= np.cos(a) * length / segs
        wv = width * 0.5 * ((0.55 + 0.45 * t / 0.35) if t < 0.35 else ((1 - t) / 0.65) ** 0.75)
        nx, ny = np.cos(a), np.sin(a)
        left.append((cx - nx * wv, cy - ny * wv))
        right.append((cx + nx * wv, cy + ny * wv))
    draw.polygon(left + right[::-1], fill=255)


def main():
    out = os.path.join(HERE, 'bed.webp')
    build().save(out, 'WEBP', quality=QUALITY, method=6)
    print('bed.webp', SIZE, 'px,', round(os.path.getsize(out) / 1024, 1), 'kB')
    out = os.path.join(HERE, 'blades.webp')
    atlas = build_blades()
    # Lower quality than the bed: about 31 kB instead of 50, the blades' colour and outline change by
    # under 1.5 % on average (measured against the uncompressed atlas).
    atlas.save(out, 'WEBP', quality=62, alpha_quality=70, method=6, exact=True)
    print('blades.webp', atlas.size, round(os.path.getsize(out) / 1024, 1), 'kB')


if __name__ == '__main__':
    main()

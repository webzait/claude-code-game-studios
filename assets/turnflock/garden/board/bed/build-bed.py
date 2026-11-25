#!/usr/bin/env python3
"""
Build the garden board's grass bed (the green between the tiles) as one repeating WebP.

    python3 assets/turnflock/garden/board/bed/build-bed.py

Needs Pillow and numpy. Writes bed.webp next to this file; src/render/parts/garden/underlay.ts
lays it over the underlay's top, repeating every `bedRepeat` cells (data/themes/garden/underlay.json).

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

SIZE = 640           # px of the finished patch (one repeat)
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


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def blade_colour(t, shade):
    """Colour at fraction t from root (0) to tip (1), darkened by shade (0..1)."""
    c = lerp(ROOT, MID, t / 0.45) if t < 0.45 else lerp(MID, TIP, (t - 0.45) / 0.55)
    return tuple(int(v * shade) for v in c)


def blade(draw, x, y, length, width, angle, bend, shade, cell):
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
        cols.append(blade_colour(t, shade))
    for i in range(segs):
        quad = [pts_l[i], pts_r[i], pts_r[i + 1], pts_l[i + 1]]
        draw.polygon(quad, fill=cols[i + 1])
        # The lit edge: a thin strip down the left side, fading out toward the root.
        t = (i + 1) / segs
        mid_l = [(pts_l[i][0] * 0.7 + pts_r[i][0] * 0.3, pts_l[i][1] * 0.7 + pts_r[i][1] * 0.3),
                 (pts_l[i + 1][0] * 0.7 + pts_r[i + 1][0] * 0.3, pts_l[i + 1][1] * 0.7 + pts_r[i + 1][1] * 0.3)]
        if t > 0.3:
            edge = lerp(cols[i + 1], tuple(int(v * shade) for v in EDGE), min(1, (t - 0.3) * 1.2) * 0.8)
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


def main():
    out = os.path.join(HERE, 'bed.webp')
    build().save(out, 'WEBP', quality=QUALITY, method=6)
    print('bed.webp', SIZE, 'px,', round(os.path.getsize(out) / 1024, 1), 'kB')


if __name__ == '__main__':
    main()

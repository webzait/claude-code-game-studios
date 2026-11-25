#!/usr/bin/env python3
"""
Build the garden board's grass bed (the green between the tiles) as one repeating WebP.

    python3 assets/turnflock/garden/board/bed/build-bed.py

Needs Pillow and numpy. Writes bed.webp next to this file; src/render/parts/garden/underlay.ts
lays it over the underlay's top, repeating every `bedRepeat` cells (data/themes/garden/underlay.json).

Why it is built and not cut: in the owner's picture 01-board-full the bed shows only in thin
strips and small diamonds between the tiles, too little to cut a clean repeating patch from (the
earlier 128 px patch was blurred and blotchy at phone size). So the bed is drawn here, in the
picture's style and colours (sampled from the strip between the rim and the first row of tiles):

  - a mid green ground with only fine, small variation (no blotches);
  - tufts of three to six pointed blades fanning out from one root, every blade shaded from a
    deep green root to a light yellow-green tip, with a lighter edge on one side, as painted in
    the picture;
  - the blades point to the top of the picture, which is away from the camera on the board, so
    they read as standing grass seen from the front, as in 01-board-full;
  - tufts sit on a jittered grid that wraps round the edges, drawn front to back by row, so the
    patch repeats without a seam and without rows.

It is drawn at 3x and scaled down, so every blade edge is sharp and antialiased. Fixed seed: the
same file every run.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

SIZE = 384           # px of the finished patch (one repeat)
SS = 3               # drawn this many times larger, then scaled down
REPEAT = 1.25        # cells per repeat; keep equal to underlay.bedRepeat (px per cell = SIZE / REPEAT)
SEED = 11
QUALITY = 72         # WebP quality

# Colours from 01-board-full: the bed strip under the top rim and the diamonds between tiles.
GROUND = (62, 126, 0)        # the green between the blades
GROUND_DEEP = (46, 102, 0)   # in the shade at a tuft's root
ROOT = (64, 132, 0)          # a blade at its root
MID = (112, 190, 0)         # a blade halfway
TIP = (192, 240, 34)         # a blade's light tip
EDGE = (170, 230, 22)        # the lit edge down one side of a blade

# Sizes in cells (one tile pitch is about 1 cell; the gap between tiles is about 0.1).
BLADE_LEN = (0.13, 0.22)
BLADE_WIDTH = (0.034, 0.05)
TUFT_STEP = 0.09             # grid step of the tufts
TUFT_BLADES = (4, 7)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def blade_colour(t, shade):
    """Colour at fraction t from root (0) to tip (1), darkened by shade (0..1)."""
    c = lerp(ROOT, MID, t / 0.55) if t < 0.55 else lerp(MID, TIP, (t - 0.55) / 0.45)
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
        w = width * (1 - t) ** 0.9 * 0.5
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
    for _ in range(int(900 * REPEAT * REPEAT)):
        x, y = rand.uniform(0, n), rand.uniform(0, n)
        r = rand.uniform(0.006, 0.014) * cell
        c = lerp(GROUND, GROUND_DEEP, rand.uniform(0.3, 1))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                draw.ellipse([x + ox - r, y + oy - r * 0.6, x + ox + r, y + oy + r * 0.6], fill=c)
    img = img.filter(ImageFilter.GaussianBlur(0.006 * cell))
    draw = ImageDraw.Draw(img)

    # Tufts on a jittered grid that wraps round.
    step = TUFT_STEP * cell
    k = int(round(n / step))
    step = n / k
    tufts = []
    for gy in range(k):
        for gx in range(k):
            x = (gx + 0.5 + rand.uniform(-0.45, 0.45) + (0.5 if gy % 2 else 0)) * step
            y = (gy + 0.5 + rand.uniform(-0.4, 0.4)) * step
            tufts.append((y, x % n, int(rand.integers(TUFT_BLADES[0], TUFT_BLADES[1] + 1)), rand.integers(1 << 30)))
    # Every tuft and its wrapped copies, drawn front to back by root row: a root lower in the
    # picture is nearer the camera and covers the blades behind it. Sorting the copies together
    # keeps the overlap the same on both sides of an edge, so there is no seam.
    copies = []
    for y, x, count, seed in tufts:
        r = np.random.default_rng(int(seed))
        specs = []
        for j in range(count):
            spread = (j - (count - 1) / 2) / max(1, count - 1)
            specs.append(dict(
                dx=r.uniform(-0.012, 0.012) * cell,
                length=r.uniform(*BLADE_LEN) * cell * (1 - 0.35 * abs(spread)),
                width=r.uniform(*BLADE_WIDTH) * cell,
                angle=spread * r.uniform(0.6, 1.0) + r.uniform(-0.12, 0.12),
                bend=spread * r.uniform(0.1, 0.4),
                shade=r.uniform(0.82, 1.04),
            ))
        # Outer blades first, the upright middle ones over them.
        specs.sort(key=lambda s: -abs(s['angle']))
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                if -0.2 * cell < x + ox < n + 0.2 * cell and -0.05 * cell < y + oy < n + 0.2 * cell:
                    copies.append((y + oy, x + ox, specs))
    copies.sort(key=lambda c: c[0])
    for y, x, specs in copies:
        for s in specs:
            blade(draw, x + s['dx'], y, s['length'], s['width'], s['angle'], s['bend'], min(1.0, s['shade']), cell)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    out = os.path.join(HERE, 'bed.webp')
    build().save(out, 'WEBP', quality=QUALITY, method=6)
    print('bed.webp', SIZE, 'px,', round(os.path.getsize(out) / 1024, 1), 'kB')


if __name__ == '__main__':
    main()

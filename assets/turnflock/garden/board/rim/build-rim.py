#!/usr/bin/env python3
"""
Cut the garden rim out of one of the owner's pictures and pack it into one WebP atlas.

    python3 assets/turnflock/garden/board/rim/build-rim.py          # from 03-rim-vines -> rim-atlas.webp
    python3 assets/turnflock/garden/board/rim/build-rim.py board    # from 01-board-full -> board-rim-atlas.webp

The "board" cut takes the rim from the whole-board picture together with the strip of lawn
between the braid and the tiles (its grass fringe and the braid's shadow on it), so the rim and
the lawn are of one piece. Everything inside the picture's tiles' outline is see-through: the
game's own tiles and grass bed show there.

Needs Pillow, numpy and scipy. Writes, next to this file:
  rim-atlas.webp   corners, plain braid tiles and decorated side pieces
and the "atlas" block of data/themes/garden/rim.json (where each piece sits in the atlas and in
the source picture), which src/render/parts/garden/rim.ts reads to lay the rim out.

The source picture's background is a warm off-white with a soft drop shadow. It is removed by
flood-filling everything background-coloured that touches the picture's edge or the middle; the
edge of what is left gets a one-pixel feather, and the colour of every see-through pixel is taken
from the nearest solid pixel, so there is no white or grey halo when the texture is filtered.
The left flower sits on the drop shadow and cannot be told from it by colour, so the right
flower (on clean background) is copied over it.
"""
import json
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
REF = os.path.join(ROOT, 'design/reference/turnflock/garden')
DATA = os.path.join(ROOT, 'data/themes/garden/rim.json')

SCALE = 0.8          # atlas pixels per source pixel
QUALITY = 74         # WebP quality
PAD = 6              # atlas padding round every piece (filled with bleed, wrapped for tiles)
FADE = 40            # source pixels over which a piece's open end fades into the braid tile

# The inside of the rim in the source picture (x left, x right, y top, y bottom): where the braid
# meets the grass. Every piece is placed by this rectangle, so it lands on the board's inside.
INNER = (173, 1070, 138, 1067)
FLOWER_LEFT = (111, 366)
FLOWER_RIGHT = (1125, 865)
FLOWER_R = 60
FLOWER_GROW = 1.1
PETAL_R = 53          # the petals reach this far from the heart
FLOWER_FILL = 250     # px further down the left side where the braid is plain
LEFT_BRAID = (80, 176)
RIGHT_OUTSIDE = 1168   # x of the right braid's outside in the source
# Straight stretches to straighten (straighten()): along-range in source px, and the across-range
# that holds the braid's outside edge.
STRAIGHTEN = {
    'top': (240, 1040, (40, 120)),
    'bottom': (360, 1000, (1100, 1215)),
    'left': (240, 1010, (60, 140)),
    'right': (240, 1010, (1110, 1200)),
}
TAPER = 40
SOURCE = '03-rim-vines.png'
OUT = 'rim-atlas.webp'
KEY = 'atlas'
TILE_MASK = None      # (x0, x1, y0, y1): the picture's tiles, made see-through (board cut only)
TILE_FADE = 10
WHITE_MIN, WHITE_SPREAD = 170, 40   # what counts as petal white
WINDOW = {'top': (0, 330), 'bottom': (930, 1254), 'left': (0, 330), 'right': (930, 1254)}

# Corners: the rectangle cut from the source (x0, y0, x1, y1). The two sides of a corner that
# run on into the straight sides end in a fade. A corner and the decorated piece next to it share
# FADE px of the source, so where the board is the source's size they cross-fade into each other.
CORNERS = {
    'tl': (28, 30, 320, 320),
    'tr': (970, 30, 1226, 320),
    'bl': (28, 940, 420, 1232),
    'br': (940, 940, 1226, 1232),
}
# Straight-side pieces, along the side (source px on that axis) and across (source px):
# decorated pieces ('kind' 'decor') and the plain braid that repeats ('kind' 'tile').
# 'home' is where the piece's middle sits along the side in the source, as a share of the inner side.
SIDES = {
    'top':    {'axis': 'x', 'across': (25, 152), 'pieces': [
        {'name': 'top-a', 'kind': 'decor', 'span': (280, 505)},
        {'name': 'top-tile', 'kind': 'tile', 'span': (505, 745)},
        {'name': 'top-b', 'kind': 'decor', 'span': (735, 1010)},
    ]},
    'bottom': {'axis': 'x', 'across': (1052, 1236), 'pieces': [
        {'name': 'bottom-tile', 'kind': 'tile', 'span': (395, 680)},
        {'name': 'bottom-f', 'kind': 'decor', 'span': (660, 980)},
    ]},
    'left':   {'axis': 'y', 'across': (24, 188), 'pieces': [
        {'name': 'left-g', 'kind': 'decor', 'span': (280, 600)},
        {'name': 'left-h', 'kind': 'decor', 'span': (670, 980)},
    ]},
    'right':  {'axis': 'y', 'across': (1052, 1230), 'pieces': [
        {'name': 'right-c', 'kind': 'decor', 'span': (280, 510)},
        {'name': 'right-tile', 'kind': 'tile', 'span': (505, 755), 'across': (1062, 1230)},
        {'name': 'right-d', 'kind': 'decor', 'span': (740, 980)},
    ]},
}


PROFILE = sys.argv[1] if len(sys.argv) > 1 else 'rim'
if PROFILE == 'board':
    # 01-board-full: a 6x6 board. INNER is the outline of its tiles (where the game's tiles go).
    SOURCE = '01-board-full.png'
    OUT = 'board-rim-atlas.webp'
    KEY = 'atlasBoard'
    INNER = (192, 1062, 151, 1052)
    TILE_MASK = INNER
    WHITE_MIN, WHITE_SPREAD = 155, 60
    FLOWER_LEFT = (107, 365)
    FLOWER_RIGHT = (1131, 866)
    LEFT_BRAID = (84, 172)
    RIGHT_OUTSIDE = 1177
    STRAIGHTEN = {
        'top': (240, 1040, (40, 120)),
        'bottom': (360, 1000, (1110, 1225)),
        'left': (240, 1010, (55, 140)),
        'right': (240, 1010, (1120, 1215)),
    }
    SIDES['top']['across'] = (25, 151)
    SIDES['bottom']['across'] = (1052, 1240)
    SIDES['left']['across'] = (24, 192)
    SIDES['right']['across'] = (1062, 1234)
    SIDES['right']['pieces'][1]['across'] = (1062, 1234)
    CORNERS = {
        'tl': (28, 30, 320, 320),
        'tr': (970, 30, 1230, 320),
        'bl': (28, 940, 420, 1240),
        'br': (940, 940, 1230, 1240),
    }

def load(name):
    return np.asarray(Image.open(os.path.join(REF, name)).convert('RGB')).astype(np.float32)


def matte(im):
    """Solid (True) where the picture shows rim, leaves or flowers; False on the background."""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    # Background and its soft drop shadow: light and nearly colourless (the rim is orange, the
    # leaves green; the flowers are white too and are put back afterwards, see rgba_source).
    bglike = (mx - mn < 48) & (mx > 120)
    lab, _ = nd.label(bglike)
    h, w = bglike.shape
    seeds = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) | {lab[h // 2, w // 2]}
    seeds.discard(0)
    solid = ~np.isin(lab, list(seeds))
    solid = nd.binary_opening(solid, iterations=1)
    # Fill only small holes (specks inside the braid), never the big opening in the middle.
    holes = nd.binary_fill_holes(solid) & ~solid
    lab, n = nd.label(holes)
    if n:
        sizes = nd.sum(holes, lab, range(1, n + 1))
        small = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < 400])
        solid |= small
    return solid


def disc(shape, c, radius):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return (xx - c[0]) ** 2 + (yy - c[1]) ** 2 <= radius ** 2


def flower_mask(im, c, petals_only=False):
    """The petals and heart of the flower round `c`: the bright, nearly colourless region and the
    yellow heart, in a disc round `c`, with its inner holes filled."""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    near = disc(im.shape, c, PETAL_R)
    white = near & (mn > WHITE_MIN) & (mx - mn < WHITE_SPREAD)
    # Not the background past the right braid's outside.
    white &= np.arange(im.shape[1])[None, :] < RIGHT_OUTSIDE - 6
    heart = disc(im.shape, c, 20) & (r > 200) & (g > 110) & (b < 120)
    m = nd.binary_opening(white, iterations=1) | heart
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        m = lab == 1 + int(np.argmax(sizes))
    m = nd.binary_closing(m, iterations=2)
    return nd.binary_fill_holes(m)


def rgba_source():
    im = load(SOURCE)
    solid = matte(im)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    braid_or_leaf = ((r - b > 60) & (r > g + 12)) | ((g > r) & (g - b > 40))
    # Take the left flower away. Where it covered the braid, put back the braid from FLOWER_FILL
    # px lower down the same side (plain braid there); elsewhere the background shows.
    old = disc(im.shape, FLOWER_LEFT, FLOWER_R + 16) & ~braid_or_leaf
    band = np.zeros_like(old)
    band[:, LEFT_BRAID[0]:LEFT_BRAID[1]] = True
    fill = old & band
    im[fill] = np.roll(im, -FLOWER_FILL, 0)[fill]
    solid = (solid & ~old) | fill
    # Copy the right flower, a little larger, over the left one.
    right = nd.binary_dilation(smooth(flower_mask(im, FLOWER_RIGHT)), iterations=1)
    x0, y0 = FLOWER_RIGHT[0] - FLOWER_R, FLOWER_RIGHT[1] - FLOWER_R
    size = 2 * FLOWER_R
    big = round(size * FLOWER_GROW)
    patch = np.concatenate([im[y0:y0 + size, x0:x0 + size], right[y0:y0 + size, x0:x0 + size, None] * 255.0], -1)
    patch = np.asarray(Image.fromarray(patch.astype(np.uint8), 'RGBA').resize((big, big), Image.LANCZOS)).astype(np.float32)
    px, py = FLOWER_LEFT[0] - big // 2, FLOWER_LEFT[1] - big // 2
    k = patch[..., 3:] / 255.0
    im[py:py + big, px:px + big] = im[py:py + big, px:px + big] * (1 - k) + patch[..., :3] * k
    moved = np.zeros_like(solid)
    moved[py:py + big, px:px + big] = k[..., 0] > 0.5
    # The right flower sits on the braid and its leaves: everything round it up to the outside of
    # the braid is solid (its shaded petal edges are as grey as the drop shadow).
    yy, xx = np.mgrid[:solid.shape[0], :solid.shape[1]]
    round_right = disc(im.shape, FLOWER_RIGHT, PETAL_R) & (xx < RIGHT_OUTSIDE)
    solid = solid | moved | right | round_right
    alpha = feather(solid)
    return bleed(im, alpha), alpha


def smooth(mask):
    """A mask with a smooth outline: blurred and cut at one half."""
    return nd.gaussian_filter(mask.astype(np.float32), 1.6) > 0.5


def feather(solid):
    """A one-pixel soft edge just inside the solid outline, so no background colour is mixed in."""
    inner = nd.binary_erosion(solid, iterations=1)
    a = nd.gaussian_filter(inner.astype(np.float32), 0.75)
    return np.clip(a * 1.15, 0, 1) * (nd.binary_dilation(inner, iterations=2))


def bleed(im, alpha):
    """Give every see-through or half see-through pixel the colour of the nearest fully solid one."""
    core = alpha > 0.98
    _, (iy, ix) = nd.distance_transform_edt(~core, return_indices=True)
    return im[iy, ix]


def straighten(rgb, alpha):
    """The picture's sides are drawn by hand and wander a few pixels. Shift each column (top and
    bottom) or row (left and right) of a straight side, sub-pixel, so the braid's outside runs
    straight; the shift tapers to nothing at each end, inside the corners. Without this, a repeated
    stretch of braid meets a corner with a small step."""
    out_rgb, out_a = rgb.copy(), alpha.copy()
    targets = {}
    for side, (lo, hi, band) in STRAIGHTEN.items():
        vertical = side in ('left', 'right')
        r, g, b = out_rgb[..., 0], out_rgb[..., 1], out_rgb[..., 2]
        bark = (r - b > 60) & (r > g + 12) & (out_a > 0.5)
        m = bark
        sm = out_a > 0.5
        along = np.arange(lo, hi)
        edge = []
        outer_low = side in ('top', 'left')
        for a in along:
            # The outermost solid pixel; it counts only when it is bark (a leaf or flower over
            # the edge hides where the braid's edge is, so those places are filled in between).
            line = np.where(sm[a, band[0]:band[1]] if vertical else sm[band[0]:band[1], a])[0]
            if not len(line):
                edge.append(np.nan)
                continue
            k = band[0] + (line.min() if outer_low else line.max())
            is_bark = m[a, k] if vertical else m[k, a]
            edge.append(k if is_bark else np.nan)
        edge = np.array(edge, np.float64)
        good = ~np.isnan(edge)
        edge = np.interp(along, along[good], edge[good])
        edge = nd.median_filter(edge, 61, mode='nearest')
        edge = nd.gaussian_filter1d(edge, 8, mode='nearest')
        target = np.median(edge)
        targets[side] = float(target)
        t = np.clip(np.minimum(along - lo, hi - 1 - along) / TAPER, 0, 1)
        shift = np.clip(target - edge, -10, 10) * (t * t * (3 - 2 * t))
        # Only the strip of the picture that holds this side moves.
        w0, w1 = WINDOW[side]
        for i, a in enumerate(along):
            d = shift[i]
            if abs(d) < 0.05:
                continue
            if vertical:
                out_rgb[a, w0:w1] = nd.shift(out_rgb[a, w0:w1], (d, 0), order=1, mode='nearest')
                out_a[a, w0:w1] = nd.shift(out_a[a, w0:w1], d, order=1, mode='constant')
            else:
                out_rgb[w0:w1, a] = nd.shift(out_rgb[w0:w1, a], (d, 0), order=1, mode='nearest')
                out_a[w0:w1, a] = nd.shift(out_a[w0:w1, a], d, order=1, mode='constant')
    return out_rgb, out_a, targets


def side_coords(side, axis_pos, across_pos):
    return (axis_pos, across_pos) if SIDES[side]['axis'] == 'x' else (across_pos, axis_pos)


def cut(rgb, alpha, box):
    x0, y0, x1, y1 = box
    return np.concatenate([rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1, None] * 255], -1)


def fade_ends(piece, axis, start, end):
    """Fade the alpha of a piece in over FADE px at its start and out at its end (along `axis`)."""
    n = piece.shape[1] if axis == 'x' else piece.shape[0]
    ramp = np.ones(n, np.float32)
    f = np.linspace(0, 1, FADE + 2)[1:-1]
    if start:
        ramp[:FADE] = f
    if end:
        ramp[-FADE:] = np.minimum(ramp[-FADE:], f[::-1])
    piece = piece.copy()
    piece[..., 3] *= ramp[None, :] if axis == 'x' else ramp[:, None]
    return piece


def periodic(piece, axis):
    """Make a plain braid piece repeat without a seam: its last FADE px are blended into its first."""
    p = piece if axis == 'x' else piece.transpose(1, 0, 2)
    n = p.shape[1] - FADE
    out = p[:, :n].copy()
    w = np.linspace(0, 1, FADE)[None, :, None]
    out[:, :FADE] = p[:, n:] * (1 - w) + p[:, :FADE] * w
    return out if axis == 'x' else out.transpose(1, 0, 2)


def to_image(piece):
    arr = np.clip(piece, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, 'RGBA')
    return img.resize((max(1, round(img.width * SCALE)), max(1, round(img.height * SCALE))), Image.LANCZOS)


def pad(img, wrap_axis=None):
    """Surround a piece with PAD px: wrapped round for a repeating tile, edge colour otherwise."""
    a = np.asarray(img).astype(np.float32)
    mode = ['edge', 'edge']
    if wrap_axis == 'x':
        a = np.concatenate([a[:, -PAD:], a, a[:, :PAD]], 1)
        a = np.pad(a, ((PAD, PAD), (0, 0), (0, 0)), mode='edge')
    elif wrap_axis == 'y':
        a = np.concatenate([a[-PAD:], a, a[:PAD]], 0)
        a = np.pad(a, ((0, 0), (PAD, PAD), (0, 0)), mode='edge')
    else:
        a = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='edge')
    # Padding outside a non-repeating piece is see-through.
    if wrap_axis != 'x':
        a[:, :PAD, 3] = 0
        a[:, -PAD:, 3] = 0
    if wrap_axis != 'y':
        a[:PAD, :, 3] = 0
        a[-PAD:, :, 3] = 0
    return a


def pack(items, width):
    """Shelf packing: tallest first. Returns the atlas height and each item's (x, y)."""
    order = sorted(range(len(items)), key=lambda i: -items[i].shape[0])
    x = y = shelf = 0
    at = {}
    for i in order:
        h, w = items[i].shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        at[i] = (x, y)
        x += w
        shelf = max(shelf, h)
    return y + shelf, at


def main():
    rgb, alpha = rgba_source()
    rgb, alpha, edges = straighten(rgb, alpha)
    if TILE_MASK:
        # See-through over the picture's tiles, fading in over TILE_FADE px outside their outline.
        x0, x1, y0, y1 = TILE_MASK
        yy, xx = np.mgrid[:alpha.shape[0], :alpha.shape[1]]
        out = np.maximum(np.maximum(x0 - xx, xx - x1), np.maximum(y0 - yy, yy - y1))
        alpha = alpha * np.clip(out / TILE_FADE, 0, 1)
    rgb = bleed(rgb, alpha)
    items, meta = [], []

    for name, box in CORNERS.items():
        piece = cut(rgb, alpha, box)
        top, left = name[0] == 't', name[1] == 'l'
        # A corner fades where it meets the straight sides: along x on its inner end, along y likewise.
        piece = fade_ends(piece, 'x', start=not left, end=left)
        piece = fade_ends(piece, 'y', start=not top, end=top)
        items.append(pad(to_image(piece)))
        meta.append({'name': name, 'kind': 'corner', 'src': list(box)})

    for side, spec in SIDES.items():
        for p in spec['pieces']:
            # The right braid also lines the left side, mirrored and moved in (mirrorShift), so it
            # is cut closer to its inside to stay clear of the tiles there.
            a0, a1 = p.get('across', spec['across'])
            s0, s1 = p['span']
            box = (s0, a0, s1, a1) if spec['axis'] == 'x' else (a0, s0, a1, s1)
            piece = cut(rgb, alpha, box)
            if p['kind'] == 'tile':
                piece = periodic(piece, spec['axis'])
                items.append(pad(to_image(piece), spec['axis']))
                n = (s1 - s0) - FADE
                meta.append({'name': p['name'], 'kind': 'tile', 'side': side, 'src': list(box), 'period': n})
            else:
                piece = fade_ends(piece, spec['axis'], True, True)
                items.append(pad(to_image(piece)))
                meta.append({'name': p['name'], 'kind': 'decor', 'side': side, 'src': list(box)})

    width = 1024
    height, at = pack(items, width)
    height = int(np.ceil(height / 4) * 4)
    atlas = np.zeros((height, width, 4), np.float32)
    for i, item in enumerate(items):
        x, y = at[i]
        h, w = item.shape[:2]
        atlas[y:y + h, x:x + w] = item
        meta[i]['atlas'] = [x + PAD, y + PAD, w - 2 * PAD, h - 2 * PAD]
    out = Image.fromarray(np.clip(atlas, 0, 255).astype(np.uint8), 'RGBA')
    out.save(os.path.join(HERE, OUT), 'WEBP', quality=QUALITY, alpha_quality=90, method=6, exact=True)
    # The grass bed has its own script now: ../bed/build-bed.py

    with open(DATA) as f:
        data = json.load(f)
    data[KEY] = {
        '$comment': f'Written by assets/turnflock/garden/board/rim/build-rim.py. Source px are in {SOURCE} (1254 px square); atlas px in {OUT}.',
        'size': [width, height],
        'scale': SCALE,
        'fade': FADE,
        'inner': list(INNER),
        # The left side repeats the right side's braid mirrored; this many source px inward lines
        # its outside up with the left side's own outside.
        'mirrorShift': round((edges['right'] - INNER[1]) - (INNER[0] - edges['left']), 1),
        'pieces': meta,
    }
    with open(DATA, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')
    for f in (OUT,):
        print(f, round(os.path.getsize(os.path.join(HERE, f)) / 1024, 1), 'kB')
    print('atlas', width, 'x', height)


if __name__ == '__main__':
    main()

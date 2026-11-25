"""Cut the garden effects out of the owner's effects sheet.

Reads  design/reference/turnflock/garden/21-sheet-effects.png (242x76, white background)
Writes production/qa/evidence/garden-effects/cut-4x/ (first version; the game now uses the 8x
       redraws in assets/turnflock/garden/effects/, made by tools/asset-pipeline/garden-effects-hd/,
       with the same framing; these cuts stay as the baseline they are compared with)
       beam.webp        green beam on its ring
       star.webp        one star (the large lower-left one), to fly as many
       twinkle.webp     one small four-pointed twinkle
       cloud.webp       the whole cloud puff
       cloud-ball.webp  one ball of the cloud (the front one), to drift apart as many
       ring.webp        the blue ring

The sheet has no transparency: every piece sits on white. The white is taken
out in two ways. Solid parts (stars, cloud, the beam's ring and pad, the blue
ring's body) are found as everything not connected to the white border and
kept fully opaque, with a one-pixel soft edge ("not connected" is measured
through pixels that are nearly white for solids, through pale pixels for the
blue ring, whose halo must stay see-through). Glows and light (the beam's
column, the halo round the blue ring, the soft edge of the twinkles) are
"colour to alpha" against white: a pixel keeps the colour it would need to
have over white, with the alpha that makes it look the same there, so it
blends as light over the lawn instead of as a pale patch.

The sheet is small (each piece about 60 px), so the pieces are enlarged
SCALE times with Lanczos on premultiplied colour (no dark or white fringe)
and a mild unsharp mask. That gives clean edges but cannot add detail the
sheet does not have: a larger original is needed for full sharpness.

Run from the repo root:  python3 tools/asset-pipeline/cut-garden-effects.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
from collections import deque
import os

import numpy as np
from PIL import Image, ImageFilter

SRC = 'design/reference/turnflock/garden/21-sheet-effects.png'
OUT = 'production/qa/evidence/garden-effects/cut-4x/'
SCALE = 4          # enlargement of the stored pieces
QUALITY = 84       # WebP quality

# Boxes in sheet pixels: (left, top, right, bottom), right and bottom exclusive.
PIECES = {
    'beam':       {'box': (0, 3, 64, 72),    'mode': 'beam'},
    'star':       {'box': (66, 32, 99, 66), 'mode': 'solid', 'seed': (83, 50), 'limit': 0.4, 'within': (83.5, 48.5, 16.5)},
    'twinkle':    {'box': (96, 9, 109, 23),  'mode': 'glow'},
    'cloud':      {'box': (119, 6, 175, 66), 'mode': 'solid', 'seed': (148, 36), 'limit': 0.012, 'peel': (0.16, 4), 'within': (147.5, 35.5, 30.5)},
    'cloud-ball': {'box': (133, 38, 157, 62), 'mode': 'circle', 'circle': (145.2, 49.6, 9.9)},
    'ring':       {'box': (176, 4, 242, 72), 'mode': 'ring', 'hole': (207, 36)},
}
# The beam's ring and pad: an ellipse in sheet pixels (centre x, centre y, half width, half height).
BEAM_RING = (32.5, 51.5, 25.8, 11.6)


def light_region(soft: np.ndarray, limit: float, extra_seeds=()) -> np.ndarray:
    """Pixels at most `limit` away from white (colour-to-alpha) that connect to the crop's border or to `extra_seeds`."""
    h, w = soft.shape
    light = soft <= limit
    region = np.zeros((h, w), bool)
    queue = deque()
    seeds = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)] + list(extra_seeds)
    for x, y in seeds:
        if 0 <= x < w and 0 <= y < h and light[y, x] and not region[y, x]:
            region[y, x] = True
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and light[ny, nx] and not region[ny, nx]:
                region[ny, nx] = True
                queue.append((nx, ny))
    return region


def component(mask: np.ndarray, seed) -> np.ndarray:
    """The 8-connected part of `mask` that holds `seed`."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    x0, y0 = seed
    queue = deque([(x0, y0)])
    out[y0, x0] = True
    while queue:
        x, y = queue.popleft()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not out[ny, nx]:
                    out[ny, nx] = True
                    queue.append((nx, ny))
    return out


def colour_to_alpha(rgb: np.ndarray) -> np.ndarray:
    """Alpha a pixel needs to look as it does over white: how far its farthest channel is from white."""
    return (255 - rgb).max(axis=2) / 255.0


def feather(mask: np.ndarray) -> np.ndarray:
    """A hard mask with a one-pixel soft edge (average over the 3x3 neighbourhood)."""
    m = mask.astype(float)
    p = np.pad(m, 1, mode='edge')
    s = sum(p[1 + dy:1 + dy + m.shape[0], 1 + dx:1 + dx + m.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    return np.maximum(m * 0.0 + s, 0)


def cut(name: str, spec: dict, sheet: np.ndarray) -> Image.Image:
    l, t, r, b = spec['box']
    rgb = sheet[t:b, l:r, :3].astype(float)
    h, w, _ = rgb.shape
    soft = colour_to_alpha(rgb)
    mode = spec['mode']
    if mode == 'glow':
        alpha = soft
    elif mode == 'solid':
        # Background: near-white reachable from the border. Everything it encloses (white
        # highlights on the cloud's balls too) is body; of that, the part holding `seed`.
        bg = light_region(soft, spec.get('limit', 0.03))
        sx, sy = spec['seed']
        body = component(~bg, (sx - l, sy - t))
        if 'within' in spec:
            # Only what lies within this circle (sheet pixels): keeps a neighbouring star's tip out.
            cx, cy, rad = spec['within']
            yy, xx = np.mgrid[0:h, 0:w]
            body = body & (np.hypot(xx + 0.5 + l - cx, yy + 0.5 + t - cy) <= rad)
        if 'peel' in spec:
            # Peel the faint haze off the outside, a pixel at a time, stopping at the outline.
            limit, steps = spec['peel']
            for _ in range(steps):
                p = np.pad(body, 1)
                edge = body & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
                body = body & ~(edge & (soft < limit))
        # Solid body opaque with a one-pixel soft edge. The faint warm or grey haze round it on
        # the sheet is left out: over the lawn it would show as a pale rim.
        alpha = np.maximum(body * 1.0, feather(body))
    elif mode == 'circle':
        cx, cy, rad = spec['circle']
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.hypot(xx + 0.5 + l - cx, yy + 0.5 + t - cy)
        alpha = np.clip(rad - d + 0.5, 0, 1)
    elif mode == 'beam':
        cx, cy, ax, ay = BEAM_RING
        yy, xx = np.mgrid[0:h, 0:w]
        e = np.hypot((xx + 0.5 + l - cx) / ax, (yy + 0.5 + t - cy) / ay)
        ring = np.clip((1.0 - e) * ax + 0.5, 0, 1)  # ~1 px soft edge on the ellipse
        alpha = np.maximum(soft, ring)
    elif mode == 'ring':
        # The deep-blue body and the white streaks it encloses are opaque; the halo outside it
        # and the light in the hole (reached from the border and the hole's centre through
        # pale pixels) stay light.
        hx, hy = spec['hole']
        bg = light_region(soft, spec.get('limit', 0.55), [(hx - l, hy - t)])
        alpha = np.maximum(soft, feather(~bg) * ~bg)
    else:
        raise ValueError(mode)
    alpha = np.clip(alpha, 0, 1)
    # The colour a pixel must have, at this alpha, to look as it does over white.
    a = np.maximum(alpha, 1e-4)[..., None]
    colour = np.clip((rgb - 255.0 * (1 - a)) / a, 0, 255)
    colour = np.where(alpha[..., None] > 0, colour, 255.0)
    return enlarge(colour, alpha)


def enlarge(colour: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """Lanczos on premultiplied colour, then a mild unsharp mask, back to straight alpha."""
    h, w = alpha.shape
    size = (w * SCALE, h * SCALE)
    pre = colour * alpha[..., None]
    chans = [Image.fromarray(pre[..., i].astype(np.float32), 'F').resize(size, Image.LANCZOS) for i in range(3)]
    a = Image.fromarray((alpha * 255).astype(np.float32), 'F').resize(size, Image.LANCZOS)
    pre_img = Image.merge('RGB', [c.convert('L') for c in chans])
    a_img = a.convert('L')
    pre_img = pre_img.filter(ImageFilter.UnsharpMask(radius=SCALE * 0.6, percent=45, threshold=1))
    a_img = a_img.filter(ImageFilter.UnsharpMask(radius=SCALE * 0.5, percent=30, threshold=1))
    p = np.asarray(pre_img).astype(float)
    av = np.asarray(a_img).astype(float) / 255.0
    straight = np.clip(p / np.maximum(av, 1e-3)[..., None], 0, 255)
    straight = np.where(av[..., None] > 0.004, straight, 0)
    rgba = np.dstack([straight, av * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def main() -> None:
    sheet = np.asarray(Image.open(SRC).convert('RGBA'))
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, spec in PIECES.items():
        img = cut(name, spec, sheet)
        path = os.path.join(OUT, name + '.webp')
        img.save(path, 'WEBP', quality=QUALITY, alpha_quality=95, method=6)
        kb = os.path.getsize(path) / 1024
        total += kb
        print(f'{path}: {img.width}x{img.height}, {kb:.1f} kB')
    print(f'total {total:.1f} kB')


if __name__ == '__main__':
    main()

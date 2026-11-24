"""Paint the garden star and twinkle at high resolution, from geometry and colours read off the owner's sheet.

Writes assets/turnflock/garden/effects/
       star.webp     264x272  one puffy star (the large lower-left one of the sheet's star group)
       twinkle.webp  104x112  one small four-pointed twinkle
and    production/qa/evidence/garden-effects/hd-stars-compare.png (side-by-side check)

The sheet (design/reference/turnflock/garden/21-sheet-effects.png, 242x76) holds the
star at about 33 px, so enlarging it cannot be sharp. Instead the pictures are
painted anew at 8x the sheet scale, with the same framing as the old cuts made by
tools/asset-pipeline/cut-garden-effects.py (star: sheet box 66,32-99,66; twinkle:
sheet box 96,9-109,23), so the game config keeps working.

Star: the outline is a five-pointed polygon fitted to the sheet's outline (least
squares on the sub-pixel orange edge), opened with radius STAR['round_tip'] (round
tips) and closed with STAR['round_notch'] (round notches), as an exact signed
distance field. Colours are painted from that distance: thick orange rim (thicker
at the bottom: the face is the shape eroded and lifted, giving the 3-D edge),
lemon face with a vertical gradient, pale bevel light on upward-facing edges, a
white sheen in the top arm, a faint warm glow and a soft dark drop shadow (both
semi-transparent, so nothing pale shows over the lawn). Edges are anti-aliased
from the distance field.

Twinkle: a four-pointed astroid with a white core and a soft yellow glow, drawn
as light (semi-transparent), supersampled 4x.

Run from the repo root:  python3 tools/asset-pipeline/garden-effects-hd/star.py
Needs Pillow and numpy only. Deterministic; re-runnable.
"""
import os

import numpy as np
from PIL import Image, ImageDraw

SHEET = 'design/reference/turnflock/garden/21-sheet-effects.png'
OUT = 'assets/turnflock/garden/effects/'
EVIDENCE = 'production/qa/evidence/garden-effects/hd-stars-compare.png'
SCALE = 8
QUALITY = 90
LAWN = (139, 203, 79)

STAR_BOX = (66, 32, 99, 66)
TWINKLE_BOX = (96, 9, 109, 23)

# Star geometry in sheet pixels (continuous; pixel i spans [i, i+1]). Symmetric about AXIS.
AXIS = 83.5
STAR = {
    # polygon: top tip y; side tip dx, y; bottom tip dx, y; upper notch dx, y; lower side notch dx, y; bottom notch y
    'top': 32.96, 'side': (14.58, 44.61), 'bottom': (9.17, 60.91),
    'upper_notch': (6.68, 40.62), 'side_notch': (9.17, 51.45), 'bottom_notch': 57.25,
    'round_tip': 2.51, 'round_notch': 1.1, 'grow': 0.35,
    'face_inset': 1.6, 'face_lift': 0.95,   # face = shape eroded by inset, lifted by lift: rim ~0.8 top, ~2.3 bottom
    'sheen': (83.45, 37.8, 1.3, 2.0),       # white sheen ellipse in the top arm: cx, cy, rx, ry
    'glow': (0.32, 1.3),                     # warm glow: peak alpha, falloff (sheet px)
    'shadow': (2.0, 2.2, 0.55),              # drop shadow: offset down, softness, peak alpha
}
COL = {
    'rim_edge': (232, 124, 8), 'rim': (249, 154, 4), 'rim_gold': (251, 196, 6),
    'face_top': (254, 249, 150), 'face_mid': (253, 248, 38), 'face_low': (253, 236, 6), 'face_bottom': (252, 206, 6),
    'face_edge': (252, 212, 6), 'bevel': (254, 251, 205), 'sheen': (255, 253, 238),
    'glow': (253, 224, 72), 'shadow': (108, 96, 36),
}
TWINKLE = {'centre': (101.5, 16.55), 'half': (4.0, 4.6), 'power': 0.8, 'core': 0.85,
           'glow': (0.55, 2.0), 'arm': (253, 237, 58), 'core_col': (255, 253, 222), 'glow_col': (255, 228, 70)}


# ---------- distance fields ----------

def polygon_sdf(px, py, poly):
    """Signed distance from points to a closed polygon (negative inside)."""
    d = np.full(px.shape, np.inf)
    inside = np.zeros(px.shape, bool)
    for i in range(len(poly)):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % len(poly)]
        ex, ey = bx - ax, by - ay
        t = np.clip(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1)
        d = np.minimum(d, np.hypot(px - ax - t * ex, py - ay - t * ey))
        inside ^= ((ay > py) != (by > py)) & (px < ax + (py - ay) * ex / (ey + 1e-12))
    return np.where(inside, -d, d)


def exact_sdf(field, X, Y):
    """Exact signed distance to the zero contour of `field` (sub-pixel contour points, brute force)."""
    xs, ys = X[0], Y[:, 0]
    pts = []
    for a, b, horiz in ((field[:, :-1], field[:, 1:], True), (field[:-1, :], field[1:, :], False)):
        r, c = np.nonzero((a < 0) != (b < 0))
        t = a[r, c] / (a[r, c] - b[r, c])
        if horiz:
            pts.append(np.stack([xs[c] + t * (xs[c + 1] - xs[c]), ys[r]], 1))
        else:
            pts.append(np.stack([xs[c], ys[r] + t * (ys[r + 1] - ys[r])], 1))
    P = np.concatenate(pts)
    flat = np.stack([X.ravel(), Y.ravel()], 1)
    out = np.empty(len(flat))
    for i in range(0, len(flat), 2048):
        q = flat[i:i + 2048]
        out[i:i + 2048] = np.sqrt(((q[:, None, :] - P[None, :, :]) ** 2).sum(-1).min(1))
    out = out.reshape(field.shape)
    return np.where(field < 0, -out, out)


def star_sdf(X, Y):
    """Distance field of the rounded star (sheet px)."""
    s = STAR
    sx, sy = s['side']; bx, by = s['bottom']; ux, uy = s['upper_notch']; wx, wy = s['side_notch']
    c = AXIS
    poly = [(c, s['top']), (c + ux, uy), (c + sx, sy), (c + wx, wy), (c + bx, by), (c, s['bottom_notch']),
            (c - bx, by), (c - wx, wy), (c - sx, sy), (c - ux, uy)]
    d = polygon_sdf(X, Y, poly)
    r, k = s['round_tip'], s['round_notch']
    d = exact_sdf(d + r, X, Y) - r
    d = exact_sdf(d - k, X, Y) + k
    return d - s['grow']


def grid(box, scale, ss=1):
    """Sheet coordinates of output pixel centres for a sheet box at `scale` (optionally supersampled)."""
    l, t, r, b = box
    n = scale * ss
    xs = l + (np.arange((r - l) * n) + 0.5) / n
    ys = t + (np.arange((b - t) * n) + 0.5) / n
    return np.meshgrid(xs, ys)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return a + (b - a) * t[..., None]


def col(name):
    return np.array(COL[name], float)


def over(dst_c, dst_a, src_c, src_a):
    """Straight-alpha 'over'."""
    a = src_a + dst_a * (1 - src_a)
    c = (src_c * src_a[..., None] + dst_c * (dst_a * (1 - src_a))[..., None]) / np.maximum(a, 1e-6)[..., None]
    return c, a


# ---------- star ----------

def paint_star():
    X, Y = grid(STAR_BOX, SCALE)
    px = 1.0 / SCALE                     # one output pixel in sheet px
    d = star_sdf(X, Y)
    s = STAR
    df = star_sdf(X, Y + s['face_lift']) + s['face_inset']      # face edge
    ds = star_sdf(X, Y - s['shadow'][0])                         # shadow shape

    # face colour: vertical gradient
    face = mix(col('face_top'), col('face_mid'), smooth(36.0, 43.5, Y))
    face = mix(face, col('face_low'), smooth(44.0, 51.0, Y))
    face = mix(face, col('face_bottom'), smooth(51.0, 56.5, Y))
    face = mix(face, col('face_edge'), smooth(-0.55, 0.0, df) * smooth(42.0, 50.0, Y) * 0.8)
    # bevel light along upward-facing face edges
    gy, gx = np.gradient(df)
    n = np.hypot(gx, gy) + 1e-9
    up = np.clip(-gy / n, 0, 1) ** 1.3
    bevel = np.exp(-((-df - 0.42) / 0.33) ** 2) * up * (df < 0.1)
    face = mix(face, col('bevel'), np.clip(bevel * 0.9, 0, 1))
    cx, cy, rx, ry = s['sheen']
    e = np.hypot((X - cx) / rx, (Y - cy) / ry)
    face = mix(face, col('sheen'), smooth(1.0, 0.45, e) * 0.97)

    # rim colour: gold next to the face, orange, darker at the outer edge
    u = -d
    rim = mix(col('rim_gold'), col('rim'), smooth(0.0, 0.75, df))
    rim = mix(rim, col('rim_edge'), smooth(0.75, 0.0, u) * 0.55)
    rim = mix(rim, col('rim_edge'), smooth(53.0, 59.0, Y) * smooth(0.2, 1.2, df) * 0.5)

    body_c = mix(rim, face, np.clip(0.5 - df / px, 0, 1))
    body_a = np.clip(0.5 - d / px, 0, 1)

    # shadow and glow (semi-transparent, behind the body)
    off, soft, peak = s['shadow']
    sh_a = peak * smooth(soft, -soft * 0.6, ds) * smooth(44.0, 54.0, Y)
    gpk, gfall = s['glow']
    gl_a = gpk * np.exp(-np.maximum(d, 0) / gfall) * (d > -0.5)
    c = np.zeros(X.shape + (3,)); a = np.zeros(X.shape)
    c, a = over(c, a, np.broadcast_to(col('shadow'), c.shape), sh_a)
    c, a = over(c, a, np.broadcast_to(col('glow'), c.shape), gl_a)
    c, a = over(c, a, body_c, body_a)
    return c, a


# ---------- twinkle ----------

def paint_twinkle(ss=4):
    X, Y = grid(TWINKLE_BOX, SCALE, ss)
    t = TWINKLE
    cx, cy = t['centre']; hx, hy = t['half']; p = t['power']
    dx, dy = np.abs(X - cx), np.abs(Y - cy)
    f = (dx / hx) ** p + (dy / hy) ** p                     # astroid: f < 1 inside the four points
    r = np.hypot(dx / hx * 4.0, dy / hy * 4.0) / 4.0        # elliptical radius (sheet px-ish)
    gpk, gfall = t['glow']
    glow_a = gpk * np.exp(-np.hypot(dx, dy) / gfall)
    arm_a = np.clip((1.0 - f) * 3.2, 0, 1) * (1 - 0.35 * smooth(0.3, 1.0, r / 4.0))
    core_a = smooth(t['core'], t['core'] * 0.35, np.hypot(dx, dy))
    c = np.zeros(X.shape + (3,)); a = np.zeros(X.shape)
    c, a = over(c, a, np.broadcast_to(np.array(t['glow_col'], float), c.shape), glow_a)
    c, a = over(c, a, np.broadcast_to(np.array(t['arm'], float), c.shape), arm_a)
    c, a = over(c, a, np.broadcast_to(np.array(t['core_col'], float), c.shape), core_a)
    # box-filter the supersampling on premultiplied colour
    h, w = a.shape
    pm = np.concatenate([c * a[..., None], a[..., None]], -1).reshape(h // ss, ss, w // ss, ss, 4).mean((1, 3))
    a = pm[..., 3]
    c = pm[..., :3] / np.maximum(a, 1e-6)[..., None]
    return c, a


# ---------- output ----------

def to_image(c, a):
    rgba = np.concatenate([np.clip(c, 0, 255), np.clip(a, 0, 1)[..., None] * 255], -1)
    rgba[rgba[..., 3] < 0.5] = 0
    return Image.fromarray(np.round(rgba).astype(np.uint8), 'RGBA')


def on(img, bg):
    base = Image.new('RGBA', img.size, bg + (255,))
    base.alpha_composite(img)
    return base.convert('RGB')


def downscale(img, size):
    """Box-filter downscale to the sheet size, on premultiplied colour."""
    arr = np.asarray(img, float) / 255
    k = img.width // size[0]
    pm = np.concatenate([arr[..., :3] * arr[..., 3:], arr[..., 3:]], -1)
    pm = pm.reshape(size[1], k, size[0], k, 4).mean((1, 3))
    a = pm[..., 3:]
    rgb = pm[..., :3] / np.maximum(a, 1e-6)
    return Image.fromarray(np.round(np.concatenate([rgb, a], -1) * 255).astype(np.uint8), 'RGBA')


def evidence(sheet, star, twinkle):
    """Four rows: original 8x smooth | new on white | new on lawn | sheet-size new vs original (zoomed nearest)."""
    pad, gap = 16, 24
    so = sheet.crop(STAR_BOX); to = sheet.crop(TWINKLE_BOX)
    up = lambda im: im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
    rows = [
        ('original crops, 8x smooth', [up(so), up(to)]),
        ('new, on white', [on(star, (255, 255, 255)), on(twinkle, (255, 255, 255))]),
        ('new, on lawn #8BCB4F', [on(star, LAWN), on(twinkle, LAWN)]),
    ]
    ss_ = on(downscale(star, so.size), (255, 255, 255)); ts_ = on(downscale(twinkle, to.size), (255, 255, 255))
    z = 4
    nn = lambda im: im.resize((im.width * z, im.height * z), Image.NEAREST)
    rows.append(('sheet size, shown 4x nearest: original | new (star), original | new (twinkle)',
                 [nn(so), nn(ss_), nn(to), nn(ts_)]))
    rows.append(('sheet size, 1:1: original | new', [so, ss_, to, ts_]))
    W = max(sum(i.width for i in r[1]) + gap * (len(r[1]) - 1) for r in rows) + 2 * pad
    H = sum(max(i.height for i in r[1]) + 22 for r in rows) + gap * (len(rows) - 1) + 2 * pad
    canvas = Image.new('RGB', (W, H), (236, 236, 240))
    dr = ImageDraw.Draw(canvas)
    y = pad
    for label, ims in rows:
        dr.text((pad, y), label, fill=(30, 30, 30))
        y += 18
        x = pad
        for im in ims:
            canvas.paste(im, (x, y)); x += im.width + gap
        y += max(i.height for i in ims) + 4 + gap
    os.makedirs(os.path.dirname(EVIDENCE), exist_ok=True)
    canvas.save(EVIDENCE)


def main():
    sheet = Image.open(SHEET).convert('RGB')
    star = to_image(*paint_star())
    twinkle = to_image(*paint_twinkle())
    assert star.size == (264, 272) and twinkle.size == (104, 112)
    os.makedirs(OUT, exist_ok=True)
    for name, img in (('star', star), ('twinkle', twinkle)):
        path = OUT + name + '.webp'
        img.save(path, 'WEBP', quality=QUALITY, alpha_quality=90, method=6, exact=False)
        print(f'{path}: {img.size[0]}x{img.size[1]}, {os.path.getsize(path) / 1024:.1f} kB')
    evidence(sheet, Image.open(OUT + 'star.webp').convert('RGBA'), Image.open(OUT + 'twinkle.webp').convert('RGBA'))
    print('evidence:', EVIDENCE)


if __name__ == '__main__':
    main()

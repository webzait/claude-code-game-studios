"""Build the layered harbour backdrop from the owner's original image.

Reads  design/reference/turnflock/source/harbor-original.png (1086x1448)
Writes assets/turnflock/bg/harbor-left.webp   left quay: house, crates, crane, ship
       assets/turnflock/bg/harbor-right.webp  right quay: house, boat
       assets/turnflock/bg/water-glints.webp  white highlights only, transparent

The sky and the water themselves are CSS gradients (src/parts/parts.css,
.tf-bg). The two quay pictures are regraded so their own sky and water match
those gradients, softly blurred, and faded to transparent at the edges, so
they can be anchored to the screen edges at any screen shape.

Run from the repo root:  python3 tools/asset-pipeline/build-backdrop.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
from PIL import Image, ImageFilter
import numpy as np

SRC = 'design/reference/turnflock/source/harbor-original.png'
OUT = 'assets/turnflock/bg/'

HORIZON = 520            # row of the waterline in the original
TOP, BOTTOM = 0, 800     # rows kept in the quay pictures (the last 120 are fully transparent: room for the fade)
LEFT = (0, 560)          # columns of the left picture
RIGHT = (600, 1086)      # columns of the right picture
SCALE = 0.75             # output size relative to the original
BLUR = 2.6               # out-of-focus radius, in original pixels

# The owner's palette; the same stops as the CSS gradients in .tf-bg.
SKY = [(0.0, '#4EAFF8'), (0.55, '#76C8FF'), (1.0, '#CBEFFF')]            # 0 = top, 1 = horizon
WATER = [(0.0, '#93DFFA'), (0.12, '#6FD5F7'), (0.54, '#4FC4EE')]         # in units of the horizon height, below it


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def ramp(stops, t):
    """Colour of a gradient at positions t (array)."""
    xs = [s[0] for s in stops]
    cols = np.array([rgb(s[1]) for s in stops])
    return np.stack([np.interp(t, xs, cols[:, c]) for c in range(3)], axis=-1)


def smooth(a, n):
    k = np.ones(n) / n
    pad = np.pad(a, ((n // 2, n // 2), (0, 0)), mode='edge')
    return np.stack([np.convolve(pad[:, c], k, mode='valid') for c in range(3)], axis=-1)[: len(a)]


def smoothstep(lo, hi, x):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


src = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
H, W, _ = src.shape

# The original's own sky and water colour per row, from columns with no objects.
back = np.zeros((H, 3))
for y in range(H):
    cols = src[y, 500:700] if y < 440 or y >= HORIZON + 6 else src[y, 20:60]
    back[y] = np.median(cols, axis=0)
back[440:HORIZON] = back[436] + (np.array([150, 226, 253]) - back[436]) * np.linspace(0, 1, HORIZON - 440)[:, None]
back[:HORIZON] = smooth(back[:HORIZON], 15)
back[HORIZON:] = smooth(back[HORIZON:], 31)

# What those rows should be: the CSS gradients.
rows = np.arange(H)
target = np.where((rows < HORIZON)[:, None], ramp(SKY, rows / HORIZON), ramp(WATER, (rows - HORIZON) / HORIZON))

# Move sky and water to the palette; leave the objects (far from the row colour) as painted.
dist = np.linalg.norm(src - back[:, None, :], axis=2)
skyness = 1 - smoothstep(18, 70, dist)
graded = np.clip(src + skyness[..., None] * (target - back)[:, None, :], 0, 255)
# A light veil of horizon haze over everything, strongest at the waterline: reads as distance.
haze = 0.16 * np.exp(-((rows - HORIZON) / 120.0) ** 2)
graded = graded * (1 - haze[:, None, None]) + rgb('#CBEFFF') * haze[:, None, None]


def quay(name, x0, x1, inner):
    part = graded[TOP:BOTTOM, x0:x1]
    h, w, _ = part.shape
    alpha = np.ones((h, w))
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]
    alpha = alpha * smoothstep(0, 70, yy) * (1 - smoothstep(h - 215, h - 125, yy))  # gone before the near pier's bollard
    if inner == 'right':
        alpha = alpha * (1 - smoothstep(w - 90, w - 4, xx))
    else:
        alpha = alpha * smoothstep(4, 90, xx)
    img = Image.fromarray(np.dstack([part, alpha * 255]).astype(np.uint8), 'RGBA')
    # Blur colour and alpha together (premultiplied by Pillow's RGBA blur is not; edges are already soft).
    img = img.filter(ImageFilter.GaussianBlur(BLUR))
    img = img.resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
    img.save(OUT + name, 'WEBP', quality=84, alpha_quality=80, method=6)
    print(name, img.size)


quay('harbor-left.webp', *LEFT, inner='right')
quay('harbor-right.webp', *RIGHT, inner='left')

# Water highlights: how much brighter a pixel is than its row, as white with transparency.
y0 = 930
lum = src[y0:].mean(axis=2)
base = np.median(lum, axis=1)
base = np.convolve(np.pad(base, 20, mode='edge'), np.ones(41) / 41, mode='valid')
glint = smoothstep(4, 60, lum - base[:, None])
yy = np.arange(glint.shape[0])[:, None]
glint = glint * smoothstep(0, 80, yy) * (1 - smoothstep(glint.shape[0] - 90, glint.shape[0] - 6, yy))
white = np.empty(glint.shape + (4,))
white[..., :3] = rgb('#F2FCFF')
white[..., 3] = glint * 255
img = Image.fromarray(white.astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(2.2))
img = img.resize((W // 2, glint.shape[0] // 2), Image.LANCZOS)
img.save(OUT + 'water-glints.webp', 'WEBP', quality=60, alpha_quality=55, method=6)
print('water-glints.webp', img.size)

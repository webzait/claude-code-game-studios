"""Make the garden theme's loose gem and heart icons from the owner's pictures.

Reads  design/reference/turnflock/garden/elements/diamant.png, hart.png (transparent, about 1300 px)
Writes src/ui/themes/garden/gem.webp, heart.webp (WebP with alpha)

Both are loose parts: the game has no gem or heart yet, and the owner decides what they mean
(design/themes/garden-buttons.md). The owner's picture is the part; this only cleans and shrinks it:
  - alpha below NOISE is set to fully transparent: the cut-outs carry faint specks far outside the shape;
  - the picture is cropped to the shape plus a small margin and padded to a square, so the shape sits centred;
  - it is shrunk premultiplied (RGBa), so no dark or light fringe appears along the edge;
  - SIZE is about twice the largest size an icon is shown at on a phone (64 CSS px on the win pop-up).

Run from the repo root:  python3 tools/asset-pipeline/garden-icons.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
import os

import numpy as np
from PIL import Image

SRC = 'design/reference/turnflock/garden/elements/'
OUT = 'src/ui/themes/garden/'
PIECES = {'diamant': 'gem', 'hart': 'heart'}
NOISE = 8          # alpha (0-255) below which a pixel is a speck, not part of the shape
MARGIN = 0.04      # free space round the shape, as a share of its longest side
SIZE = 128         # output square, in pixels
QUALITY = 92       # WebP quality for the colour; alpha is kept losslessly


def make(name: str) -> str:
    rgba = np.array(Image.open(SRC + name + '.png').convert('RGBA'))
    rgba[rgba[..., 3] < NOISE] = 0
    ys, xs = np.where(rgba[..., 3] > 0)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * MARGIN))
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(Image.fromarray(rgba).crop((x0, y0, x1, y1)), ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
    small = square.convert('RGBa').resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
    path = OUT + PIECES[name] + '.webp'
    small.save(path, 'WEBP', quality=QUALITY, alpha_quality=100, method=6)
    return path


if __name__ == '__main__':
    for piece in PIECES:
        out = make(piece)
        print(f'{out}: {os.path.getsize(out) / 1024:.1f} kB')

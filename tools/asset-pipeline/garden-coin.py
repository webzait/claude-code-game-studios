#!/usr/bin/env python3
"""Cut the garden theme's star coin out of the owner's picture.

Reads  design/reference/turnflock/garden/elements/stermunt.png  (1261 x 1247, transparent)
Writes assets/turnflock/garden/coin/star-coin.webp        (LARGE px square: every coin place)
       assets/turnflock/garden/coin/star-coin-small.webp  (SMALL px square: the price tags)

The owner's picture is the coin: nothing is drawn. Steps:
1. Alpha below NOISE (a faint haze around the coin) becomes 0, and the coin's
   inside, which the source leaves at alpha 252-253, becomes fully opaque, so
   no background shows through the gold.
2. The colour of the soft outer ring is already the coin's orange (measured:
   no white or grey mixed in), so the edge is kept as it is: no halo on light
   or dark.
3. Cropped tight to the coin and padded to a square with the coin centred, like
   assets/turnflock/ui/coin.webp, so both themes' coins fill the same box.
4. Scaled with premultiplied alpha (no dark fringe). The small cut gets a light
   unsharp mask so the star's outline stays crisp at 24 CSS px.

Run from the repo root:  python3 tools/asset-pipeline/garden-coin.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path('design/reference/turnflock/garden/elements/stermunt.png')
OUT = Path('assets/turnflock/garden/coin')
LARGE = 96   # px: about twice the biggest coin in the game (win pop-up reward, 40 CSS px)
SMALL = 48   # px: twice the price tag's coin (24-32 CSS px)
NOISE = 8    # alpha below this is haze, not coin
SOLID = 250  # alpha at or above this is the coin's inside
PAD = 0.01   # empty border around the coin, as a share of the side


def clean(src: Image.Image) -> Image.Image:
    """Steps 1-3: clean alpha and a centred square crop."""
    px = np.array(src.convert('RGBA')).astype(np.float64)
    a = px[..., 3]
    a[a < NOISE] = 0
    a[a >= SOLID] = 255
    px[..., 3] = a
    ys, xs = np.nonzero(a)
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    side = int(round(max(bottom - top, right - left) * (1 + 2 * PAD)))
    out = np.zeros((side, side, 4))
    oy, ox = (side - (bottom - top)) // 2, (side - (right - left)) // 2
    out[oy:oy + bottom - top, ox:ox + right - left] = px[top:bottom, left:right]
    return Image.fromarray(out.round().astype(np.uint8), 'RGBA')


def scaled(img: Image.Image, size: int, sharpen: bool) -> Image.Image:
    """Step 4: premultiplied resize (and for the small cut a light sharpen of colour only)."""
    small = img.convert('RGBa').resize((size, size), Image.Resampling.LANCZOS)
    if sharpen:
        r, g, b, a = small.split()
        rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=1))
        small = Image.merge('RGBa', (*rgb.split(), a))
    return small.convert('RGBA')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    coin = clean(Image.open(SRC))
    for name, size, sharpen in (('star-coin', LARGE, False), ('star-coin-small', SMALL, True)):
        path = OUT / f'{name}.webp'
        scaled(coin, size, sharpen).save(path, 'WEBP', quality=92, alpha_quality=100, method=6)
        print(f'{path}: {size}x{size}, {path.stat().st_size} bytes')


if __name__ == '__main__':
    main()

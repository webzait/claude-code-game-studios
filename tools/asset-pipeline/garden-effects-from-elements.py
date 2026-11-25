"""Make the garden effect pictures from the owner's high-resolution element pictures.

Reads  design/reference/turnflock/garden/elements/  (transparent PNGs, about 1300 px)
         groen-portaal.png   green beam on a ring
         ster.png            one star
         sterrencluster.png  three stars with twinkles (one twinkle is taken from it)
         wolk.png            cloud puff (one ball is taken from it as well)
         blauw-portaal.png   blue ring
Writes assets/turnflock/garden/effects/
         beam.webp, star.webp, twinkle.webp, cloud.webp, cloud-ball.webp, ring.webp
       production/qa/evidence/garden-effects/originals/
         the five source pictures, whole, 480 px wide, for the parts sheet to show the
         effects next to (the full PNGs are too large to put in the parts sheet)

The owner's picture is the effect: nothing is redrawn. Each picture is cropped to what it
shows (plus a small margin), reduced to about twice the size it gets on a phone screen, with
colour premultiplied by alpha while it is resampled (no dark or light fringe), and saved as
WebP with alpha. The twinkle and the cloud ball are cut out with a soft round mask.

Sizes on screen: a board cell is 40 to 90 CSS px on a phone; the beam is about one cell wide
(1.6 in the celebration), a star half a cell (up to 1.1 in the celebration), the cloud about
one cell, a ball a third of that, the ring about one cell.

Run from the repo root:  python3 tools/asset-pipeline/garden-effects-from-elements.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = 'design/reference/turnflock/garden/elements/'
OUT = 'assets/turnflock/garden/effects/'
PREVIEW = 'production/qa/evidence/garden-effects/originals/'
PREVIEW_WIDTH = 480
MARGIN = 0.02      # margin round the cropped picture, as a share of its larger side
QUALITY = 90       # WebP quality of the colour; alpha is kept at full quality

# name: (source file, output width in px, optional round cut (centre x, centre y, radius) in source px)
PIECES = {
    'beam': ('groen-portaal.png', 300, None),
    'star': ('ster.png', 200, None),
    'twinkle': ('sterrencluster.png', 64, (371, 597, 62)),
    'cloud': ('wolk.png', 200, None),
    'cloud-ball': ('wolk.png', 80, (584, 810, 160)),
    'ring': ('blauw-portaal.png', 256, None),
}


def premultiplied_resize(img: Image.Image, size) -> Image.Image:
    """Resize with colour premultiplied by alpha, back to straight alpha."""
    return img.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def cut(src: Image.Image, circle) -> Image.Image:
    """The picture cropped to what it shows, or to a soft round cut-out."""
    if circle:
        cx, cy, r = circle
        box = (round(cx - r), round(cy - r), round(cx + r), round(cy + r))
        piece = src.crop(box)
        mask = Image.new('L', piece.size, 0)
        # A circle a little smaller than the box, its edge softened over a few source pixels.
        ImageDraw.Draw(mask).ellipse((4, 4, piece.width - 5, piece.height - 5), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(2.5))
        alpha = Image.fromarray(np.minimum(np.asarray(piece.getchannel('A')), np.asarray(mask)).astype('uint8'), 'L')
        piece.putalpha(alpha)
        return piece
    bbox = src.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox()
    l, t, r, b = bbox
    m = round(max(r - l, b - t) * MARGIN)
    return src.crop((max(l - m, 0), max(t - m, 0), min(r + m, src.width), min(b + m, src.height)))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, (file, width, circle) in PIECES.items():
        src = Image.open(os.path.join(SRC, file)).convert('RGBA')
        piece = cut(src, circle)
        height = round(piece.height * width / piece.width)
        small = premultiplied_resize(piece, (width, height))
        path = os.path.join(OUT, name + '.webp')
        small.save(path, 'WEBP', quality=QUALITY, alpha_quality=100, method=6)
        kb = os.path.getsize(path) / 1024
        total += kb
        print(f'{path}: {width}x{height} (aspect {height / width:.3f}) from {file} {piece.width}x{piece.height}, {kb:.1f} kB')
    print(f'total {total:.1f} kB')
    os.makedirs(PREVIEW, exist_ok=True)
    for file in sorted({p[0] for p in PIECES.values()} | {'sterrencluster.png'}):
        src = Image.open(os.path.join(SRC, file)).convert('RGBA')
        small = premultiplied_resize(src, (PREVIEW_WIDTH, round(src.height * PREVIEW_WIDTH / src.width)))
        small.save(os.path.join(PREVIEW, file.replace('.png', '.webp')), 'WEBP', quality=95, alpha_quality=100, method=6)


if __name__ == '__main__':
    main()

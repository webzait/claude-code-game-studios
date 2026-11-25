#!/usr/bin/env python3
"""Builds the garden theme's app icons from the owner's icon picture.

Run from the repo root:  python3 assets/turnflock/garden/icon/build-icon-garden.py
Needs Pillow with WebP support. Writes next to this script.

The picture (design/reference/turnflock/garden/27-app-icon-garden.webp, 1254x1254) is not
redrawn, recoloured or restyled. What is done, as for the robot icons
(assets/turnflock/brand/build-logo.py):
  1. A square is cut out of it.
  2. It is scaled down (never up).
  3. The tab icon gets rounded corners; the home-screen icon stays square and opaque,
     because iOS and Android round the corners themselves.
The picture has no frame, seam or stray pixels along its edge (checked: the outer rows are
plain sky and lawn), so the edge needs no other cleaning than the rounded mask.

The home-screen icon is the whole picture: it was made as an icon, and the second chick,
the star and the full arrow belong to it. The tab icon is a tighter square (880 of 1254 px)
around the red chick, with a little sky round it, the arrow and the star: at 16 px a red ball
with a white triangle on blue reads better than a close-up of the face (tried 730 and 800 px,
where the red fills the square and the shape is lost).
"""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[3] / "design/reference/turnflock/garden/27-app-icon-garden.webp"

# Squares of the source as (left, top, side) in source pixels.
TOUCH_SQUARE = (0, 0, 1254)
TAB_SQUARE = (260, 60, 880)
TOUCH_SIZE, TAB_SIZE = 180, 64
TAB_RADIUS = 0.22  # share of the size, the same as the robot favicon
TOUCH_COLOURS = 128  # palette size for the home-screen icon, the same as the robot icon
# The tab icon keeps its transparent corners in a 256-colour palette: 3.9 KB instead of
# about 11 KB in full colour, with no difference visible at 64 px.
TAB_COLOURS = 256
TOUCH_NAME, TAB_NAME = "icon-180-garden.png", "favicon-64-garden.png"


def crop(src: Image.Image, square: tuple[int, int, int], size: int) -> Image.Image:
    """The square `(left, top, side)` of the source, scaled to size x size."""
    left, top, side = square
    if left < 0 or top < 0 or left + side > src.width or top + side > src.height:
        raise ValueError(f"square {square} falls outside the {src.width}x{src.height} source")
    if size > side:
        raise ValueError(f"would scale up: {side} px to {size} px")
    return src.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def rounded(img: Image.Image, radius: float) -> Image.Image:
    """The image with rounded, anti-aliased corners (radius as a share of the size)."""
    size, scale = img.width, 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius * size * scale, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    print(f"source: {src.width}x{src.height}")
    touch = crop(src, TOUCH_SQUARE, TOUCH_SIZE).quantize(TOUCH_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    touch.save(HERE / TOUCH_NAME, optimize=True)
    fav = rounded(crop(src, TAB_SQUARE, TAB_SIZE), TAB_RADIUS).quantize(TAB_COLOURS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    fav.save(HERE / TAB_NAME, optimize=True)
    for name in (TOUCH_NAME, TAB_NAME):
        print(f"{name}: {(HERE / name).stat().st_size} bytes")


if __name__ == "__main__":
    main()

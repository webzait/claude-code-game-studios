#!/usr/bin/env python3
"""Builds the game's logo files and app icons from the owner's logo.

Run from the repo root:  python3 assets/turnflock/brand/build-logo.py
Needs Pillow with WebP support. Writes next to this script.

The artwork itself is not redrawn, recoloured, stretched or restyled. What is done:
  1. Leftovers of the cut-out are removed: pixels that are all but invisible
     (alpha <= HAZE of 255) become fully transparent. That is a faint haze around
     the edges (also below the ring, down to the bottom edge of the picture) and
     a few dozen loose specks.
  2. The body of the artwork is 99% opaque in the source (alpha 252-253 instead
     of 255); alpha is rescaled so the body is fully opaque and the harbour does
     not shine through. Colours are untouched.
  3. The empty margin is trimmed and the picture is scaled down (never up).
The app icon is a square crop of the same artwork (the robot with the ring, cut
just above the letters) on the game's sky gradient.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2] / "design/reference/turnflock/source/logo-original.png"

HAZE = 6  # alpha at or below this is a leftover of the cut-out, not artwork
BODY = 253  # the alpha the solid artwork has in the source
# One logo file serves every place: 768 px wide is pixel ratio 3 at the largest size the
# level selection shows it on a phone (256 CSS px) and ratio 2 at the tablet size (384).
# Every file is inlined in the single-file build, so a second, smaller copy would cost
# more than it gains.
LOGO_NAME, LOGO_WIDTH, LOGO_QUALITY, LOGO_ALPHA_QUALITY = "logo.webp", 768, 76, 80
# The icon: a square of the source around the robot (centre x = ICON_CENTRE), ending at
# ICON_BOTTOM, inside the dark band between the plate's rim and the letters, so the robot
# peeks over the plate as it does in the logo. The home-screen icon takes a wider square
# that shows the ring on both sides; the small tab icon a tighter one, so the robot still
# reads at 16 px. The left spark would be cut in half by the square's edge, so the sparks
# (everything right of SPARKS_X above SPARKS_Y) are left out of the icon.
ICON_CENTRE, ICON_BOTTOM = 870, 440
TOUCH_SQUARE, TAB_SQUARE = 640, 560
SPARKS_X, SPARKS_Y = 1175, 215
SKY_TOP, SKY_BOTTOM = (0x4E, 0xAF, 0xF8), (0x2E, 0x84, 0xF1)


def cleaned() -> Image.Image:
    """The source with the cut-out leftovers removed and the body made opaque."""
    px = np.array(Image.open(SOURCE).convert("RGBA"))
    alpha = px[..., 3].astype(np.float32)
    haze = (alpha > 0) & (alpha <= HAZE)
    print(f"leftovers removed: {int(haze.sum())} pixels with alpha 1-{HAZE} of 255")
    alpha[haze] = 0
    alpha = np.minimum(255, np.round(alpha * 255 / BODY))
    px[..., 3] = alpha.astype(np.uint8)
    px[alpha == 0, :3] = 0
    return Image.fromarray(px, "RGBA")


def sky(size: int) -> Image.Image:
    """The game's sky gradient, top to bottom."""
    t = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
    rows = np.array(SKY_TOP, np.float32) * (1 - t) + np.array(SKY_BOTTOM, np.float32) * t
    rgb = np.repeat(rows, size, axis=1).round().astype(np.uint8)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def icon(art: Image.Image, size: int, square: int, radius: float = 0) -> Image.Image:
    """The icon at one size, from a square of the source `square` pixels wide; radius (share of the size) rounds the corners."""
    left = ICON_CENTRE - square // 2
    box = (left, ICON_BOTTOM - square, left + square, ICON_BOTTOM)
    robot = art.copy()
    robot.paste((0, 0, 0, 0), (SPARKS_X, 0, robot.size[0], SPARKS_Y))
    big = sky(square)
    big.alpha_composite(robot.crop(box))
    out = big.resize((size, size), Image.LANCZOS)
    if radius:
        scale = 4
        mask = Image.new("L", (size * scale, size * scale), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), radius * size * scale, fill=255)
        out.putalpha(mask.resize((size, size), Image.LANCZOS))
        return out
    return out.convert("RGB")


def main() -> None:
    art = cleaned()
    trimmed = art.crop(art.getbbox())
    print(f"trimmed to {trimmed.size[0]}x{trimmed.size[1]} (source {art.size[0]}x{art.size[1]})")
    height = round(trimmed.size[1] * LOGO_WIDTH / trimmed.size[0])
    logo = trimmed.resize((LOGO_WIDTH, height), Image.LANCZOS)
    logo.save(HERE / LOGO_NAME, "WEBP", quality=LOGO_QUALITY, alpha_quality=LOGO_ALPHA_QUALITY, method=6)
    print(f"{LOGO_NAME}: {LOGO_WIDTH}x{height}, {(HERE / LOGO_NAME).stat().st_size} bytes")
    # Touch / home-screen icon: square, no transparency (iOS rounds the corners itself).
    # A 128-colour palette keeps the PNG small; at icon size the difference is not visible.
    touch = icon(art, 180, TOUCH_SQUARE).quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    touch.save(HERE / "icon-180.png", optimize=True)
    # Browser tab icon: rounded corners, drawn at 64 so it is sharp at 32 on a 2x screen and at 16.
    fav = icon(art, 64, TAB_SQUARE, radius=0.22)
    fav.save(HERE / "favicon-64.png", optimize=True)
    for name in ("icon-180.png", "favicon-64.png"):
        print(f"{name}: {(HERE / name).stat().st_size} bytes")


if __name__ == "__main__":
    main()

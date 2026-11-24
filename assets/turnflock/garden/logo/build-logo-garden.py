#!/usr/bin/env python3
"""Builds the garden theme's logo file and the proposed garden app icons from the owner's logo.

Run from the repo root:  python3 assets/turnflock/garden/logo/build-logo-garden.py
Needs Pillow with WebP support and NumPy. Writes next to this script.
Design: design/themes/garden-logo.md. Same steps as the robot logo (assets/turnflock/brand/build-logo.py).

The artwork itself is not redrawn, recoloured, stretched or restyled. What is done:
  1. Leftovers of the cut-out are removed: pixels that are all but invisible
     (alpha <= HAZE of 255) become fully transparent, and so do loose specks
     (separate islands smaller than SPECK pixels; the two sparks are far larger).
  2. The body of the artwork is 99% opaque in the source (alpha 253); alpha is
     rescaled so the body is fully opaque and the garden does not shine through.
  3. The empty margin is trimmed and the picture is scaled down (never up), with
     premultiplied alpha so no dark or light fringe appears at the edge.
The icons (proposals only, the robot icons stay) are a square crop around the red
chick, cut just above the letters, on a garden sky.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[3] / "design/reference/turnflock/garden/26-logo-garden.webp"

HAZE = 6  # alpha at or below this is a leftover of the cut-out, not artwork
BODY = 253  # the alpha the solid artwork has in the source
SPECK = 200  # islands smaller than this (pixels in the source) are leftovers
# The level screen shows the logo at most 265 CSS px wide on a phone (390 and 430 wide);
# 560 px is pixel ratio 2 for that with a little to spare. Inlined in the single file,
# so one copy only.
LOGO_NAME, LOGO_WIDTH, LOGO_QUALITY, LOGO_ALPHA_QUALITY = "logo-garden.webp", 560, 80, 85
# Icon: a square around the red chick (centre x), ending just above the letters. The
# sparks right of SPARKS_X above SPARKS_Y would be cut by the square's edge; left out.
ICON_CENTRE, ICON_BOTTOM = 905, 474
TOUCH_SQUARE, TAB_SQUARE = 600, 500
SPARKS_X, SPARKS_Y = 1150, 235
SKIES = {
    # A: the robot icon's sky, so the icon stays recognisably Turnflock.
    "sky": ((0x4E, 0xAF, 0xF8), (0x2E, 0x84, 0xF1)),
    # B: a garden: light sky above a lawn, the horizon at HORIZON of the height.
    "lawn": ((0x5C, 0xB6, 0xF9), (0xB8, 0xE4, 0xFF), (0x8C, 0xD6, 0x4E), (0x5A, 0xB0, 0x30)),
}


def cleaned() -> Image.Image:
    """The source with the cut-out leftovers removed and the body made opaque."""
    from scipy import ndimage

    px = np.array(Image.open(SOURCE).convert("RGBA"))
    alpha = px[..., 3].astype(np.float32)
    haze = (alpha > 0) & (alpha <= HAZE)
    alpha[haze] = 0
    labels, count = ndimage.label(alpha > 0)
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, count + 1))
    small = np.isin(labels, np.nonzero(sizes < SPECK)[0] + 1)
    alpha[small] = 0
    print(f"leftovers removed: {int(haze.sum())} haze pixels, {int((sizes < SPECK).sum())} specks ({int(small.sum())} pixels)")
    alpha = np.minimum(255, np.round(alpha * 255 / BODY))
    px[..., 3] = alpha.astype(np.uint8)
    px[alpha == 0, :3] = 0
    return Image.fromarray(px, "RGBA")


def scaled(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize with premultiplied alpha, so transparent pixels' colour never bleeds into the edge."""
    out = img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")
    px = np.array(out)
    px[px[..., 3] == 0, :3] = 0
    return Image.fromarray(px, "RGBA")


HORIZON = 0.7


def gradient(size: int, *stops) -> Image.Image:
    """Two stops: a plain gradient. Four: sky (stops 1-2) down to the horizon, then lawn (stops 3-4)."""
    t = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
    mix = lambda a, b, u: np.array(a, np.float32) * (1 - u) + np.array(b, np.float32) * u
    if len(stops) == 2:
        rows = mix(stops[0], stops[1], t)
    else:
        rows = np.where(t < HORIZON, mix(stops[0], stops[1], t / HORIZON), mix(stops[2], stops[3], (t - HORIZON) / (1 - HORIZON)))
    return Image.fromarray(np.repeat(rows, size, axis=1).round().astype(np.uint8), "RGB").convert("RGBA")


def icon(art: Image.Image, size: int, square: int, sky: str, radius: float = 0) -> Image.Image:
    """The icon at one size from a square of the source `square` px wide; radius (share of size) rounds the corners."""
    left = ICON_CENTRE - square // 2
    top = ICON_BOTTOM - square
    chick = art.copy()
    chick.paste((0, 0, 0, 0), (SPARKS_X, 0, chick.size[0], SPARKS_Y))
    big = gradient(square, *SKIES[sky])
    padded = Image.new("RGBA", (art.size[0], art.size[1] + square), (0, 0, 0, 0))
    padded.paste(chick, (0, square))  # room above the top edge of the source
    big.alpha_composite(padded.crop((left, top + square, left + square, ICON_BOTTOM + square)))
    out = big.resize((size, size), Image.LANCZOS)
    if radius:
        k = 4
        mask = Image.new("L", (size * k, size * k), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * k - 1, size * k - 1), radius * size * k, fill=255)
        out.putalpha(mask.resize((size, size), Image.LANCZOS))
        return out
    return out.convert("RGB")


def main() -> None:
    art = cleaned()
    box = art.getbbox()
    trimmed = art.crop(box)
    print(f"trimmed to {trimmed.size[0]}x{trimmed.size[1]} at {box} (source {art.size[0]}x{art.size[1]})")
    height = round(trimmed.size[1] * LOGO_WIDTH / trimmed.size[0])
    logo = scaled(trimmed, (LOGO_WIDTH, height))
    logo.save(HERE / LOGO_NAME, "WEBP", quality=LOGO_QUALITY, alpha_quality=LOGO_ALPHA_QUALITY, method=6)
    print(f"{LOGO_NAME}: {LOGO_WIDTH}x{height}, {(HERE / LOGO_NAME).stat().st_size} bytes")
    for sky in SKIES:
        touch = icon(art, 180, TOUCH_SQUARE, sky).quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        touch.save(HERE / f"proposal-icon-180-{sky}.png", optimize=True)
        icon(art, 64, TAB_SQUARE, sky, radius=0.22).save(HERE / f"proposal-favicon-64-{sky}.png", optimize=True)
        for name in (f"proposal-icon-180-{sky}.png", f"proposal-favicon-64-{sky}.png"):
            print(f"{name}: {(HERE / name).stat().st_size} bytes")


if __name__ == "__main__":
    main()

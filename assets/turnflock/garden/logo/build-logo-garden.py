#!/usr/bin/env python3
"""Builds the garden theme's logo file from the owner's logo (the app icon is another session's).

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
"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[3] / "design/reference/turnflock/garden/26-logo-garden.webp"

HAZE = 6  # alpha at or below this is a leftover of the cut-out, not artwork
BODY = 253  # the alpha the solid artwork has in the source
SPECK = 200  # islands smaller than this (pixels in the source) are leftovers
# The level screen shows the logo at most 265 CSS px wide on a phone (390 and 430 wide);
# 560 px is pixel ratio 2 for that with a little to spare. Inlined in the single file,
# so one copy only.
LOGO_NAME, LOGO_WIDTH, LOGO_QUALITY, LOGO_ALPHA_QUALITY = "logo-garden.webp", 560, 80, 85


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


def main() -> None:
    art = cleaned()
    box = art.getbbox()
    trimmed = art.crop(box)
    print(f"trimmed to {trimmed.size[0]}x{trimmed.size[1]} at {box} (source {art.size[0]}x{art.size[1]})")
    height = round(trimmed.size[1] * LOGO_WIDTH / trimmed.size[0])
    logo = scaled(trimmed, (LOGO_WIDTH, height))
    logo.save(HERE / LOGO_NAME, "WEBP", quality=LOGO_QUALITY, alpha_quality=LOGO_ALPHA_QUALITY, method=6)
    print(f"{LOGO_NAME}: {LOGO_WIDTH}x{height}, {(HERE / LOGO_NAME).stat().st_size} bytes")

if __name__ == "__main__":
    main()

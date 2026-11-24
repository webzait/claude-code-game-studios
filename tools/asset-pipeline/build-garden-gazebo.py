#!/usr/bin/env python3
"""Cuts the gazebo for the end of the garden level path out of the owner's picture.

Run from the repo root:  python3 tools/asset-pipeline/build-garden-gazebo.py
Needs Pillow (with WebP), numpy and scipy. Writes src/ui/themes/garden/levels-gazebo.webp.

The artwork is not redrawn or recoloured. What is done:
  1. The flat off-white background is removed: every patch of pixels close to the
     background colour that touches the picture's edge, or is large (the three
     arch openings), becomes transparent. Small light patches (white flowers, the
     leaf on the flag) are artwork and stay.
  2. The grey ground shadow under the base becomes a see-through shadow.
  3. Along that cut a soft edge: alpha follows the distance to the background
     colour, and the background tint is taken out of those edge pixels.
  4. Trimmed to the artwork and scaled down to WIDTH (pixel ratio 3 at the
     largest size the path shows it, about 120 CSS px).
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design/reference/turnflock/garden/08-gazebo.png"
OUT = ROOT / "src/ui/themes/garden/levels-gazebo.webp"
NEAR = 22  # colour distance to the background below which a pixel can be background
EDGE = 46  # distance at which an edge pixel is fully opaque
SHADOW = 150  # a grey lighter than this, joined to the background, is the ground shadow
HOLE = 5000  # an enclosed light patch larger than this (source pixels) is an opening, not a flower
WIDTH, QUALITY, ALPHA_QUALITY = 360, 82, 85


def main() -> None:
    rgb = np.asarray(Image.open(SOURCE).convert("RGB")).astype(np.float64)
    bg = np.median(np.concatenate([rgb[:20].reshape(-1, 3), rgb[-20:].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    labels, count = ndimage.label(dist < NEAR)
    sizes = ndimage.sum(np.ones_like(dist), labels, range(1, count + 1))
    edge_ids = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])).tolist())
    keep = np.zeros(count + 1, bool)
    for i, size in enumerate(sizes, 1):
        keep[i] = i in edge_ids or size > HOLE
    background = keep[labels]
    # The soft grey shadow under the base: grey (unsaturated), lighter than SHADOW and joined to the
    # background. It becomes a real, see-through shadow (black with the alpha of its darkness).
    sat = rgb.max(-1) - rgb.min(-1)
    grey = (sat < 18) & (rgb.mean(-1) > SHADOW)
    s_labels, _ = ndimage.label(grey | background)
    s_ids = set(np.unique(s_labels[background]).tolist()) - {0}
    shadow = np.isin(s_labels, list(s_ids)) & ~background
    # Soft edge: only next to the background, alpha rises with the distance to its colour.
    band = ndimage.binary_dilation(background, iterations=3) & ~background
    alpha = np.ones_like(dist)
    alpha[background] = 0
    soft = np.clip((dist - NEAR / 2) / (EDGE - NEAR / 2), 0, 1)
    alpha[band] = np.minimum(1, soft[band] * 1.15)
    lum = rgb.mean(-1)
    shade = np.clip((bg.mean() - lum) / bg.mean() * 1.6, 0, 0.45)
    alpha[shadow] = shade[shadow]
    band &= ~shadow
    # Take the background's tint out of semi-transparent edge pixels.
    a = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.where((band)[..., None], np.clip((rgb - bg * (1 - a)) / a, 0, 255), rgb)
    rgb[shadow] = [40, 70, 30]
    rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    img = img.crop(img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    height = round(img.height * WIDTH / img.width)
    img = img.resize((WIDTH, height), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6)
    print(f"{OUT.relative_to(ROOT)}: {img.width}x{img.height}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()

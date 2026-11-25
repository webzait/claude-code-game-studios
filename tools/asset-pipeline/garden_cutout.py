"""Cuts a piece of artwork out of one of the owner's garden pictures (flat off-white background).

Used by build-garden-gazebo.py. The artwork is not redrawn
or recoloured. What is done:
  1. The flat background is removed: every patch of pixels close to the background colour that
     touches the picture's edge, or is large (openings such as the gazebo's arches), becomes
     transparent. Small light patches (white flowers, the leaf on the flag) are artwork and stay.
  2. The grey ground shadow under the base becomes a see-through shadow.
  3. Along the cut a soft edge: alpha follows the distance to the background colour, and the
     background tint is taken out of those edge pixels.
  4. Trimmed to the artwork.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

NEAR = 22  # colour distance to the background below which a pixel can be background
EDGE = 46  # distance at which an edge pixel is fully opaque
SHADOW = 150  # a grey lighter than this, joined to the background, is the ground shadow
HOLE = 5000  # an enclosed light patch larger than this (source pixels) is an opening, not a flower


def cut_out(source: Path) -> Image.Image:
    """The artwork of one of the owner's pictures on a flat off-white background, cut out and trimmed."""
    rgb = np.asarray(Image.open(source).convert("RGB")).astype(np.float64)
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
    return img.crop(img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())

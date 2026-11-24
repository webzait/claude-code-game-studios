"""Exit pad in three looks (grey, green, rays), from the owner's high-resolution pictures.

`hires_pad(look)` is the part the game uses: the owner's picture (`checkpoints.source`), only
downscaled (premultiplied area average, `checkpoints.shrink`), nothing repainted. Other parts can
build from `hires_pad('green')`.

The three pictures are not drawn at the same scale, so each look is measured on its own:

- the stone: the widest run of fully opaque pixels below the rays (the stone's own outline, not
  the glow or the rays); each look is scaled so that run is `PAD_STONE_OUT_PX` wide, and the stone
  is one cell, so the three pads are the same size in the game;
- the anchor (the point the game puts over the cell centre): the centre of an ellipse fitted to the
  outline of the pad's face (the inner ellipse), carried to output pixels.

`source_pad` and `anchor` are the old 22-sheet cut-out and its anchor, kept for the parts that
still import them.
"""
from __future__ import annotations

from functools import lru_cache

import cv2
import numpy as np
from scipy import ndimage

from checkpoints import PAD_STONE_OUT_PX, shrink, source
from lib import bottom, crop, cut_out, face_centre, load, write_part

LOOKS = ("grey", "green", "rays")
# Fully opaque: the stone is measured on these pixels, so the soft glow edge does not count.
SOLID = 250
# On the rays picture the stone starts below this row of `source('rays')` (the rays are above).
RAYS_STONE_TOP = 270


def stone_width(rgba: np.ndarray, look: str) -> int:
    """Width in px of the widest solid row of the stone body."""
    solid = rgba[..., 3] > SOLID
    if look == "rays":
        solid[:RAYS_STONE_TOP] = False
    best = 0
    for row in solid:
        xs = np.nonzero(row)[0]
        if len(xs):
            best = max(best, int(xs[-1] - xs[0] + 1))
    return best


def _largest(mask: np.ndarray) -> np.ndarray:
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == int(np.argmax(sizes)) + 1


def face_mask(rgba: np.ndarray, look: str) -> np.ndarray:
    """The pad's face (inner ellipse), tick included.

    Green and rays: the saturated green. Grey: the mid-grey inside the light rim (the face is
    darker than the rim top and lighter than the groove round it)."""
    r, g, b, a = (rgba[..., i] for i in range(4))
    opaque = a > SOLID
    if look == "grey":
        lum = (r + g + b) / 3
        m = ndimage.binary_opening((lum > 112) & (lum < 180) & opaque, iterations=3)
    else:
        m = ndimage.binary_opening((g - b > 120) & (g > 150) & (g - r > 40) & opaque, iterations=2)
    return ndimage.binary_fill_holes(ndimage.binary_closing(_largest(m), iterations=10))


def face_ellipse(rgba: np.ndarray, look: str) -> tuple[float, float, float, float]:
    """(cx, cy, width, height) of the ellipse fitted to the face outline, in the picture's px."""
    found, _ = cv2.findContours(face_mask(rgba, look).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (cx, cy), (d0, d1), angle = cv2.fitEllipse(max(found, key=len))
    w, h = (d1, d0) if 45 < angle < 135 else (d0, d1)
    return cx, cy, w, h


@lru_cache(maxsize=None)
def _hires(look: str) -> tuple[np.ndarray, tuple[float, float]]:
    src = source(look)
    rgba = shrink(src, PAD_STONE_OUT_PX / stone_width(src, look))
    # Pixel centres: out = (in + 0.5) * scale - 0.5, with the scale shrink actually used per axis.
    sx, sy = rgba.shape[1] / src.shape[1], rgba.shape[0] / src.shape[0]
    cx, cy, _, _ = face_ellipse(src, look)
    return rgba, ((cx + 0.5) * sx - 0.5, (cy + 0.5) * sy - 0.5)


def hires_pad(look: str) -> tuple[np.ndarray, tuple[float, float]]:
    """One look at output size (stone `PAD_STONE_OUT_PX` wide = 1 cell) and its anchor in px."""
    rgba, at = _hires(look)
    return rgba.copy(), at


# --- The old 22-sheet cut-out, kept for parts that import it -------------------------------------
BOXES = {"grey": (5, 0, 108, 88), "green": (117, 0, 224, 88), "rays": (236, 0, 342, 86)}
SHEET = "22-sheet-exit-pad-states"


def source_pad(look: str) -> np.ndarray:
    return crop(cut_out(load(SHEET)), BOXES[look])


def anchor(look: str, rgba: np.ndarray) -> tuple[float, float]:
    """The face centre: measured on the green pad, carried to the others by their lowest solid row."""
    green = source_pad("green")
    _, cy, _ = face_centre(green)
    rise = bottom(green) - cy
    xs = np.nonzero((rgba[..., 3] > 128).any(axis=0))[0]
    return ((xs.min() + xs.max()) / 2, bottom(rgba) - rise)


def run() -> None:
    sprites = {}
    for look in LOOKS:
        rgba, at = hires_pad(look)
        sprites[f"exit-{look}"] = (rgba, at, 1.0 / PAD_STONE_OUT_PX)
    write_part("exit_pads", sprites)

"""The owner's high-resolution exit pads ("checkpoint" pictures, design/reference/turnflock/garden/elements/).

They replace the small 22-sheet-exit-pad-states as the source of every pad-based part: the exit
in its three looks, the colour exits, the turn tile and the pressure plate. The pictures are
already cut out (transparent, clean edge, no drop shadow).

`source(look)` gives a look's picture cropped to what is visible, as float RGBA at full size;
`STONE_PX` is the grey pad's stone width in those pixels (the stone fills one cell);
`shrink(rgba, factor)` resizes without fringes. Output width is chosen by `PAD_STONE_OUT_PX`.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ELEMENTS = Path(__file__).resolve().parents[3] / "design/reference/turnflock/garden/elements"
FILES = {"grey": "checkpoint-inactief", "green": "checkpoint-actief", "rays": "checkpoint-opgelicht"}

# The stone of each pad, in the pictures' own pixels (widest run of solid pixels). The grey pad
# is the reference: it has no glow round the stone.
STONE_PX = 727
# In the output the stone is this many px wide: a cell is at most 53 CSS px on a phone at 3 device
# px per CSS px (~160 px), so 320 px is twice that.
PAD_STONE_OUT_PX = 320


def source(look: str, margin: int = 4) -> np.ndarray:
    """One look's picture as float RGBA, cropped to what is visible plus a margin."""
    rgba = np.asarray(Image.open(ELEMENTS / f"{FILES[look]}.png").convert("RGBA"), dtype=float)
    ys, xs = np.nonzero(rgba[..., 3] > 2)
    y0, y1 = max(0, ys.min() - margin), min(rgba.shape[0], ys.max() + 1 + margin)
    x0, x1 = max(0, xs.min() - margin), min(rgba.shape[1], xs.max() + 1 + margin)
    return rgba[y0:y1, x0:x1]


def shrink(rgba: np.ndarray, factor: float) -> np.ndarray:
    """Resize by `factor` (< 1) on premultiplied colour with area averaging: no dark or light fringe."""
    h, w = rgba.shape[:2]
    size = (max(1, round(w * factor)), max(1, round(h * factor)))
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    small = cv2.resize(pre, size, interpolation=cv2.INTER_AREA)
    alpha = np.clip(small[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


FACTOR = PAD_STONE_OUT_PX / STONE_PX
CELLS_PER_OUT_PX = 1.0 / PAD_STONE_OUT_PX

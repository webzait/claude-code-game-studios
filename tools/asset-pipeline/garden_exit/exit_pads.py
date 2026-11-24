"""Exit pad in three looks (grey, green, rays), cut from 22-sheet-exit-pad-states.

`source_pad(look)` is the cut-out at the owner's size; `pad(look)` the enlarged one the game
uses, with its anchor (the face centre) in pixels. Other parts derive from `source_pad('green')`.
"""
from __future__ import annotations

import numpy as np

from lib import CELLS_PER_SOURCE_PX, UPSCALE, bottom, crop, cut_out, face_centre, load, upscale, write_part

# Each pad's box on the sheet (x0, y0, x1, y1); the small red mark under the third is left out.
BOXES = {"grey": (5, 0, 108, 88), "green": (117, 0, 224, 88), "rays": (236, 0, 342, 86)}


def source_pad(look: str) -> np.ndarray:
    return crop(cut_out(load("22-sheet-exit-pad-states")), BOXES[look])


def anchor(look: str, rgba: np.ndarray) -> tuple[float, float]:
    """The face centre: measured on the green pad, carried to the others by their lowest solid row."""
    green = source_pad("green")
    _, cy, _ = face_centre(green)
    rise = bottom(green) - cy
    xs = np.nonzero((rgba[..., 3] > 128).any(axis=0))[0]
    return ((xs.min() + xs.max()) / 2, bottom(rgba) - rise)


def pad(look: str) -> tuple[np.ndarray, tuple[float, float]]:
    src = source_pad(look)
    ax, ay = anchor(look, src)
    return upscale(src, UPSCALE), (ax * UPSCALE, ay * UPSCALE)


def run() -> None:
    sprites = {}
    for look in ("grey", "green", "rays"):
        rgba, at = pad(look)
        sprites[f"exit-{look}"] = (rgba, at, CELLS_PER_SOURCE_PX / UPSCALE)
    write_part("exit_pads", sprites)

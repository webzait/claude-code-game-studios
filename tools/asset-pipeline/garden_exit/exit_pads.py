"""Exit pad in four looks (grey, green, rays, portal), from the owner's corrected pictures.

`hires_pad(look)` is the part the game uses: the owner's picture cut from its white background
(`checkpoints.source`) and only downscaled (premultiplied area average, `checkpoints.shrink`),
nothing repainted. Other parts build from the green look.

The four pictures are not drawn at the same scale or quite the same perspective, so:

- width: each look is scaled so its stone tile (`checkpoints.stone_px`, the tile body without the
  rays) is `PAD_STONE_OUT_PX` wide; the stone is one cell;
- height (`LEVEL`): the tile is then stretched vertically to the green tile's height (grey +3 %,
  portal +6 %, rays +9 %), so the stone does not jump when the look changes. The owner chose
  levelling for the first pads ("trek recht als dat mooier is", 2026-11-24);
- anchor (the point the game puts over the cell centre): the centre of the green pad's lit face,
  as a fraction of its tile box, used for every look, so all four tiles coincide exactly.

`source_pad` and `anchor` are the old 22-sheet cut-out and its anchor, kept for parts that import them.
"""
from __future__ import annotations

from functools import lru_cache

import cv2
import numpy as np
from scipy import ndimage

from checkpoints import PAD_STONE_OUT_PX, shrink, source, stone_px, tile_mask
from lib import bottom, crop, cut_out, face_centre, load, write_part

LOOKS = ("grey", "green", "rays", "portal")
# Stretch each look's tile to the green tile's height (see module doc).
LEVEL = True
# Kept for older imports: the grey look is levelled as part of LEVEL.
LEVEL_GREY = LEVEL


def _largest(mask: np.ndarray) -> np.ndarray:
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == int(np.argmax(sizes)) + 1


def stone_width(rgba: np.ndarray | None = None, look: str = "green") -> int:
    """Width in source px of a look's stone tile (the rgba argument is kept for older callers)."""
    return stone_px(look)


def face_mask(rgba: np.ndarray, look: str) -> np.ndarray:
    """The lit face inside the stone ring, tick included (saturated green; the yellow-lime glow in
    the joints is left out). Grey: the blue-grey inside the light ring."""
    r, g, b = rgba[..., 0], rgba[..., 1], rgba[..., 2]
    tile = tile_mask(look) if rgba.shape[:2] == tile_mask(look).shape else rgba[..., 3] > 250
    if look == "grey":
        m = (b - r > 20) & (b > 120) & (b < 190) & tile
        m = ndimage.binary_opening(m, iterations=3)
    else:
        m = (g - r > 90) & (b < 60) & tile
        m = ndimage.binary_opening(m, iterations=3)
    return ndimage.binary_fill_holes(ndimage.binary_closing(_largest(m), iterations=15))


def face_box(rgba: np.ndarray, look: str) -> tuple[float, float, float, float]:
    """(cx, cy, width, height) of the face's bounding box, in the picture's px."""
    ys, xs = np.nonzero(face_mask(rgba, look))
    return (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, float(xs.max() - xs.min() + 1), float(ys.max() - ys.min() + 1)


# Older parts call it an ellipse; for the square pads it is the face's box.
face_ellipse = face_box


def _tile_box(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def _stretch_y(rgba: np.ndarray, height: int) -> np.ndarray:
    """Resize a picture to `height` rows on premultiplied colour (no fringes)."""
    h, w = rgba.shape[:2]
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    out = cv2.resize(pre, (w, height), interpolation=cv2.INTER_AREA if height < h else cv2.INTER_CUBIC)
    alpha = np.clip(out[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, out[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


@lru_cache(maxsize=None)
def _scaled(look: str) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """A look at output width, and its tile box (x0, y0, x1, y1) in output px."""
    src = source(look)
    f = PAD_STONE_OUT_PX / stone_px(look)
    rgba = shrink(src, f)
    sx, sy = rgba.shape[1] / src.shape[1], rgba.shape[0] / src.shape[0]
    x0, y0, x1, y1 = _tile_box(tile_mask(look))
    return rgba, (x0 * sx, y0 * sy, (x1 + 1) * sx, (y1 + 1) * sy)


@lru_cache(maxsize=None)
def face_fraction() -> tuple[float, float]:
    """Centre of the green pad's lit face as fractions of its tile box."""
    src = source("green")
    cx, cy, _, _ = face_box(src, "green")
    x0, y0, x1, y1 = _tile_box(tile_mask("green"))
    return (cx + 0.5 - x0) / (x1 + 1 - x0), (cy + 0.5 - y0) / (y1 + 1 - y0)


def hires_pad(look: str) -> tuple[np.ndarray, tuple[float, float]]:
    """One look at output size (stone `PAD_STONE_OUT_PX` wide = 1 cell) and its anchor in px."""
    rgba, (x0, y0, x1, y1) = _scaled(look)
    if LEVEL and look != "green":
        _, (_, gy0, _, gy1) = _scaled("green")
        k = (gy1 - gy0) / (y1 - y0)
        rgba = _stretch_y(rgba, round(rgba.shape[0] * k))
        k = rgba.shape[0] / _scaled(look)[0].shape[0]
        y0, y1 = y0 * k, y1 * k
    fx, fy = face_fraction()
    return rgba.copy(), (x0 + fx * (x1 - x0) - 0.5, y0 + fy * (y1 - y0) - 0.5)


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
        print(f"exit-{look}: {rgba.shape[1]}x{rgba.shape[0]} px, anchor ({at[0]:.1f}, {at[1]:.1f})")
        sprites[f"exit-{look}"] = (rgba, at, 1.0 / PAD_STONE_OUT_PX)
    write_part("exit_pads", sprites)

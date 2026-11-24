"""Turn tile: the owner's green pad retoned cream, tick painted out, and the clockwise arrow of the
owner's turn button (18-sheet-action-buttons) in leaf green in its place.

Worked at the output size: the pad is enlarged first, then retoned and painted out there; the arrow is
traced from the owner's glyph (turn_arrow.py) and filled supersampled at the output size, squashed
to the face's perspective, with the owner's shading (lighter on top, darker below, as the button's
arrow) and a soft dark edge under it like the painted tick has.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage

from exit_pads import anchor, source_pad
from lib import CELLS_PER_SOURCE_PX, CREAM, LEAF, UPSCALE, lit_mask, paint_out, retone, tick_mask, upscale, write_part
from turn_arrow import bounds, fit, render

FACTOR = UPSCALE
# Arrow width as a share of the face width (the owner's tick is ~0.36; the arrow is a little larger
# so it reads at game size), and its shading: top/bottom tone factors on LEAF, under-shadow strength.
ARROW_SHARE = 0.5
TOP, BOTTOM = 1.35, 0.8
SHADE = 0.22
# Vertical squash of the arrow. The face's own ellipse is 40/86 = 0.47, but the owner does not draw
# glyphs fully foreshortened: the tick on the pad is 17x31 px, about 0.7 of a plain tick's height.
# At 0.47 the ring reads as a flat dash, so the arrow gets the owner's glyph squash instead.
SQUASH = 0.7


def face(src: np.ndarray) -> tuple[np.ndarray, tuple[float, float], float, float]:
    """The lit face of the source pad: mask, centre (x, y), width and height in source px."""
    m = ndimage.binary_fill_holes(ndimage.binary_closing(lit_mask(src) > 0.5, iterations=6))
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = lab == int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(m)
    return m, (xs.mean(), ys.mean()), float(xs.max() - xs.min() + 1), float(ys.max() - ys.min() + 1)


def grow(mask: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """A 0..1 mask from the source enlarged smoothly to the output size (width, height)."""
    return np.clip(cv2.resize(mask.astype(np.float32), size, interpolation=cv2.INTER_CUBIC), 0, 1)


def run() -> None:
    green = source_pad("green")
    _, (cx, cy), face_w, face_h = face(green)
    big = upscale(green, FACTOR)
    h, w = big.shape[:2]

    # Retone and paint out at the output size; the masks are measured on the source and enlarged.
    lit = np.clip(grow(np.clip(lit_mask(green) * 1.6, 0, 1), (w, h)), 0, 1)
    tick = grow(tick_mask(green), (w, h)) > 0.4
    img = paint_out(retone(big, lit, CREAM, keep_light=0.45), tick)
    # Inpainting at this size leaves a faint smear: smooth the painted area into the face around it.
    soft = cv2.GaussianBlur(ndimage.binary_dilation(tick, iterations=FACTOR * 2).astype(np.float32), (0, 0), FACTOR * 1.5)[..., None]
    img[..., :3] = img[..., :3] * (1 - soft) + cv2.GaussianBlur(img[..., :3].astype(np.float32), (0, 0), FACTOR * 2.5) * soft

    # The arrow, traced from the owner's glyph and drawn at the output size in the face's perspective.
    p = fit()
    x0, y0, x1, y1 = bounds(p)
    scale = ARROW_SHARE * face_w * FACTOR / (x1 - x0)
    squash = SQUASH
    at = ((cx * FACTOR, cy * FACTOR), ((x0 + x1) / 2, (y0 + y1) / 2))
    arrow = render(p, h, w, scale=scale, squash=squash, ss=4, at=at)

    # Shading: the owner's arrow is light on top and shaded below; a soft dark edge sits under it.
    ys = np.nonzero(arrow.max(axis=1) > 0.01)[0]
    v = np.clip((np.arange(h) - ys.min()) / max(1, ys.max() - ys.min()), 0, 1)[:, None, None]
    tone = np.array(LEAF, dtype=float) * (TOP + (BOTTOM - TOP) * v)
    under = ndimage.shift(arrow, (1.2 * FACTOR, 0.4 * FACTOR), order=1)
    under = cv2.GaussianBlur(under.astype(np.float32), (0, 0), 0.8 * FACTOR) * SHADE
    rgb = img[..., :3] * (1 - under[..., None])
    a = arrow[..., None]
    img[..., :3] = rgb * (1 - a) + np.clip(tone, 0, 255) * a

    at_px = anchor("green", green)
    write_part("turn", {"turn": (img, (at_px[0] * FACTOR, at_px[1] * FACTOR), CELLS_PER_SOURCE_PX / FACTOR)})

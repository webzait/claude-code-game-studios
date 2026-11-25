"""Turn tile: the owner's green pad (corrected checkpoint-actief, exit-pads-v2) retoned cream, the tick
painted out, and the clockwise arrow of the owner's turn button (18-sheet-action-buttons) in leaf
green in its place.

Worked at the picture's own resolution (~800 px wide), then shrunk once to the output size, which
is the exit pads' convention: the pad's stone body is `PAD_STONE_OUT_PX` wide, the anchor is the
face centre, cells per px = 1 / PAD_STONE_OUT_PX. So the tile lines up with the green exit pad.

- Paint-out: the tick and its glow are filled by normalised convolution of the face around them
  (a wide blur of the face with the tick left out, divided by the blur of the weights): the face's
  own smooth shading, without the streaks of inpainting at this size.
- Retone: the face, its rim of light and the glow in the joints move to cream, keeping the owner's
  light and shade (lib.retone).
- Arrow: the owner's glyph is traced and fitted in turn_arrow.py; the fitted shape is filled at the
  picture's resolution, squashed to the owner's glyph perspective, lighter on top and darker below
  like the button's arrow, with a soft dark edge under it like the painted tick has.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage

from checkpoints import PAD_STONE_OUT_PX, shrink, source
from exit_pads import face_ellipse, hires_pad, stone_width, tile_box
from lib import CREAM, LEAF, lit_mask, retone, tick_mask, write_part
from turn_arrow import bounds, fit, render

# Arrow width as a share of the face width (the owner's tick is ~0.45 of it; the arrow is a little
# larger than the old 0.5 so the ring reads at game size).
ARROW_SHARE = 0.52
# Vertical squash of the arrow: the owner's glyphs are drawn at about 0.7 of their plain height.
SQUASH = 0.7
# Arrow shading: top/bottom tone factors on LEAF; strength of the soft dark edge under it and its
# offset/blur as shares of the face width; a thin light rim on the arrow's upper edge.
TOP, BOTTOM = 1.3, 0.78
SHADE, SHADE_DROP, SHADE_BLUR = 0.3, 0.012, 0.01
RIM = 0.18
# How strongly the face keeps the owner's light and shade after retoning (1 = all of it).
KEEP_LIGHT = 0.8
# Reach of the ring of light round the face, as a share of the face width.
RING = 0.03
# Paint-out: grow of the tick mask to take its glow (share of face width) and the fill's blur.
TICK_GROW, FILL_BLUR = 0.04, 0.12


def face(rgba: np.ndarray) -> tuple[np.ndarray, tuple[float, float], float]:
    """The lit face (the lime ellipse inside the stones, without the joint glow): mask, centre, width."""
    lit = lit_mask(rgba) > 0.5
    m = ndimage.binary_fill_holes(ndimage.binary_closing(lit, iterations=4))
    # The thin glowing joints between stones touch the face: a wide opening drops them.
    disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, disc) > 0
    lab, n = ndimage.label(m)
    m = lab == int(np.argmax(ndimage.sum(m, lab, range(1, n + 1)))) + 1
    cnt, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (cx, cy), (a, b), _ = cv2.fitEllipse(max(cnt, key=cv2.contourArea))
    return m, (cx, cy), float(max(a, b))


def paint_out(rgba: np.ndarray, face_m: np.ndarray, tick: np.ndarray, face_w: float) -> np.ndarray:
    """Fill the tick (and its glow) from the face around it by normalised convolution."""
    out = rgba.copy()
    hole = ndimage.binary_dilation(tick, iterations=max(1, int(TICK_GROW * face_w)))
    w = (face_m & ~hole).astype(np.float32)
    s = FILL_BLUR * face_w
    num = cv2.GaussianBlur(rgba[..., :3].astype(np.float32) * w[..., None], (0, 0), s)
    den = cv2.GaussianBlur(w, (0, 0), s)[..., None]
    fill = num / np.maximum(den, 1e-4)
    k = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 0.015 * face_w)[..., None] * face_m[..., None]
    out[..., :3] = rgba[..., :3] * (1 - k) + fill * k
    return out


def tile() -> tuple[np.ndarray, tuple[float, float]]:
    """The turn tile at the picture's resolution, and its anchor (face centre) in those px."""
    green = source("green")
    face_m, _, face_w = face(green)
    # Centre on the exit pads' own face ellipse, so the arrow sits on the anchor they use.
    cx, cy, _, _ = face_ellipse(green, "green")
    h, w = green.shape[:2]

    img = paint_out(green, face_m, tick_mask(green), face_w)
    # Retone mask: the whole face (its deeper greens fall outside lit_mask's hue window), the ring of
    # light round it, and the glow in the joints.
    lit = np.clip(lit_mask(img) * 1.6, 0, 1)
    ring = ndimage.binary_dilation(face_m, iterations=int(RING * face_w)) & (lit_mask(img) > 0.05)
    lit = np.maximum(lit, (face_m | ring).astype(np.float32))
    lit = np.clip(cv2.GaussianBlur(lit.astype(np.float32), (0, 0), 1.5), 0, 1)
    img = retone(img, lit, CREAM, keep_light=KEEP_LIGHT)

    # The arrow, fitted to the owner's glyph, filled at this resolution in the face's perspective.
    p = fit()
    # The fitted tail cap (0.6 of the ring's half width) leaves a ragged end at this size: round it fully.
    p[9] = 1.0
    x0, y0, x1, y1 = bounds(p)
    scale = ARROW_SHARE * face_w / (x1 - x0)
    arrow = render(p, h, w, scale=scale, squash=SQUASH, ss=3, at=((cx, cy), ((x0 + x1) / 2, (y0 + y1) / 2)))

    ys = np.nonzero(arrow.max(axis=1) > 0.01)[0]
    v = np.clip((np.arange(h) - ys.min()) / max(1, ys.max() - ys.min()), 0, 1)[:, None, None]
    tone = np.clip(np.array(LEAF, dtype=float) * (TOP + (BOTTOM - TOP) * v), 0, 255)
    # A thin light rim along the arrow's upper edges (the owner's glyphs catch the light on top).
    edge = np.clip(arrow - ndimage.shift(arrow, (0.008 * face_w, 0), order=1), 0, 1)[..., None]
    tone = tone + (255 - tone) * edge * RIM
    under = ndimage.shift(arrow, (SHADE_DROP * face_w, 0.3 * SHADE_DROP * face_w), order=1)
    under = cv2.GaussianBlur(under.astype(np.float32), (0, 0), SHADE_BLUR * face_w) * SHADE
    rgb = img[..., :3] * (1 - under[..., None])
    a = arrow[..., None]
    img[..., :3] = rgb * (1 - a) + tone * a
    return img, (cx, cy)


def run() -> None:
    img, _ = tile()
    # Same scale and anchor as the green exit pad (exit_pads.hires_pad), so the two line up exactly.
    pad, anchor = hires_pad("green")
    small = shrink(img, PAD_STONE_OUT_PX / stone_width(source("green"), "green"))
    assert small.shape == pad.shape, (small.shape, pad.shape)
    write_part("turn", {"turn": (small, anchor, 1.0 / PAD_STONE_OUT_PX, tile_box("green"))})

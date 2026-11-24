"""Pressure plate: the owner's green exit pad, enlarged first, then the tick painted out and the face
retoned lavender (shared with the gate) at output resolution, with a raised round lavender button
on the face so it reads as something to stand on and press, not as an exit.

Order matters for sharpness: enlarging a finished 1x plate also enlarges the inpainting smudge, so
the pad is enlarged first and the face is rebuilt at the output size, where the fill is a smooth
fit of the face's own shading. The button is drawn as a crisp shape at 4x and scaled down, in the
owner's button style (18-sheet-action-buttons, 19-sheet-play-and-round-buttons): a soft top with a
light rim and a white highlight along its upper edge, a darker side band and a soft shadow, so it
echoes the robot theme's purple round button on its ring.
"""
from __future__ import annotations

import colorsys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from exit_pads import anchor, source_pad
from lib import CELLS_PER_SOURCE_PX, lit_mask, retone, tick_mask, upscale, write_part

try:  # The exit-pad session's edge-aware enlargement, when present; else lib.upscale.
    from enlarge import enlarge as _enlarge
except ImportError:
    _enlarge = None

# Output pixels per source pixel (~309 px wide). Lavender of the plate face (gate is the same hue).
FACTOR = 3
FACE = "#A77DF2"
# Button size as a fraction of the face ellipse, and how far it stands up (output px).
BUTTON_SCALE = 0.5
BUTTON_RISE = 11.0
SUPER = 4
ALPHA_RANGE = (150, 260)


def _face_ellipse(src: np.ndarray) -> tuple[float, float, float, float]:
    """Centre (x, y) and semi-axes (a horizontal, b vertical) of the lit face, in source px."""
    face = ndimage.binary_fill_holes(ndimage.binary_closing(lit_mask(src) > 0.5, iterations=6))
    contours, _ = cv2.findContours(face.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (cx, cy), (d1, d2), angle = cv2.fitEllipse(max(contours, key=cv2.contourArea))
    # fitEllipse gives the axes in its own order; the face is wider than tall.
    return cx, cy, max(d1, d2) / 2, min(d1, d2) / 2


def _to_out(v: float) -> float:
    """A source pixel coordinate in output pixels (cv2.resize keeps pixel centres)."""
    return (v + 0.5) * FACTOR - 0.5


def _paint_out_smooth(rgba: np.ndarray, hole: np.ndarray, region: np.ndarray) -> np.ndarray:
    """Fill `hole` with a smooth polynomial fit of the colour in `region` minus the hole."""
    h, w = hole.shape
    ys, xs = np.mgrid[0:h, 0:w]
    xn, yn = (xs - w / 2) / w, (ys - h / 2) / h
    terms = [xn ** i * yn ** j for i in range(5) for j in range(5 - i)]
    fit_px = region & ~hole
    A = np.stack([t[fit_px] for t in terms], axis=1)
    out = rgba.copy()
    soft = np.clip(ndimage.gaussian_filter(hole.astype(float), 2.0) * 1.6, 0, 1)
    for ch in range(3):
        coef, *_ = np.linalg.lstsq(A, rgba[..., ch][fit_px], rcond=None)
        model = sum(c * t for c, t in zip(coef, terms))
        out[..., ch] = rgba[..., ch] * (1 - soft) + np.clip(model, 0, 255) * soft
    return out


def _hls(hex_colour: str, dl: float = 0.0, ds: float = 0.0) -> np.ndarray:
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return np.array(colorsys.hls_to_rgb(h, np.clip(l + dl, 0, 1), np.clip(s + ds, 0, 1))) * 255


def _ellipse(xs, ys, cx, cy, a, b) -> np.ndarray:
    return ((xs - cx) / a) ** 2 + ((ys - cy) / b) ** 2


def _over(base: np.ndarray, colour: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = alpha[..., None]
    return base * (1 - a) + colour * a


def _button(rgba: np.ndarray, cx: float, cy: float, a: float, b: float) -> np.ndarray:
    """Lay a raised round button (seen at the pad's angle) centred on the face, drawn at SUPER x."""
    h, w = rgba.shape[:2]
    s = SUPER
    ys, xs = np.mgrid[0:h * s, 0:w * s].astype(np.float32)
    xs, ys = (xs + 0.5) / s - 0.5, (ys + 0.5) / s - 0.5
    rise = BUTTON_RISE
    top_cy = cy - rise * 0.55
    base_cy = top_cy + rise
    px = 1.0 / max(a, b)  # about one output pixel in ellipse units, for the edge ramps

    top_d = np.sqrt(_ellipse(xs, ys, cx, top_cy, a, b))
    base_d = np.sqrt(_ellipse(xs, ys, cx, base_cy, a, b))
    # Side band: everything between the top ellipse and the base ellipse, within the button's width.
    between = (ys >= top_cy) & (ys <= base_cy) & (np.abs(xs - cx) <= a)
    side = np.maximum(np.clip((1 - base_d) / px, 0, 1), between.astype(np.float32) * np.clip((a - np.abs(xs - cx)) / (a * px), 0, 1))
    cap = np.clip((1 - top_d) / (px * 1.2), 0, 1)
    # Soft contact shadow on the face, a little wider than the base.
    shadow = np.clip((1.18 - np.sqrt(_ellipse(xs, ys, cx, base_cy + 2.0, a * 1.04, b * 1.1))) / 0.22, 0, 1) ** 1.5 * 0.45

    canvas = np.repeat(np.repeat(rgba[..., :3], s, axis=0), s, axis=1).astype(np.float32)
    canvas = _over(canvas, np.zeros(3, np.float32), shadow)
    # Side: darker lavender, lighter towards the left (the owner's light comes from the top left).
    u = np.clip((xs - (cx - a)) / (2 * a), 0, 1)[..., None]
    side_col = _hls(FACE, -0.17, -0.08) * (1 - u) + _hls(FACE, -0.28, -0.15) * u
    canvas = canvas * (1 - side[..., None]) + side_col * side[..., None]
    # Top: light lavender, a touch lighter at the top left, a soft darker band near the lower rim.
    v = np.clip((ys - (top_cy - b)) / (2 * b), 0, 1)[..., None]
    top_col = _hls(FACE, 0.10, 0.05) * (1 - v) + _hls(FACE, 0.02, 0.05) * v
    rim_dark = np.clip((top_d - 0.80) / 0.2, 0, 1)[..., None] * np.clip((ys - top_cy) / b, 0, 1)[..., None]
    top_col = top_col * (1 - 0.18 * rim_dark)
    canvas = canvas * (1 - cap[..., None]) + top_col * cap[..., None]
    # A thin light rim round the top and a white highlight arc along its upper edge.
    rim = np.clip(1 - np.abs(top_d - 0.93) / 0.05, 0, 1) * cap
    upper = np.clip((top_cy - ys) / b + 0.15, 0, 1)
    canvas = _over(canvas, np.full(3, 255, np.float32), rim * (0.25 + 0.45 * upper))
    hi_d = np.sqrt(_ellipse(xs, ys, cx - a * 0.06, top_cy - b * 0.28, a * 0.66, b * 0.38))
    highlight = np.clip((1 - hi_d) / 0.25, 0, 1) * np.clip((top_cy - b * 0.1 - ys) / (b * 0.3), 0, 1) * cap
    canvas = _over(canvas, np.full(3, 255, np.float32), highlight * 0.55)

    small = cv2.resize(canvas, (w, h), interpolation=cv2.INTER_AREA)
    out = rgba.copy()
    out[..., :3] = np.clip(small, 0, 255)
    return out


def build() -> tuple[np.ndarray, tuple[float, float]]:
    """The plate picture (RGBA float, output px) and its anchor (face centre, output px)."""
    src = source_pad("green")
    # Alpha is steepened only at strong edges: the owner's soft shadow under the pad is light grey
    # on white, and the default range turns it into a hard light band round the foot.
    big = _enlarge(src, FACTOR, alpha_range=ALPHA_RANGE) if _enlarge else upscale(src, FACTOR, sharpen=0.6)
    h, w = big.shape[:2]
    ex, ey, ea, eb = _face_ellipse(src)
    cx, cy, a, b = _to_out(ex), _to_out(ey), ea * FACTOR, eb * FACTOR
    ys, xs = np.mgrid[0:h, 0:w]

    # Tick: found on the source pad, carried up and widened past its soft, enlarged edge.
    tick = cv2.resize(tick_mask(src).astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR) > 0.1
    tick = ndimage.binary_dilation(tick, iterations=2 * FACTOR)
    inner = _ellipse(xs, ys, cx, cy, a * 0.86, b * 0.80) <= 1
    blank = _paint_out_smooth(big, tick & inner, inner)

    lit = np.clip(lit_mask(blank) * 1.6, 0, 1)
    plate = retone(blank, lit, FACE, keep_light=0.75)
    plate = _button(plate, cx, cy, a * BUTTON_SCALE, b * BUTTON_SCALE)

    ax, ay = anchor("green", src)
    # Same convention as exit_pads.pad(): the source anchor times the factor.
    return plate, (ax * FACTOR, ay * FACTOR)


def run() -> None:
    plate, at = build()
    write_part("plate", {"plate": (plate, at, CELLS_PER_SOURCE_PX / FACTOR)})

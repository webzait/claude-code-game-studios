"""Pressure plate: the owner's high-resolution green exit pad (checkpoint-actief) with the tick painted
out, the face and the joint glow retoned lavender (shared with the gate), and a raised round lavender
button on the face so it reads as something to stand on and press, not as an exit.

Everything is done on the owner's picture at full size (~800 px wide) and shrunk once at the end:

- retone in CIE Lab: every lime/green pixel keeps its own lightness pattern (shifted so the face's
  mean lands on the lavender's lightness) and its own chroma pattern (scaled to the lavender's), with
  the hue set to the lavender's; light glow pixels are pulled back into the sRGB gamut by lowering
  their chroma, not by clipping (clipping would push them pink or blue);
- the tick is found as the light, low-chroma shape inside the face, widened past its glow halo, and
  filled with a smooth polynomial fit of the face colour around it (before the retone);
- the button is drawn analytically at full size (crisp after the shrink) in the owner's round-button
  style: a light glossy top with a white highlight, a darker side band, a soft contact shadow.

Geometry follows the exit pads: the stone body is `PAD_STONE_OUT_PX` wide, cells per px is
`1 / PAD_STONE_OUT_PX`, the anchor is the face centre in output px. When `exit_pads.hires_pad` exists
its size and anchor are used, so the plate lines up exactly with the green exit pad.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage

from checkpoints import PAD_STONE_OUT_PX, source
from lib import write_part

FACE = "#A77DF2"
# Button size as a fraction of the face ellipse, and how far it stands up (fraction of face height).
BUTTON_SCALE = 0.52
BUTTON_RISE = 0.2
# How much of the owner's lightness contrast the lavender keeps (1 = all).
KEEP_LIGHT = 0.9


def _lab(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor((np.clip(rgb, 0, 255) / 255).astype(np.float32), cv2.COLOR_RGB2Lab)


def _rgb(lab: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_Lab2RGB) * 255


def _target() -> tuple[float, float, float]:
    """Lightness, chroma and hue angle (radians) of the lavender."""
    L, a, b = _lab(np.array([[[int(FACE[i:i + 2], 16) for i in (1, 3, 5)]]], float))[0, 0]
    return float(L), float(np.hypot(a, b)), float(np.arctan2(b, a))


def _lch(rgba: np.ndarray):
    lab = _lab(rgba[..., :3])
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    return L, np.hypot(a, b), np.degrees(np.arctan2(b, a)) % 360


def _face_mask(rgba: np.ndarray) -> np.ndarray:
    """The saturated green face (not the yellow-lime glow in the joint round it), holes filled."""
    L, C, h = _lch(rgba)
    green = (h > 116) & (h < 150) & (C > 60) & (rgba[..., 3] > 200)
    green = ndimage.binary_opening(green, iterations=2)
    lab, n = ndimage.label(green)
    big = lab == (1 + int(np.argmax(ndimage.sum(green, lab, range(1, n + 1)))))
    return ndimage.binary_fill_holes(ndimage.binary_closing(big, iterations=8))


def _face_ellipse(rgba: np.ndarray) -> tuple[float, float, float, float]:
    """Centre (x, y) and semi-axes (horizontal, vertical) of the face, in picture px."""
    contours, _ = cv2.findContours(_face_mask(rgba).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (cx, cy), (d1, d2), _ = cv2.fitEllipse(max(contours, key=cv2.contourArea))
    return cx, cy, max(d1, d2) / 2, min(d1, d2) / 2


def _ellipse(xs, ys, cx, cy, a, b) -> np.ndarray:
    return ((xs - cx) / a) ** 2 + ((ys - cy) / b) ** 2


def _paint_out_tick(rgba: np.ndarray, face: tuple[float, float, float, float]) -> np.ndarray:
    """Remove the white tick: fill it with a smooth fit of the face colour in a band around it."""
    cx, cy, a, b = face
    h, w = rgba.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    inner = _ellipse(xs, ys, cx, cy, a * 0.9, b * 0.86) <= 1
    L, C, _ = _lch(rgba)
    tick = inner & (L > 84) & (C < 65)
    lab, n = ndimage.label(tick)
    tick = lab == (1 + int(np.argmax(ndimage.sum(tick, lab, range(1, n + 1)))))
    tick = ndimage.binary_fill_holes(tick)
    hole = ndimage.binary_dilation(tick, iterations=26) & inner
    ring = ndimage.binary_dilation(hole, iterations=45) & inner & ~hole
    xn, yn = (xs - cx) / a, (ys - cy) / b
    terms = [xn ** i * yn ** j for i in range(4) for j in range(4 - i)]
    A = np.stack([t[ring] for t in terms], axis=1)
    soft = np.clip(ndimage.gaussian_filter(hole.astype(float), 4.0) * 1.8, 0, 1) * inner
    out = rgba.copy()
    for ch in range(3):
        coef, *_ = np.linalg.lstsq(A, rgba[..., ch][ring], rcond=None)
        model = np.clip(sum(c * t for c, t in zip(coef, terms)), 0, 255)
        out[..., ch] = rgba[..., ch] * (1 - soft) + model * soft
    return out


def _in_gamut(lab: np.ndarray) -> np.ndarray:
    lin = cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_Lab2RGB)
    return np.all((lin >= -0.002) & (lin <= 1.002), axis=-1)


def _retone(rgba: np.ndarray, face_mask: np.ndarray) -> np.ndarray:
    """Lime and green to lavender in Lab, keeping the owner's lightness and chroma patterns."""
    L, C, h = _lch(rgba)
    tL, tC, th = _target()
    # Weight: the green-to-yellow hues, faded in with chroma so the grey stone keeps its colour.
    hue_w = np.clip((h - 72) / 14, 0, 1) * np.clip((165 - h) / 14, 0, 1)
    weight = hue_w * np.clip((C - 10) / 18, 0, 1)
    mean_L, mean_C = L[face_mask].mean(), C[face_mask].mean()
    new_L = tL + (L - mean_L) * KEEP_LIGHT
    new_C = C * (tC / mean_C)
    lab = np.dstack([new_L, new_C * np.cos(th), new_C * np.sin(th)]).astype(np.float32)
    # Bring out-of-gamut pixels back by lowering chroma in steps.
    for s in np.linspace(0.95, 0.2, 16):
        bad = ~_in_gamut(lab)
        if not bad.any():
            break
        lab[..., 1:][bad] *= s / (s + 0.05)
    new = np.clip(_rgb(lab), 0, 255)
    k = weight[..., None]
    out = rgba.copy()
    out[..., :3] = rgba[..., :3] * (1 - k) + new * k
    return out


def _shade(dL: float, dC: float = 0.0) -> np.ndarray:
    tL, tC, th = _target()
    c = max(tC + dC, 0)
    return np.clip(_rgb(np.array([[[tL + dL, c * np.cos(th), c * np.sin(th)]]], np.float32))[0, 0], 0, 255)


def _over(base: np.ndarray, colour: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = alpha[..., None]
    return base * (1 - a) + colour * a


def _button(rgba: np.ndarray, cx: float, cy: float, a: float, b: float, rise: float) -> np.ndarray:
    """Lay a raised round button (seen at the pad's angle) centred on the face, at full size."""
    h, w = rgba.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    top_cy = cy - rise * 0.6
    base_cy = top_cy + rise
    px = 1.0 / b  # one picture px in ellipse units (vertical, the tighter one)

    top_d = np.sqrt(_ellipse(xs, ys, cx, top_cy, a, b))
    base_d = np.sqrt(_ellipse(xs, ys, cx, base_cy, a, b))
    between = (ys >= top_cy) & (ys <= base_cy)
    side_x = np.clip((a - np.abs(xs - cx)) / 1.2, 0, 1)
    side = np.maximum(np.clip((1 - base_d) / (1.2 * px), 0, 1), between * side_x)
    cap = np.clip((1 - top_d) / (1.2 * px), 0, 1)
    shadow = np.clip((1.16 - np.sqrt(_ellipse(xs, ys, cx, base_cy + rise * 0.25, a * 1.03, b * 1.08))) / 0.2, 0, 1) ** 1.5 * 0.5

    canvas = rgba[..., :3].astype(np.float32)
    canvas = _over(canvas, np.array([40, 10, 80], np.float32), shadow)
    # Side: darker lavender, lighter on the left (the owner's light is from the top left), with a
    # darker line where it meets the face, for a clean silhouette at game size.
    u = np.clip((xs - (cx - a)) / (2 * a), 0, 1)[..., None]
    side_col = _shade(-14, 4) * (1 - u) + _shade(-27, 2) * u
    edge = np.clip((base_d - (1 - 5 * px)) / (5 * px), 0, 1)[..., None] * 0.35
    side_col = side_col * (1 - edge) + _shade(-40, -10) * edge
    canvas = canvas * (1 - side[..., None]) + side_col * side[..., None]
    # Top: light lavender, lighter at the top left, a soft darker band near the lower rim.
    v = np.clip((ys - (top_cy - b)) / (2 * b), 0, 1)[..., None]
    top_col = _shade(13, -8) * (1 - v) + _shade(3, -2) * v
    rim_dark = (np.clip((top_d - 0.78) / 0.22, 0, 1) * np.clip((ys - top_cy) / b, 0, 1))[..., None]
    top_col = top_col * (1 - 0.14 * rim_dark)
    canvas = canvas * (1 - cap[..., None]) + top_col * cap[..., None]
    # A thin light rim round the top, and a glossy white highlight along its upper part.
    rim = np.clip(1 - np.abs(top_d - 0.955) / 0.03, 0, 1) * cap
    upper = np.clip((top_cy - ys) / b + 0.2, 0, 1)
    canvas = _over(canvas, np.full(3, 255, np.float32), rim * (0.2 + 0.5 * upper))
    hi_d = np.sqrt(_ellipse(xs, ys, cx - a * 0.08, top_cy - b * 0.32, a * 0.62, b * 0.34))
    highlight = np.clip((1 - hi_d) / 0.3, 0, 1) * np.clip((top_cy - b * 0.08 - ys) / (b * 0.3), 0, 1) * cap
    canvas = _over(canvas, np.full(3, 255, np.float32), highlight * 0.6)

    out = rgba.copy()
    out[..., :3] = np.clip(canvas, 0, 255)
    return out


def _resize(rgba: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Premultiplied area resize to an exact (w, h): no fringes."""
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    small = cv2.resize(pre, size, interpolation=cv2.INTER_AREA)
    alpha = np.clip(small[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


def stone_px(rgba: np.ndarray) -> int:
    """The pad's stone width in its picture: the widest run of solid pixels."""
    return int(max((row > 250).sum() for row in rgba[..., 3]))


def hires_plate() -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """The plate at the owner's picture size and its face ellipse (picture px)."""
    src = source("green")
    face = _face_ellipse(src)
    blank = _paint_out_tick(src, face)
    plate = _retone(blank, _face_mask(src))
    cx, cy, a, b = face
    return _button(plate, cx, cy, a * BUTTON_SCALE, b * BUTTON_SCALE, b * BUTTON_RISE), face


def build() -> tuple[np.ndarray, tuple[float, float]]:
    """The plate picture (RGBA float, output px) and its anchor (face centre, output px)."""
    big, (cx, cy, _, _) = hires_plate()
    h, w = big.shape[:2]
    try:  # The exit-pad session's green pad: take its size and anchor, so the two line up exactly.
        from exit_pads import hires_pad
        pad, at = hires_pad("green")
        size = (pad.shape[1], pad.shape[0])
    except ImportError:
        f = PAD_STONE_OUT_PX / stone_px(source("green"))
        size, at = (round(w * f), round(h * f)), None
    plate = _resize(big, size)
    sx, sy = size[0] / w, size[1] / h
    if at is None:
        at = ((cx + 0.5) * sx - 0.5, (cy + 0.5) * sy - 0.5)
    return plate, at


def run() -> None:
    plate, at = build()
    write_part("plate", {"plate": (plate, at, 1.0 / PAD_STONE_OUT_PX)})

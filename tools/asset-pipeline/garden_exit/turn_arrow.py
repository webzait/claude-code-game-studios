"""The clockwise arrow of the owner's turn button (top right of 18-sheet-action-buttons), traced.

The glyph on the sheet is about 30 px; enlarged it is soft. So its form is measured instead: a ring
(centre, outer and inner radius, a slight vertical stretch) running clockwise from a rounded tail to
an arrowhead (base half-widths inside and outside the ring, length, tip offset). The parameters are
fitted to the glyph's whiteness by least squares on a supersampled render, then the shape is filled
again at any size with clean edges. Angles are degrees in screen space (y down, so increasing is
clockwise); lengths are source pixels of the button crop.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage, optimize

from lib import load

# The button's glyph on the sheet (rows, columns) and a starting guess near the fitted form.
BUTTON = (slice(24, 58), slice(78, 118))
GUESS = [19.0, 16.5, 14.5, 9.7, 72.5, 320.6, 9.0, 8.4, 1.0, 0.6, 7.3, 1.02]
NAMES = ["cx", "cy", "outer", "inner", "tail", "head", "base_in", "length", "tip_offset", "tail_cap", "base_out", "stretch"]


def owner_glyph() -> np.ndarray:
    """0..1 whiteness of the arrow on the owner's button (its light rim left out)."""
    rgb = load("18-sheet-action-buttons")[BUTTON]
    hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)
    w = np.clip((hsv[..., 2] / 255 - 0.55) / 0.4, 0, 1) * np.clip(1 - hsv[..., 1] / 255 / 0.45, 0, 1)
    lab, n = ndimage.label(w > 0.35)
    sizes = ndimage.sum(w > 0.35, lab, range(1, n + 1))
    keep = ndimage.binary_dilation(lab == int(np.argmax(sizes)) + 1, iterations=2)
    # The lower part of the owner's arrow is shaded bluish; lift it so the shape, not the shading, is fitted.
    return np.clip(w * keep * 1.25, 0, 1)


def render(p, height: int, width: int, scale: float = 1.0, squash: float = 1.0, ss: int = 4, at=None) -> np.ndarray:
    """The arrow as 0..1 coverage on a height x width grid, supersampled `ss` times per axis.
    `scale` is output px per source px, `squash` the extra vertical factor (the face's perspective);
    `at` = ((X, Y) output px, (x, y) source px) puts that source point at that output point."""
    cx, cy, outer, inner, tail, head, base_in, length, tip_off, cap, base_out, stretch = p
    (ox, oy), (sx, sy) = at if at else ((0.0, 0.0), (0.0, 0.0))
    ys, xs = np.mgrid[0:height * ss, 0:width * ss]
    x = sx + ((xs + 0.5) / ss - ox) / scale
    y = sy + ((ys + 0.5) / ss - oy) / (scale * squash)
    dx = x - cx
    dy = (y - cy) * stretch
    d = np.hypot(dx, dy)
    th = np.degrees(np.arctan2(dy, dx)) % 360
    ring = (d <= outer) & (d >= inner) & ((th - tail) % 360 <= (head - tail) % 360)
    mid, half = (outer + inner) / 2, (outer - inner) / 2
    a0 = np.radians(tail)
    cap_m = np.hypot(dx - mid * np.cos(a0), dy - mid * np.sin(a0)) <= half * cap
    a1 = np.radians(head)
    u = np.array([np.cos(a1), np.sin(a1)])
    t = np.array([-np.sin(a1), np.cos(a1)])
    p1, p2, p3 = (mid - base_in) * u, (mid + base_out) * u, (mid + tip_off) * u + length * t

    def side(a, b):
        return (b[0] - a[0]) * (dy - a[1]) - (b[1] - a[1]) * (dx - a[0])

    s1, s2, s3 = side(p1, p2), side(p2, p3), side(p3, p1)
    tri = ((s1 >= 0) & (s2 >= 0) & (s3 >= 0)) | ((s1 <= 0) & (s2 <= 0) & (s3 <= 0))
    m = (ring | cap_m | tri).astype(np.float32)
    if scale * ss >= 8:
        # The owner's corners are soft: round the arrowhead's points (radius ~0.6 source px).
        r = max(1, int(round(0.6 * scale * ss)))
        disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, disc)
    return m.reshape(height, ss, width, ss).mean(axis=(1, 3))


def fit() -> np.ndarray:
    """The arrow's parameters, fitted to the owner's glyph (deterministic: Nelder-Mead from GUESS)."""
    target = owner_glyph()
    h, w = target.shape

    def cost(p):
        return float(((render(p, h, w) - target) ** 2).sum())

    res = optimize.minimize(cost, GUESS, method="Nelder-Mead", options={"maxiter": 3000, "xatol": 1e-3, "fatol": 1e-4})
    return res.x


def bounds(p) -> tuple[float, float, float, float]:
    """Extent (x0, y0, x1, y1) of the arrow in source px, measured on a fine render."""
    k = 8
    m = render(p, 40 * k, 50 * k, scale=k, ss=1)
    ys, xs = np.nonzero(m > 0.5)
    return xs.min() / k, ys.min() / k, (xs.max() + 1) / k, (ys.max() + 1) / k

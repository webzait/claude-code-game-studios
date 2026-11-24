"""Edge-aware enlargement of a small painted RGBA cut-out (no models, no outside pictures).

`enlarge(rgba, factor)` makes a picture `factor` times larger that keeps the painting's smooth
interiors but has crisp edges where the painting has edges:

1. Colour is bled outward from the solid pixels into the transparent and edge pixels first, so
   no background colour (white of the owner's sheet) can leak back in as a halo.
2. Colour and alpha are enlarged with Lanczos (smooth, faithful to the 1x picture).
3. Each channel is then *steepened*: where it changes by a lot within a small neighbourhood (an
   edge), the soft ramp is replaced by a ramp about one output pixel wide, centred on the same
   sub-pixel place the soft ramp crosses its half-way level, and running exactly between the
   local low and high values. Nothing overshoots (no ringing, no halo), nothing moves (the edge
   stays where the owner painted it), and smooth gradients, whose local range is small, are left
   alone. The steepened ramp follows the Lanczos isocontour, which is smooth, so no jaggies.
4. A last back-projection step keeps the result honest: scaled back down, it matches the 1x
   picture (the difference is pushed back in, smoothly, outside the crisp edges).
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage


def _disk(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r + 0.5


def bleed(rgb: np.ndarray, solid: np.ndarray) -> np.ndarray:
    """Every pixel outside `solid` gets the colour of the nearest solid pixel."""
    if solid.all() or not solid.any():
        return rgb.copy()
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    return rgb[iy, ix]


def steepen(u: np.ndarray, radius: float, width: float, low: float, high: float) -> np.ndarray:
    """Replace soft edges in one channel by ~`width`-px ramps between the local extremes.

    `radius`: neighbourhood (output px) in which an edge's two sides are looked for.
    `low`/`high`: local range (channel units) below which nothing changes, above which the edge
    is fully crisp; in between the two are blended (so faint shading is never terraced)."""
    r = max(1, int(round(radius)))
    fp = _disk(r)
    lo = ndimage.minimum_filter(u, footprint=fp)
    hi = ndimage.maximum_filter(u, footprint=fp)
    # Smooth the extremes so their square/disk footprint cannot print steps into the result.
    lo = cv2.GaussianBlur(lo, (0, 0), r * 0.35)
    hi = cv2.GaussianBlur(hi, (0, 0), r * 0.35)
    lo = np.minimum(lo, u)
    hi = np.maximum(hi, u)
    rng = hi - lo
    mid = (lo + hi) / 2
    gy, gx = np.gradient(cv2.GaussianBlur(u, (0, 0), 0.7))
    g = np.hypot(gx, gy)
    # Signed distance (output px) to the half-way contour, then a ramp `width` px wide.
    d = (u - mid) / np.maximum(g, 1e-6)
    t = np.clip(0.5 + d / width, 0, 1)
    crisp = lo + rng * t
    w = np.clip((rng - low) / max(high - low, 1e-6), 0, 1)
    w = w * w * (3 - 2 * w)
    return u + (crisp - u) * w


def _resize(img: np.ndarray, size: tuple[int, int], interp=cv2.INTER_LANCZOS4) -> np.ndarray:
    return cv2.resize(img.astype(np.float32), size, interpolation=interp)


def enlarge(rgba: np.ndarray, factor: float, width: float = 1.3, colour_range: tuple[float, float] = (35, 90),
            alpha_range: tuple[float, float] = (70, 150), back_project: int = 2) -> np.ndarray:
    """`factor` times larger RGBA (float 0..255) with crisp edges and smooth interiors.

    `width`: edge ramp width in output px. `colour_range`/`alpha_range`: local contrast (0..255)
    from which an edge starts to be steepened / is fully steepened."""
    h, w = rgba.shape[:2]
    size = (round(w * factor), round(h * factor))
    alpha = rgba[..., 3].astype(float)
    solid = alpha > 160
    rgb = bleed(rgba[..., :3].astype(float), solid)
    # Keep the cut-out's own colour where it is soft but away from the solid edge (glow).
    near_edge = ndimage.distance_transform_edt(~solid) <= 2.5
    rgb = np.where((~solid & ~near_edge)[..., None] & (alpha[..., None] > 8), rgba[..., :3], rgb)

    radius = factor * 1.6
    big_rgb = np.clip(_resize(rgb, size), 0, 255)
    big_a = np.clip(_resize(alpha, size), 0, 255)
    out_rgb = np.dstack([steepen(big_rgb[..., c], radius, width, *colour_range) for c in range(3)])
    out_a = steepen(big_a, radius, width, *alpha_range)

    # Back-projection: the result, scaled down, should be the 1x picture. Push the (smooth)
    # difference back in, but only where nothing was steepened, so edges stay crisp.
    calm_rgb = 1 - np.clip(np.abs(out_rgb - big_rgb) / 6, 0, 1)
    calm_a = 1 - np.clip(np.abs(out_a - big_a) / 6, 0, 1)
    for _ in range(back_project):
        down = _resize(out_rgb, (w, h), cv2.INTER_AREA)
        err = _resize(rgb - down, size, cv2.INTER_CUBIC)
        out_rgb = out_rgb + err * calm_rgb
        down = _resize(out_a, (w, h), cv2.INTER_AREA)
        err = _resize(alpha - down, size, cv2.INTER_CUBIC)
        out_a = out_a + err * calm_a
    return np.dstack([np.clip(out_rgb, 0, 255), np.clip(out_a, 0, 255)])

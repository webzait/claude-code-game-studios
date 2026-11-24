"""Exit pad in three looks (grey, green, rays), cut from 22-sheet-exit-pad-states.

`source_pad(look)` is the cut-out at the owner's size; `pad(look)` the enlarged one the game
uses, with its anchor (the face centre) in pixels. Other parts derive from `source_pad('green')`.

The owner's sheet is tiny (each pad ~100 px wide), so `pad` rebuilds what an enlargement cannot
invent from the owner's picture itself, and nothing else:

- the silhouette of the stone body is the convex hull of two ellipses (the rim top and the base
  bottom) fitted to the pad's own outline, drawn antialiased at the output size, so it is a clean
  curve instead of a blurred, bumpy edge;
- the three rays are traced from the sheet (their saturated yellow), the traced outline smoothed
  and drawn antialiased at the output size;
- inside these shapes the colour is the owner's painting, enlarged with `enlarge.enlarge`
  (Lanczos, then edges steepened between their local extremes: crisp tick, face edge and stone
  joints, smooth shading, no ringing); colour is bled outward from the solid pixels, so no white
  of the sheet can show as a halo;
- the soft light glow around the rays stays soft (enlarged as it is); the faint drop shadow under
  each pad on the sheet is left out, like the cut-outs before.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage

from enlarge import enlarge
from lib import CELLS_PER_SOURCE_PX, bottom, crop, cut_out, face_centre, hue_sat_val, load, write_part

# Each pad's box on the sheet (x0, y0, x1, y1); the small red mark under the third is left out.
BOXES = {"grey": (5, 0, 108, 88), "green": (117, 0, 224, 88), "rays": (236, 0, 342, 86)}
SHEET = "22-sheet-exit-pad-states"

# Output size: FACTOR times the owner's sheet (~300 px wide pads).
FACTOR = 3
# Outlines are traced at TRACE times the sheet and smoothed along their length by SMOOTH sheet px.
TRACE = 8
SMOOTH = 0.9
# Antialiasing: shapes are drawn at SUPER times the output size and averaged down.
SUPER = 4


def source_pad(look: str) -> np.ndarray:
    return crop(cut_out(load(SHEET)), BOXES[look])


def anchor(look: str, rgba: np.ndarray) -> tuple[float, float]:
    """The face centre: measured on the green pad, carried to the others by their lowest solid row."""
    green = source_pad("green")
    _, cy, _ = face_centre(green)
    rise = bottom(green) - cy
    xs = np.nonzero((rgba[..., 3] > 128).any(axis=0))[0]
    return ((xs.min() + xs.max()) / 2, bottom(rgba) - rise)


def _window(look: str) -> tuple[np.ndarray, np.ndarray]:
    """The cut-out and the raw sheet colour over exactly the area `source_pad` covers."""
    rgb = load(SHEET)
    cut = cut_out(rgb)
    x0, y0, x1, y1 = BOXES[look]
    cut, rgb = cut[y0:y1, x0:x1], rgb[y0:y1, x0:x1]
    ys, xs = np.nonzero(cut[..., 3] > 3)
    m = 2  # the margin lib.crop keeps
    sy = slice(max(0, ys.min() - m), min(cut.shape[0], ys.max() + 1 + m))
    sx = slice(max(0, xs.min() - m), min(cut.shape[1], xs.max() + 1 + m))
    return cut[sy, sx], rgb[sy, sx]


def _outlines(mask: np.ndarray, level: float = 0.5, min_area: float = 12) -> list[np.ndarray]:
    """Sub-pixel outlines (sheet px, pixel edges at integers) of a 0..1 map at `level`, smoothed."""
    h, w = mask.shape
    big = cv2.resize(mask.astype(np.float32), (w * TRACE, h * TRACE), interpolation=cv2.INTER_CUBIC)
    found, _ = cv2.findContours((big > level).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in found:
        if cv2.contourArea(c) < min_area * TRACE * TRACE:
            continue
        p = ndimage.gaussian_filter1d(c[:, 0, :].astype(float), SMOOTH * TRACE, axis=0, mode="wrap")
        out.append((p + 0.5) / TRACE)
    return out


def _ellipse(points: np.ndarray) -> tuple[float, float, float, float]:
    """Axis-aligned ellipse (cx, cy, rx, ry) through `points` by least squares."""
    x, y = points[:, 0], points[:, 1]
    a, b, c, d = np.linalg.lstsq(np.c_[x * x, y * y, x, y], np.ones(len(x)), rcond=None)[0]
    cx, cy = -c / (2 * a), -d / (2 * b)
    r = 1 + a * cx * cx + b * cy * cy
    return cx, cy, float(np.sqrt(r / a)), float(np.sqrt(r / b))


def _ellipse_points(e: tuple[float, float, float, float], n: int = 720) -> np.ndarray:
    cx, cy, rx, ry = e
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return np.c_[cx + rx * np.cos(t), cy + ry * np.sin(t)]


def _body(look: str) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """The stone body's outline (sheet px) as the hull of the rim-top and base-bottom ellipses,
    each fitted to the pad's own traced outline; and the rim-top ellipse.

    The rays pad's rim top is hidden under its glow, so it takes the green pad's rim-top ellipse,
    scaled and moved with the base-bottom ellipse the rays pad shows itself."""
    def fit(look: str):
        cut, _ = _window(look)
        outline = max(_outlines(cut[..., 3] / 255), key=len)
        x, y = outline[:, 0], outline[:, 1]
        y0, y1 = y.min(), y.max()
        if look == "rays":
            y0 = y1 - 45  # below the rays and their glow
        h = y1 - y0
        sel = y >= y0
        top = _ellipse(outline[sel & (y < y0 + 0.45 * h)]) if look != "rays" else None
        base = _ellipse(outline[sel & (y > y0 + 0.62 * h)])
        return top, base

    top, base = fit(look)
    if top is None:
        g_top, g_base = fit("green")
        s = base[2] / g_base[2]
        top = (base[0] + (g_top[0] - g_base[0]) * s, base[1] + (g_top[1] - g_base[1]) * s, g_top[2] * s, g_top[3] * s)
    hull = cv2.convexHull(np.vstack([_ellipse_points(top), _ellipse_points(base)]).astype(np.float32))[:, 0, :]
    return hull.astype(float), top


def _rays(look: str, rim_top: tuple[float, float, float, float]) -> list[np.ndarray]:
    """The rays' outlines (sheet px): the saturated yellow above the rim, traced."""
    if look != "rays":
        return []
    cut, rgb = _window(look)
    hue, sat, val = hue_sat_val(np.dstack([rgb, np.full(rgb.shape[:2], 255.0)]))
    yellow = np.clip((sat - 0.35) / 0.3, 0, 1) * np.clip(1 - np.abs(hue - 48) / 22, 0, 1)
    rows = np.arange(rgb.shape[0])[:, None]
    yellow = yellow * (rows < rim_top[1] - rim_top[3] - 1)
    return _outlines(yellow, 0.5, min_area=20)


def _draw(polys: list[np.ndarray], size: tuple[int, int], factor: float) -> np.ndarray:
    """Antialiased coverage 0..1 of the filled outlines at the output size."""
    w, h = size
    canvas = np.zeros((h * SUPER, w * SUPER), np.uint8)
    for p in polys:
        q = np.round(p * factor * SUPER * 16).astype(np.int32)
        cv2.fillPoly(canvas, [q], 255, lineType=cv2.LINE_8, shift=4)
    return cv2.resize(canvas.astype(np.float32), size, interpolation=cv2.INTER_AREA) / 255


def pad(look: str, factor: float = FACTOR) -> tuple[np.ndarray, tuple[float, float]]:
    cut, rgb = _window(look)
    h, w = cut.shape[:2]
    size = (round(w * factor), round(h * factor))
    hull, rim_top = _body(look)
    rays = _rays(look, rim_top)
    solid_big = _draw([hull] + rays, size, factor)

    # The owner's colour inside the shapes, bled outward from pixels well inside, enlarged.
    # Colour is taken only more than 2.5 sheet px in from the pad's painted edge: the edge pixels
    # are mixed with the sheet's white and its drop shadow. Further in it is the painting as is.
    solid = _draw([hull] + rays, (w, h), 1.0) > 0.5
    painted = ndimage.binary_fill_holes(cut[..., 3] > 115)
    core = solid & (ndimage.distance_transform_edt(painted) > 2.5)
    # Along the base the sheet fades through a light drop shadow: there go 2 px in from where
    # the pad is fully opaque instead.
    opaque = ndimage.binary_fill_holes(cut[..., 3] > 235)
    lower = (np.arange(h)[:, None] > rim_top[1]) & np.ones((1, w), bool)
    core &= ~(lower & (ndimage.distance_transform_edt(opaque) <= 2))
    # Outside the core: a smooth average of the nearby core colour (normalised blur), not the
    # nearest pixel, so the bled band carries no streaks.
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    k = core.astype(float)
    num = np.dstack([ndimage.gaussian_filter(rgb[..., c] * k, 2.0) for c in range(3)])
    den = ndimage.gaussian_filter(k, 2.0)[..., None]
    soft = np.where(den > 0.02, num / np.maximum(den, 1e-6), rgb[iy, ix])
    colour = np.where(core[..., None], rgb, soft)
    big = enlarge(np.dstack([colour, np.full((h, w), 255.0)]), factor)
    rgba = np.dstack([big[..., :3], solid_big * 255])

    if look == "rays":
        # The soft glow around the rays: the cut-out itself, enlarged smoothly, under the shapes,
        # above the rim only (no drop shadow).
        a = cut[..., 3:4] / 255
        pre = np.dstack([cut[..., :3] * a, cut[..., 3:4]]).astype(np.float32)
        g = cv2.resize(pre, size, interpolation=cv2.INTER_CUBIC)
        rows = (np.arange(size[1])[:, None] + 0.5) / factor
        # Glow only above the top of the rim (it fades out over 2 sheet px there).
        g = g * np.clip((rim_top[1] - rim_top[3] + 2 - rows) / 2, 0, 1)[..., None]
        ga = np.clip(g[..., 3], 0, 255) / 255
        grgb = np.clip(g[..., :3] / np.maximum(ga[..., None] * 255, 1e-3) * 255, 0, 255)
        sa = solid_big[..., None]
        out_a = sa + ga[..., None] * (1 - sa)
        out_rgb = (big[..., :3] * sa + grgb * ga[..., None] * (1 - sa)) / np.maximum(out_a, 1e-4)
        rgba = np.dstack([np.clip(out_rgb, 0, 255), out_a[..., 0] * 255])

    ax, ay = anchor(look, cut)
    return rgba, ((ax + 0.5) * factor - 0.5, (ay + 0.5) * factor - 0.5)


def run() -> None:
    sprites = {}
    for look in ("grey", "green", "rays"):
        rgba, at = pad(look)
        sprites[f"exit-{look}"] = (rgba, at, CELLS_PER_SOURCE_PX / FACTOR)
    write_part("exit_pads", sprites)

"""Gate: the back balustrade of 08-gazebo between its two stone posts, retoned lavender (shared with
the plate), so it reads as a closed barrier: post, rail with balusters, post.

Source (08-gazebo.png, 1254 px): the stretch between the two back columns, rows 801-912, from the
top of each column's wide band down to the foot of its plinth. The two columns' outer sides are
hidden by vine leaves and the side rails, so each post is its own clean inner half mirrored about
the column's centre line; its outer outline is that inner outline, mirrored (band and plinth widths
measured in the picture). One middle baluster is taken out (cut mid-gap to mid-gap, the wood
cross-faded over a few pixels) so the gate is not too long and low for a cell. The sky in the gaps
is keyed out and un-mixed; the floor below the rail is cut along the rail's own lower edge.
The whole is retoned lavender keeping the painted lightness, then enlarged to OUT_WIDTH px.
It stands 0.84 cells wide; its anchor is the middle of the posts' foot.
"""
from __future__ import annotations

import numpy as np

from scipy import ndimage

from lib import cut_out, load, retone, upscale, write_part

WIDTH_CELLS = 0.84
OUT_WIDTH = 300
# Lavender of the plate face (plate.py FACE), so plate and gate are one colour.
FACE = "#A77DF2"

# Measured in 08-gazebo.png (source px; edges are where the colour changes, half-pixel accurate).
TOP, BOTTOM = 801, 913          # rows taken: top of the columns' bands .. just below the plinths
PLINTH_TOP = 879.5              # band above, plinth below
PLINTH_FOOT = 912.6             # bottom of the plinths
RAIL_FOOT = 907.3               # bottom of the lower rail (floor below)
# Mirror axes (half-pixel): left post uses the pixels right of 528.5, right post those left of
# 729.5; nearer the columns' centres the vine leaves cast a dark line on the right column.
AXES = (528.5, 729.5)
BAND_HALF, PLINTH_HALF = 23.5, 32.5     # inner band edge 552.5 / 705.5, plinth edge 561.5 / 696.5
CAP_OVERLAP = 4                 # the cap (a copy of the plinth) covers the cut top of the band
CORNER = 3.5                    # rounding of the plinth's corners and the band's top corners
CUT = (636, 686)                # removed: mid-gap .. mid-gap, the second full baluster
BLEND = 4                       # cross-fade of the rails across the cut (px)
SKY = np.array([252.0, 247.0, 245.0])


def _rounded_box(xs: np.ndarray, ys: np.ndarray, x0: float, x1: float, y0: float, y1: float, r: float) -> np.ndarray:
    """Inside test of a box with rounded corners."""
    cx = np.clip(xs, x0 + r, x1 - r)
    cy = np.clip(ys, y0 + r, y1 - r)
    return (xs >= x0) & (xs <= x1) & (ys >= y0) & (ys <= y1) & ((xs - cx) ** 2 + (ys - cy) ** 2 <= r * r)


def _post_mask(h: int, w: int, centre: float, ss: int = 4) -> np.ndarray:
    """Coverage 0..1 of one post (band over plinth) on an h x w grid whose row 0 is source row TOP;
    `centre` is the post's centre line in grid x. Supersampled ss x ss."""
    ys, xs = np.mgrid[0:h * ss, 0:w * ss].astype(float)
    ys = (ys + 0.5) / ss - 0.5 + TOP
    xs = (xs + 0.5) / ss - 0.5
    band = _rounded_box(xs, ys, centre - BAND_HALF, centre + BAND_HALF, TOP - 0.5, PLINTH_TOP + CORNER, 1.5)
    plinth = _rounded_box(xs, ys, centre - PLINTH_HALF, centre + PLINTH_HALF, PLINTH_TOP, PLINTH_FOOT, CORNER)
    inside = (band | plinth).astype(float)
    return inside.reshape(h, ss, w, ss).mean(axis=(1, 3))


def _strip() -> tuple[np.ndarray, float, float]:
    """RGB strip post-rail-post (one baluster removed) and the two post centres in strip x."""
    whole = load("08-gazebo")[TOP:BOTTOM]
    left, right = int(AXES[0] + 0.5), int(AXES[1] - 0.5)   # first / last pixel kept as painted
    n = int(np.ceil(PLINTH_HALF)) + 1
    # Each post: its clean inner half, mirrored outward about the axis.
    outer_l = whole[:, left:left + n][:, ::-1]
    outer_r = whole[:, right - n + 1:right + 1][:, ::-1]
    a, b = CUT
    first = whole[:, left:a + BLEND]
    second = whole[:, b - BLEND:right + 1]
    # Cross-fade the overlap so the wood of both rails runs on without a step.
    t = np.linspace(0, 1, 2 * BLEND)[None, :, None]
    joint = first[:, -2 * BLEND:] * (1 - t) + second[:, :2 * BLEND] * t
    rgb = np.concatenate([outer_l, first[:, :-2 * BLEND], joint, second[:, 2 * BLEND:], outer_r], axis=1)
    cl = outer_l.shape[1] - 0.5
    cr = rgb.shape[1] - outer_r.shape[1] - 0.5
    return rgb, cl, cr


def _bleed(rgba: np.ndarray, reach: float = 3.0) -> np.ndarray:
    """Edge pixels (not fully opaque) take the colour of the nearest solid pixel inside, so no sky
    light or neighbouring wood shows as a halo along the outline; their alpha stays as keyed."""
    solid = ndimage.binary_erosion(rgba[..., 3] > 250, iterations=1)
    dist, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    out = rgba.copy()
    edge = (~solid) & (dist <= reach)
    out[..., :3][edge] = rgba[..., :3][iy[edge], ix[edge]]
    return out


def _capped(rgba: np.ndarray, posts: np.ndarray) -> np.ndarray:
    """Put a copy of each post's plinth on top of it as a cap: the band's top is a cut through the
    column, the cap closes it so each post reads as a gate pillar."""
    p0, p1 = int(PLINTH_TOP - TOP), int(np.ceil(PLINTH_FOOT - TOP)) + 1
    cap = rgba[p0:p1].copy()
    cap[..., 3] = np.minimum(cap[..., 3], posts[p0:p1] * 255)
    ch = cap.shape[0]
    out = np.zeros((rgba.shape[0] + ch - CAP_OVERLAP, rgba.shape[1], 4))
    out[ch - CAP_OVERLAP:] = rgba
    # "over" compositing, straight alpha.
    top = out[:ch]
    a1, a0 = cap[..., 3:4] / 255, top[..., 3:4] / 255
    a = a1 + a0 * (1 - a1)
    rgb = (cap[..., :3] * a1 + top[..., :3] * a0 * (1 - a1)) / np.maximum(a, 1e-6)
    out[:ch] = np.dstack([rgb, a * 255])
    return out


def run() -> None:
    rgb, cl, cr = _strip()
    h, w = rgb.shape[:2]
    # Sky in the gaps and above the rail: keyed and un-mixed from the sky colour.
    rgba = cut_out(rgb, enclosed=True, bg=SKY)
    # Outline: two posts; between them the rail down to its lower edge (the floor goes).
    posts = np.maximum(_post_mask(h, w, cl), _post_mask(h, w, cr))
    rows = np.arange(h)[:, None] + TOP
    rail = np.clip(RAIL_FOOT - rows + 0.5, 0, 1) * ((np.arange(w)[None, :] > cl) & (np.arange(w)[None, :] < cr))
    shape = np.maximum(posts, rail)
    rgba[..., 3] = np.minimum(rgba[..., 3], shape * 255)
    rgba = _capped(rgba, posts)
    h = rgba.shape[0]
    rgba = _bleed(rgba)
    rgba = retone(rgba, np.clip(rgba[..., 3] / 255, 0, 1) * 0.95, FACE, keep_light=1.0)
    # Enlarge to the target width (crisp edges: premultiplied Lanczos + mild unsharp).
    factor = OUT_WIDTH / w
    big = upscale(rgba, factor, sharpen=0.6, radius=1.6)
    big[..., 3] = np.where(big[..., 3] < 4, 0, big[..., 3])
    bh, bw = big.shape[:2]
    foot = (h - (BOTTOM - PLINTH_FOOT) + 0.5) * factor
    write_part("gate", {"gate": (big, (bw / 2, foot), WIDTH_CELLS / bw)})

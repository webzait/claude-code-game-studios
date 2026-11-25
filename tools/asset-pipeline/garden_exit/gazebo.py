"""The gazebo (08-gazebo) and the gazebo as the goal (24-sheet-gazebo-goal), cut out.

gazebo: cut from the full 1254 px picture at full resolution and only lightly reduced (1041 -> 960 px wide, shadow included), with
its own matte (`matte`) instead of lib.cut_out, because the picture's cream pillars and white
petals are nearly the background colour and its ground shadow is a soft lavender:
  - background = the near-white connected to the border, plus large flat near-white areas inside
    the outline (sky through the arches and between the balusters); small ones (petals, highlights,
    the white feather on the red flag) stay;
  - the edge band (3 px) is un-mixed against the *local* colours on both sides (foreground colour
    from just inside, background colour from just outside), so no white or pink halo is left;
  - the ground shadow is kept as a darkening layer (a dark lavender at partial alpha), so it reads
    as a shadow on any background rather than as a pale plate.

gazebo-goal: the owner's 24 picture is only 318 px wide. It is cut out and enlarged 2.5x (Lanczos on
premultiplied colour plus a light unsharp mask, lib.upscale). A goal rebuilt from 08 + the pad of
22 + the beam of 21 would be sharper but is not the owner's composition (no trees, stone
balustrade or green-lit interior), so the faithful enlargement is the goal; the plain cut-out of
24 is kept as gazebo-goal-small-original.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage

from lib import bottom, crop, cut_out, load, upscale, write_part

GAZEBO_CELLS = 3.0
GOAL_CELLS = 3.6
# The goal picture is enlarged this many times (318 px source -> ~775 px; more adds size, not detail).
GOAL_UPSCALE = 2.5
# The gazebo is written this wide: 320 CSS px x 3 device px.
GAZEBO_PX = 960

# Matte of 08 (values 0-255 unless noted).
SHADOW_TOP = 0.8          # the ground shadow lies below this fraction of the picture height
SHADOW_TOL = 16           # shadow/background: off the background's tint by less than this
SHADOW_KMIN = 0.55        # ... and at least this bright relative to the background
WARM = 5                  # ... and not warmer (more yellow) than the background: cream stays
STRICT_TOL = 6            # background colour proper
SKY_MEDIAN = 2.5          # enclosed background areas this flat (median tint error) are sky
SKY_MIN = 150             # ... and at least this big (px); smaller are petals and highlights
CORE = 3                  # edge band width (px) un-mixed against local colours
SHADOW_FLOOR = 0.012      # darkening below this is paper noise, not shadow
SHADOW_RGB = (52, 40, 70)  # the shadow's colour: dark lavender, like the picture's


def _smear(rgb: np.ndarray, mask: np.ndarray, sigma: float) -> np.ndarray:
    """Colour of the masked pixels spread to their neighbours (normalised convolution)."""
    m = mask.astype(float)
    num = np.dstack([ndimage.gaussian_filter(rgb[..., i] * m, sigma) for i in range(3)])
    den = ndimage.gaussian_filter(m, sigma)[..., None]
    return num / np.maximum(den, 1e-6)


def _on_red(rgb: np.ndarray, m: np.ndarray) -> bool:
    ring = ndimage.binary_dilation(m, iterations=4) & ~ndimage.binary_dilation(m, iterations=1)
    c = rgb[ring].mean(0)
    return bool(c[0] - c[1] > 60)


def _regions(mask: np.ndarray) -> tuple[np.ndarray, int, np.ndarray]:
    lab, n = ndimage.label(mask)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    return lab, n, edge[edge > 0]


def matte(rgb: np.ndarray) -> np.ndarray:
    """RGBA float cut-out of a picture on a near-white background, keeping its ground shadow."""
    B = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    k = (rgb * B).sum(2) / (B * B).sum()                      # brightness relative to the background
    res = np.abs(rgb - k[..., None] * B).max(2)                # off the background's tint
    yex = ((rgb[..., 0] + rgb[..., 1]) / 2 - rgb[..., 2]) - k * ((B[0] + B[1]) / 2 - B[2])
    low = np.zeros(k.shape, bool)
    low[int(SHADOW_TOP * k.shape[0]):] = True
    # Background and ground shadow, connected to the border.
    lab, _, edge = _regions((res < SHADOW_TOL) & (k > SHADOW_KMIN) & (yex < WARM) & low)
    bg = np.isin(lab, edge)
    # Background colour proper: touching the border, or large flat areas inside (sky).
    strict = (res < STRICT_TOL) & (k > 0.8)
    lab, n, edge = _regions(strict)
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(strict, lab, idx)
    med = ndimage.median(res, lab, idx)
    sky = [i for i in idx[(sizes >= SKY_MIN) & (med < SKY_MEDIAN)] if not _on_red(rgb, lab == i)]
    bg |= np.isin(lab, np.concatenate([edge, np.array(sky, int)]))

    obj = ~bg
    d = ndimage.distance_transform_edt(obj)
    core = d > CORE
    band = obj & ~core
    F = _smear(rgb, core, 1.5)    # foreground colour just inside
    Bl = _smear(rgb, bg, 1.5)     # background (or shadow) colour just outside
    diff = F - Bl
    nn = (diff * diff).sum(2)
    proj = np.clip(((rgb - Bl) * diff).sum(2) / np.maximum(nn, 1e-6), 0, 1)
    # Where fore- and background are alike (cream on white) the projection is unreliable: use distance.
    w = np.clip((np.sqrt(nn) - 15) / 30, 0, 1)
    ao = np.where(core, 1.0, np.where(band, w * proj + (1 - w) * np.clip(d / 2.5, 0, 1), 0.0))
    am = np.maximum(ao, 1e-3)[..., None]
    unmixed = np.clip((rgb - Bl * (1 - am)) / am, 0, 255)
    t = np.clip((ao - 0.15) / 0.35, 0, 1)[..., None]
    fg = np.where(core[..., None], rgb, unmixed * t + F * (1 - t))

    # Ground shadow: how much the colour behind is darker than the background, as dark lavender.
    back = np.where(bg[..., None], rgb, Bl)
    kb = (back * B).sum(2) / (B * B).sum()
    S = np.array(SHADOW_RGB, float)
    kS = (S * B).sum() / (B * B).sum()
    sh = np.clip((1 - kb - SHADOW_FLOOR) / (1 - kS - SHADOW_FLOOR), 0, 1) * low
    A = ao + sh * (1 - ao)
    col = (fg * ao[..., None] + S * (sh * (1 - ao))[..., None]) / np.maximum(A, 1e-6)[..., None]
    return np.dstack([np.clip(col, 0, 255), A * 255])


def shrink(rgba: np.ndarray, width: int) -> np.ndarray:
    """Reduce on premultiplied colour (area filter), so edges get no dark or light fringe."""
    h, w = rgba.shape[:2]
    if w <= width:
        return rgba
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    small = cv2.resize(pre, (width, round(h * width / w)), interpolation=cv2.INTER_AREA)
    alpha = small[..., 3]
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


def run() -> None:
    g = shrink(crop(matte(load("08-gazebo"))), GAZEBO_PX)
    small = crop(cut_out(load("24-sheet-gazebo-goal")))
    goal = upscale(small, GOAL_UPSCALE, sharpen=0.6, radius=1.6)
    goal[..., 3] = np.where(goal[..., 3] < 3, 0, goal[..., 3])
    sprites = {}
    for name, img, cells in (("gazebo", g, GAZEBO_CELLS), ("gazebo-goal", goal, GOAL_CELLS),
                             ("gazebo-goal-small-original", small, GOAL_CELLS)):
        h, w = img.shape[:2]
        # Anchor: middle of the foot, at the front edge of the lawn / path (lowest opaque row).
        sprites[name] = (img, (w / 2, bottom(img) + 1), cells / w)
    write_part("gazebo", sprites)

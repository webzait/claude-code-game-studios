"""The gazebo (08-gazebo) and the gazebo as the goal (24-sheet-gazebo-goal), cut out."""
from __future__ import annotations

import cv2
import numpy as np

from lib import crop, cut_out, load, write_part

# Widths: the gazebo is shown up to ~320 CSS px (pop-up), so 640 px keeps it sharp at 2x.
GAZEBO_PX = 640
GAZEBO_CELLS = 3.0
GOAL_CELLS = 3.6


def shrink(rgba: np.ndarray, width: int) -> np.ndarray:
    h, w = rgba.shape[:2]
    if w <= width:
        return rgba
    size = (width, round(h * width / w))
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    small = cv2.resize(pre, size, interpolation=cv2.INTER_AREA)
    alpha = small[..., 3]
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


def run() -> None:
    g = shrink(crop(cut_out(load("08-gazebo"))), GAZEBO_PX)
    goal = crop(cut_out(load("24-sheet-gazebo-goal")))
    sprites = {}
    for name, img, cells in (("gazebo", g, GAZEBO_CELLS), ("gazebo-goal", goal, GOAL_CELLS)):
        h, w = img.shape[:2]
        sprites[name] = (img, (w / 2, h * 0.93), cells / w)
    write_part("gazebo", sprites)

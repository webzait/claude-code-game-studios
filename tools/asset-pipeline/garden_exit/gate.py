"""Gate: a stretch of the back balustrade of 08-gazebo, retoned lavender (shared with the plate).
It stands 0.84 cells wide with its foot on the cell's centre line."""
from __future__ import annotations

import numpy as np

from lib import LAVENDER, cut_out, load, retone, write_part

WIDTH_CELLS = 0.84


def run() -> None:
    whole = load("08-gazebo")
    rail = cut_out(whole[800:912, 553:703], enclosed=True, bg=np.median(whole[0], axis=0))
    rail = retone(rail, np.clip((rail[..., 3] / 255) * 0.95, 0, 1), LAVENDER, keep_light=1.0)
    h, w = rail.shape[:2]
    write_part("gate", {"gate": (rail, (w / 2, h * 0.97), WIDTH_CELLS / w)})

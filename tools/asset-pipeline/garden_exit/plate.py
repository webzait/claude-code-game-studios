"""Pressure plate: the owner's green pad, tick painted out, retoned lavender (shared with the gate)."""
from __future__ import annotations

import numpy as np

from exit_pads import anchor, source_pad
from lib import CELLS_PER_SOURCE_PX, UPSCALE, lit_mask, paint_out, retone, tick_mask, upscale, write_part


def run() -> None:
    green = source_pad("green")
    blank = paint_out(green, tick_mask(green))
    plate = retone(blank, np.clip(lit_mask(blank) * 1.6, 0, 1), "#A77DF2", keep_light=0.75)
    at = anchor("green", green)
    write_part("plate", {"plate": (upscale(plate, UPSCALE), (at[0] * UPSCALE, at[1] * UPSCALE), CELLS_PER_SOURCE_PX / UPSCALE)})

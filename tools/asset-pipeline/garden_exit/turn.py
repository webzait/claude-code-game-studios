"""Turn tile: the owner's green pad retoned cream, tick painted out, and the clockwise arrow of the
owner's turn button (18-sheet-action-buttons) in leaf green in its place."""
from __future__ import annotations

import numpy as np
from PIL import Image

from exit_pads import anchor, source_pad
from lib import CELLS_PER_SOURCE_PX, CREAM, LEAF, UPSCALE, face_centre, lit_mask, paint_out, retone, stamp, tick_mask, turn_glyph, upscale, write_part


def run() -> None:
    green = source_pad("green")
    lit = np.clip(lit_mask(green) * 1.6, 0, 1)
    cx, cy, face_w = face_centre(green)
    turn = paint_out(retone(green, lit, CREAM, keep_light=0.45), tick_mask(green))
    arrow = turn_glyph(int(face_w * 0.3))
    arrow = np.asarray(Image.fromarray((arrow * 255).astype(np.uint8)).resize((int(arrow.shape[1] * 1.45), arrow.shape[0]), Image.LANCZOS), dtype=float) / 255
    img = stamp(turn, arrow, cx, cy, LEAF, shade=0.12)
    at = anchor("green", green)
    write_part("turn", {"turn": (upscale(img, UPSCALE), (at[0] * UPSCALE, at[1] * UPSCALE), CELLS_PER_SOURCE_PX / UPSCALE)})

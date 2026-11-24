"""Exit pads per chick colour, and the same with the colour's shape for the tick ("Colour shapes").

No picture of its own: the owner's green pad with its lit face and joint glow retoned; yellow gets
the owner's tick in the colour's darkest tone. For the shape version the tick is painted out and the
shape (data/config.json colourShapes) stamped in.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from exit_pads import anchor, source_pad
from lib import CELLS_PER_SOURCE_PX, CONFIG, TONES, UPSCALE, face_centre, lit_mask, paint_out, retone, shape_glyph, stamp, tick_alpha, tick_mask, upscale, write_part


def run() -> None:
    green = source_pad("green")
    lit = np.clip(lit_mask(green) * 1.6, 0, 1)
    tick = tick_mask(green)
    cx, cy, face_w = face_centre(green)
    mark, mark_at = tick_alpha(green)
    at = anchor("green", green)
    deep = CONFIG["colors"]["robots"]["yellow"]["deep"]
    sprites = {}
    for colour, tone in TONES.items():
        blank = paint_out(retone(green, lit, tone, keep_light=0.9), tick)
        ink = (255, 255, 255) if colour != "yellow" else tuple(int(deep[i:i + 2], 16) for i in (1, 3, 5))
        pad = stamp(blank, mark, 0, 0, ink, corner=mark_at) if colour == "yellow" else retone(green, lit, tone, keep_light=0.9)
        glyph = shape_glyph(CONFIG["colourShapes"][colour], int(face_w * 0.42))
        glyph = np.asarray(Image.fromarray((glyph * 255).astype(np.uint8)).resize((glyph.shape[1], int(glyph.shape[0] * 0.62)), Image.LANCZOS), dtype=float) / 255
        shaped = stamp(blank, glyph, cx, cy, ink)
        for name, img in ((f"exit-{colour}", pad), (f"exit-shape-{colour}", shaped)):
            sprites[name] = (upscale(img, UPSCALE), (at[0] * UPSCALE, at[1] * UPSCALE), CELLS_PER_SOURCE_PX / UPSCALE)
    write_part("colour_exits", sprites)

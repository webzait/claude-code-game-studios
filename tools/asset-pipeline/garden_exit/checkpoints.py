"""The owner's exit pads ("checkpoint" pictures), corrected set: design/reference/turnflock/garden/exit-pads-v2/.

They replace the first checkpoint pictures in ../elements/ (round pads, owner: "Ik heb een fout
gemaakt bij het aanleveren") as the source of every pad-based part: the exit in its four looks
(grey, green, rays, portal), the colour exits, the turn tile and the pressure plate.

The corrected pictures are 1254x1254 on a WHITE background, so they are cut out here:

1. The body (the stone tile, and the rays' solid cores) is what lies inside a sharp edge: the
   background is flood-filled from the border through every pixel that is not on a sharp colour
   edge (Sobel > EDGE per px). The painted shadow and the light are smooth, so the flood runs
   through them and stops at the stone's outline. The body is fully opaque.
2. Outside the body (soft shadow, glow round the rays, the portal's beam above the stone) the
   picture is un-mixed from the white: "colour to alpha", the least alpha for which the colour is
   reachable over white. Light stays light and half-transparent; the painted shadow is dropped
   (the owner wants none, like the tile it replaces).
3. The body's antialiased outline (a band of BAND px either side) is un-mixed between the body
   colour just inside and the outside layer just outside, so no white or grey rim is left.

`source(look)` gives a look cut out and cropped, as float RGBA at full size; `body(look)` the
matching body mask; `stone_px(look)` the stone's width (widest row of the tile body, rays left
out). Each look is scaled so that width is PAD_STONE_OUT_PX in the output. `shrink(rgba, factor)`
resizes on premultiplied colour (no fringes).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

PICTURES = Path(__file__).resolve().parents[3] / "design/reference/turnflock/garden/exit-pads-v2"
FILES = {"grey": "checkpoint-inactief", "green": "checkpoint-actief", "rays": "checkpoint-opgelicht", "portal": "checkpoint-portaal"}

# A colour step steeper than this (0-255 per px, Sobel, largest channel) is an outline.
EDGE = 8.0
# Body parts smaller than this (px) are specks, not the stone or a ray.
MIN_PART = 5000
# Thin parts (the portal's beam core rising above the stone) are light, not body: the body is
# opened with a disc of this diameter (px), which keeps the stone and the rays whole.
OPEN_PX = 25
# The outline band un-mixed between body and outside, px either side.
BAND = 2
# White light painted on the white background (the core of the portal's beam) cannot be told from
# it: a gap this wide (px, across) in the light is closed with the alpha of the light on both sides,
# and the colour there comes out near white, as painted.
LIGHT_GAP_PX = 21
# No painted shadow (owner, 2026-11-24: "geen schaduw", the tile it replaces has none). Outside the
# body only light is kept: colour-to-alpha gives the neutral shadow a near-black colour, light a bright
# one, so a pixel counts as light by the brightest channel of its un-mixed colour, ramped over these.
LIGHT_FROM, LIGHT_TO = 60.0, 180.0
# The white is 253-255: below this much darkening a pixel is background.
NOISE = 3.0
# In the output the stone is this many px wide: a cell is at most 53 CSS px on a phone at 3 device
# px per CSS px (~160 px), so 320 px is twice that.
PAD_STONE_OUT_PX = 320


def _sobel(rgb: np.ndarray) -> np.ndarray:
    g = np.zeros(rgb.shape[:2], np.float32)
    for c in range(3):
        ch = rgb[..., c].astype(np.float32)
        gx = cv2.Sobel(ch, cv2.CV_32F, 1, 0, ksize=3) / 8
        gy = cv2.Sobel(ch, cv2.CV_32F, 0, 1, ksize=3) / 8
        g = np.maximum(g, np.hypot(gx, gy))
    return g


def body_mask(rgb: np.ndarray) -> np.ndarray:
    """Inside a sharp outline: the stone tile and the solid cores of the rays."""
    free = ~ndimage.binary_dilation(_sobel(rgb) > EDGE, iterations=1)
    lab, _ = ndimage.label(free)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    inside = ndimage.binary_fill_holes(~np.isin(lab, border[border > 0]))
    disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OPEN_PX, OPEN_PX))
    inside = cv2.morphologyEx(inside.astype(np.uint8), cv2.MORPH_OPEN, disc) > 0
    lab, n = ndimage.label(inside)
    sizes = ndimage.sum(inside, lab, range(1, n + 1))
    return np.isin(lab, np.nonzero(sizes >= MIN_PART)[0] + 1)


def colour_to_alpha(rgb: np.ndarray, white: float = 255.0) -> tuple[np.ndarray, np.ndarray]:
    """Least alpha (0..1) and its colour such that colour * alpha + white * (1 - alpha) = rgb."""
    dark = np.clip(white - rgb, 0, None)
    alpha = np.clip((dark.max(axis=2) - NOISE) / (white - NOISE), 0, 1)
    fg = white - dark / np.maximum(alpha, 1e-4)[..., None]
    return alpha, np.clip(np.where(alpha[..., None] > 1e-4, fg, 0), 0, 255)


def cut(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The picture as float RGBA (0-255) without its white background, and its body mask."""
    rgb = rgb.astype(np.float64)
    body = body_mask(rgb)
    out_a, out_c = colour_to_alpha(rgb)
    closed = ndimage.grey_closing(out_a, size=(1, LIGHT_GAP_PX))
    gap = (closed > out_a + 0.02) & ~body
    out_a = np.where(gap, closed, out_a)
    unmixed = np.clip((rgb - 255.0 * (1 - out_a[..., None])) / np.maximum(out_a, 1e-4)[..., None], 0, 255)
    out_c = np.where(gap[..., None], unmixed, out_c)
    out_a = out_a * np.clip((out_c.max(axis=2) - LIGHT_FROM) / (LIGHT_TO - LIGHT_FROM), 0, 1)

    # Nearest pixel BAND+1 px inside and outside the outline, for the band.
    deep_in = ndimage.binary_erosion(body, iterations=BAND + 1)
    deep_out = ~ndimage.binary_dilation(body, iterations=BAND + 1)
    _, (iy, ix) = ndimage.distance_transform_edt(~deep_in, return_indices=True)
    _, (oy, ox) = ndimage.distance_transform_edt(~deep_out, return_indices=True)
    band = ~deep_in & ~deep_out

    fg = rgb[iy, ix]                                   # body colour just inside
    ba, bc = out_a[oy, ox], out_c[oy, ox]              # outside layer just outside
    under = bc * ba[..., None] + 255.0 * (1 - ba[..., None])   # what the outside looks like over white
    d = fg - under
    cover = np.clip(((rgb - under) * d).sum(axis=2) / np.maximum((d * d).sum(axis=2), 1e-3), 0, 1)
    # Where body and outside look alike the projection is unstable: fall back to the mask itself.
    cover = np.where((d * d).sum(axis=2) < 300, body.astype(float), cover)

    a_body = np.where(band, cover, body.astype(float))
    c_body = np.where(band[..., None], fg, rgb)
    a_out = np.where(band, ba, out_a)
    c_out = np.where(band[..., None], bc, out_c)
    a_out = np.where(body & ~band, 0.0, a_out)

    alpha = a_body + (1 - a_body) * a_out
    pre = c_body * a_body[..., None] + c_out * (a_out * (1 - a_body))[..., None]
    colour = np.where(alpha[..., None] > 1e-4, pre / np.maximum(alpha, 1e-4)[..., None], 0)
    return np.dstack([np.clip(colour, 0, 255), alpha * 255]), body


@lru_cache(maxsize=None)
def _cut(look: str, margin: int) -> tuple[np.ndarray, np.ndarray]:
    rgb = np.asarray(Image.open(PICTURES / f"{FILES[look]}.png").convert("RGB"))
    rgba, body = cut(rgb)
    ys, xs = np.nonzero(rgba[..., 3] > 2)
    y0, y1 = max(0, ys.min() - margin), min(rgba.shape[0], ys.max() + 1 + margin)
    x0, x1 = max(0, xs.min() - margin), min(rgba.shape[1], xs.max() + 1 + margin)
    return rgba[y0:y1, x0:x1], body[y0:y1, x0:x1]


def source(look: str, margin: int = 4) -> np.ndarray:
    """One look cut out from its white background, cropped to what is visible plus a margin."""
    return _cut(look, margin)[0].copy()


def body(look: str, margin: int = 4) -> np.ndarray:
    """The opaque body of `source(look)` (same crop): stone tile plus the rays' cores."""
    return _cut(look, margin)[1].copy()


def tile_mask(look: str, margin: int = 4) -> np.ndarray:
    """Only the stone tile: the largest part of the body (the rays are separate parts)."""
    b = body(look, margin)
    lab, n = ndimage.label(b)
    return lab == int(np.argmax(ndimage.sum(b, lab, range(1, n + 1)))) + 1


def stone_px(look: str) -> int:
    """Width of the stone tile in source px: its widest row."""
    cols = np.nonzero(tile_mask(look).any(axis=0))[0]
    return int(cols.max() - cols.min() + 1)


def shrink(rgba: np.ndarray, factor: float) -> np.ndarray:
    """Resize by `factor` (< 1) on premultiplied colour with area averaging: no dark or light fringe."""
    h, w = rgba.shape[:2]
    size = (max(1, round(w * factor)), max(1, round(h * factor)))
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    small = cv2.resize(pre, size, interpolation=cv2.INTER_AREA)
    alpha = np.clip(small[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), alpha])


CELLS_PER_OUT_PX = 1.0 / PAD_STONE_OUT_PX

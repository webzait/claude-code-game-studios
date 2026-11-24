"""Exit pads per chick colour, and the same with the colour's shape for the tick ("Colour shapes").

No coloured pad exists: every one is made from the owner's green pad at full resolution
(design/reference/turnflock/garden/exit-pads-v2/checkpoint-actief.png, cut out by `checkpoints.source("green")`),
then shrunk to the output size of the green pad. Steps, all on the owner's picture:

1. The tick is separated from the face: its coverage is the face's own blue channel (the lime face
   has almost no blue, the tick is white), so the antialiased edge comes out exact.
2. The tick and its soft glow are painted out: a smooth surface (cubic fitted to a ring around the
   tick, then a harmonic fill of what the cubic misses) so the face's own shading runs on unbroken.
3. The glow the tick casts on the face is measured (original minus painted-out face) and fitted as
   a blurred, shifted copy of the tick (blur, shift, strength per channel). The shapes get the
   same glow from that fit, so they sit on the face the way the owner's tick does.
4. The lit face and the green light in the stone joints are retoned to the colour
   (data/config.json colors.robots.<c>.main): the face's lightness pattern is kept around the
   colour's lightness; the glow on the stone keeps its own lightness and only changes hue. Stone
   is untouched.
5. The tick goes back on: white, on yellow a dark amber-brown (colors.robots.yellow.deep at 0.72x
   lightness). Or the colour's shape (colourShapes, outlines as in src/ui/colourShapes.ts) is drawn
   supersampled, centred on the face and squashed into its perspective (less than the face
   ellipse, as the owner's tick is).
6. Everything is shrunk to the green pad's output scale: the stone body PAD_STONE_OUT_PX wide.
   The anchor is the face centre. When exit_pads.hires_pad('green') exists its size and anchor
   are used, so all pads line up exactly.
"""
from __future__ import annotations

import colorsys

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve

from checkpoints import PAD_STONE_OUT_PX, shrink, source
from lib import CONFIG, TONES, hue_sat_val, write_part

SS = 8                      # supersampling of drawn shapes
HOLE_PX = 26                # tick painted out this far around it (source px): covers its glow
RING_PX = 22                # ring around the hole the fill is fitted to
SHAPE_BOX = 0.33            # shape box width as a share of the face ellipse width
SQUASH_POWER = 0.55         # shape squash = (face height / width) ** this; 1 would be the face's own
DEEP_DARKEN = 0.72          # yellow tick: lightness of colors.robots.yellow.deep times this
KEEP_LIGHT = 0.85           # share of the lime face's own light and shade the retoned face keeps
OUTLINES = {"circle": (0.92, 0.46, 0), "square": (0.8, 0.07, 0), "diamond": (0.76, 0.05, 45)}


def _hex(c: str) -> np.ndarray:
    return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)


def _largest(mask: np.ndarray) -> np.ndarray:
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    return lab == (int(np.argmax(ndimage.sum(mask, lab, range(1, n + 1)))) + 1)


# --- measuring the owner's pad ---------------------------------------------------------------------

def stone_width(rgba: np.ndarray) -> int:
    """Widest run of solid pixels: the stone body (the convention of checkpoints.STONE_PX)."""
    return int(max((row > 250).sum() for row in rgba[..., 3]))


def lit_weight(rgba: np.ndarray) -> np.ndarray:
    """0..1: how much a pixel carries the lime light (face, glow in the joints and on the stone)."""
    hue, sat, _ = hue_sat_val(rgba)
    hue_ok = np.clip(1 - np.maximum(np.abs(hue - 88) - 42, 0) / 15, 0, 1)
    return hue_ok * np.clip((sat - 0.07) / 0.28, 0, 1) * (rgba[..., 3] / 255)


def face_ellipse(rgba: np.ndarray) -> tuple[float, float, float, float]:
    """Centre (pixel-index coordinates) and full width and height of the lit face."""
    _, sat, val = hue_sat_val(rgba)
    lime = (sat > 0.9) & (rgba[..., 3] > 250)
    face = _largest(ndimage.binary_fill_holes(ndimage.binary_closing(lime, iterations=4)))
    contours, _ = cv2.findContours(face.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    (ex, ey), (aw, ah), _ = cv2.fitEllipse(max(contours, key=len))
    return ex, ey, max(aw, ah), min(aw, ah)


def tick_coverage(rgba: np.ndarray, face: tuple[float, float, float, float]) -> np.ndarray:
    """The white tick as 0..1 coverage, from the blue channel (the lime face has next to none)."""
    _, sat, val = hue_sat_val(rgba)
    ex, ey, ew, eh = face
    yy, xx = np.mgrid[:rgba.shape[0], :rgba.shape[1]]
    inside = ((xx - ex) / (ew / 2)) ** 2 + ((yy - ey) / (eh / 2)) ** 2 < 0.8
    core = _largest((val > 0.9) & (sat < 0.15) & inside)
    near = ndimage.binary_dilation(core, iterations=6)
    return np.clip((rgba[..., 2] - 10) / 240, 0, 1) * near


# --- painting the tick out ---------------------------------------------------------------------------

def harmonic_fill(values: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Fill `hole` so it satisfies Laplace's equation with the surrounding pixels as boundary."""
    ys, xs = np.nonzero(hole)
    index = -np.ones(hole.shape, dtype=int)
    index[ys, xs] = np.arange(len(ys))
    n = len(ys)
    rows, cols, data = [np.arange(n)], [np.arange(n)], [np.full(n, 4.0)]
    rhs = np.zeros(n)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny, nx = ys + dy, xs + dx
        j = index[ny, nx]
        inner = j >= 0
        rows.append(np.nonzero(inner)[0]); cols.append(j[inner]); data.append(-np.ones(inner.sum()))
        rhs[~inner] += values[ny[~inner], nx[~inner]]
    a = sparse.csr_matrix((np.concatenate(data), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n))
    out = values.copy()
    out[ys, xs] = spsolve(a, rhs)
    return out


def paint_out(rgba: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """A cubic surface fitted to a ring round the hole, plus a harmonic fill of the remainder."""
    dist = ndimage.distance_transform_edt(~hole)
    ring = (dist > 0) & (dist <= RING_PX) & (rgba[..., 3] > 250)
    ys, xs = np.nonzero(ring)
    cx, cy, sc = xs.mean(), ys.mean(), xs.std()

    def basis(x, y):
        u, v = (x - cx) / sc, (y - cy) / sc
        return np.stack([u ** i * v ** j for i in range(4) for j in range(4 - i)], axis=-1)

    hy, hx = np.nonzero(hole)
    yy, xx = np.mgrid[:rgba.shape[0], :rgba.shape[1]]
    out = rgba.copy()
    for c in range(3):
        coef, *_ = np.linalg.lstsq(basis(xs.astype(float), ys.astype(float)), rgba[ys, xs, c], rcond=None)
        surface = basis(xx.astype(float), yy.astype(float)) @ coef
        rest = harmonic_fill(rgba[..., c] - surface, hole)
        out[hy, hx, c] = surface[hy, hx] + rest[hy, hx]
    return out


# --- the tick's glow, fitted -------------------------------------------------------------------------

def glow_kernel(mark: np.ndarray, blur: float, dy: float) -> np.ndarray:
    return cv2.GaussianBlur(ndimage.shift(mark, (dy, 0), order=1).astype(np.float32), (0, 0), blur)


def fit_glow(delta: np.ndarray, mark: np.ndarray, where: np.ndarray) -> tuple[float, float, np.ndarray, float]:
    """Fit delta (RGB, original minus painted-out) as amp[c] * blur(shift(mark)): (blur, dy, amp, R²)."""
    best = None
    d = delta[where]
    for blur in np.arange(3, 16, 1.0):
        for dy in np.arange(-6, 7, 1.0):
            k = glow_kernel(mark, blur, dy)[where]
            amp = (k[:, None] * d).sum(0) / max((k * k).sum(), 1e-9)
            err = ((d - k[:, None] * amp) ** 2).sum()
            if best is None or err < best[0]:
                best = (err, blur, dy, amp)
    err, blur, dy, amp = best
    return blur, dy, amp, 1 - err / ((d - d.mean(0)) ** 2).sum()


# --- colour -------------------------------------------------------------------------------------------

def retone(rgba: np.ndarray, lit: np.ndarray, face: np.ndarray, target: str, l_ref: float, s_ref: float) -> np.ndarray:
    """Move lit pixels to the colour's hue. On the face the lightness pattern is kept around the
    colour's own lightness; elsewhere (glow on the stone) the pixel keeps its lightness."""
    th, tl, ts = colorsys.rgb_to_hls(*(_hex(target) / 255))
    hls = cv2.cvtColor((np.clip(rgba[..., :3], 0, 255) / 255).astype(np.float32), cv2.COLOR_RGB2HLS)
    light, sat = hls[..., 1], hls[..., 2]
    new = np.zeros_like(hls)
    new[..., 0] = th * 360
    on_face = np.clip(tl + (light - l_ref) * KEEP_LIGHT, 0.05, 0.97)
    new[..., 1] = light * (1 - face) + on_face * face
    new[..., 2] = np.clip(ts * sat / s_ref, 0, 1)
    rgb = cv2.cvtColor(new, cv2.COLOR_HLS2RGB).astype(float) * 255
    out = rgba.copy()
    k = lit[..., None]
    out[..., :3] = rgba[..., :3] * (1 - k) + rgb * k
    return out


def yellow_ink() -> np.ndarray:
    h, l, s = colorsys.rgb_to_hls(*(_hex(CONFIG["colors"]["robots"]["yellow"]["deep"]) / 255))
    return np.array(colorsys.hls_to_rgb(h, l * DEEP_DARKEN, s)) * 255


def luminance(rgb: np.ndarray) -> np.ndarray:
    c = np.asarray(rgb, dtype=float) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c @ np.array([0.2126, 0.7152, 0.0722])


# --- shapes -------------------------------------------------------------------------------------------

def shape_coverage(name: str, box: float, squash: float, centre: tuple[float, float], shape: tuple[int, int]) -> np.ndarray:
    """The colour shape (box px wide in the face's plane), turned, squashed vertically into the face's
    perspective, drawn at SS times and averaged down: 0..1 coverage of an image of `shape` (h, w)."""
    side, corner, turn = OUTLINES[name]
    half, r = side * box / 2, min(corner * box, side * box / 2)
    pts = []
    for (sx, sy), a0 in (((1, 1), 0), ((-1, 1), 90), ((-1, -1), 180), ((1, -1), 270)):
        for t in np.radians(np.linspace(a0, a0 + 90, 48)):
            pts.append((sx * (half - r) + r * np.cos(t), sy * (half - r) + r * np.sin(t)))
    pts = np.array(pts)
    a = np.radians(turn)
    pts = pts @ np.array([[np.cos(a), np.sin(a)], [-np.sin(a), np.cos(a)]])
    pts[:, 1] *= squash
    pts += centre
    h, w = shape
    img = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(img).polygon([((x + 0.5) * SS, (y + 0.5) * SS) for x, y in pts], fill=255)
    return np.asarray(img.resize((w, h), Image.BOX), dtype=float) / 255


def ink_on(rgba: np.ndarray, mark: np.ndarray, ink: np.ndarray) -> np.ndarray:
    out = rgba.copy()
    a = mark[..., None]
    out[..., :3] = rgba[..., :3] * (1 - a) + ink * a
    return out


# --- output scale -------------------------------------------------------------------------------------

def target_frame(src: np.ndarray, face: tuple[float, float, float, float]) -> tuple[tuple[int, int], tuple[float, float]]:
    """Output size (w, h) and anchor (px): from exit_pads.hires_pad('green') when it exists, else
    the same convention (stone body PAD_STONE_OUT_PX wide, anchor at the face centre)."""
    try:
        from exit_pads import hires_pad
        pad, at = hires_pad("green")
        return (pad.shape[1], pad.shape[0]), (float(at[0]), float(at[1]))
    except ImportError:
        f = PAD_STONE_OUT_PX / stone_width(src)
        h, w = src.shape[:2]
        size = (max(1, round(w * f)), max(1, round(h * f)))
        return size, ((face[0] + 0.5) * size[0] / w, (face[1] + 0.5) * size[1] / h)


def to_frame(rgba: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    h, w = rgba.shape[:2]
    out = shrink(rgba, size[0] / w)
    if (out.shape[1], out.shape[0]) != size:
        a = out[..., 3:4] / 255
        pre = np.dstack([out[..., :3] * a, out[..., 3:4]]).astype(np.float32)
        pre = cv2.resize(pre, size, interpolation=cv2.INTER_AREA)
        al = np.clip(pre[..., 3], 0, 255)
        rgb = np.where(al[..., None] > 0.5, pre[..., :3] / np.maximum(al[..., None] / 255, 1e-3), 0)
        out = np.dstack([np.clip(rgb, 0, 255), al])
    return out


def build() -> dict[str, np.ndarray]:
    """The six pads at full source resolution (float RGBA), plus diagnostics under '_' keys."""
    src = source("green")
    face = face_ellipse(src)
    ex, ey, ew, eh = face
    tick = tick_coverage(src, face)
    hole = ndimage.distance_transform_edt(tick < 0.01) <= HOLE_PX
    blank = paint_out(src, hole)

    # The glow the tick casts on the face, measured where the tick does not cover it, and fitted.
    delta = src[..., :3] - blank[..., :3]
    clear = hole & (tick < 0.01)
    blur, dy, amp, r2 = fit_glow(delta, tick, clear)
    print(f"face {ew:.0f}x{eh:.0f} at ({ex:.1f}, {ey:.1f}); tick glow: blur {blur:.0f} px, shift {dy:+.0f} px, "
          f"amp {np.round(amp, 1).tolist()}, R² {r2:.2f}")

    # Lit weight on the painted-out face: inside the face ellipse all of it is lit.
    yy, xx = np.mgrid[:src.shape[0], :src.shape[1]]
    rr = np.sqrt(((xx - ex) / (ew / 2)) ** 2 + ((yy - ey) / (eh / 2)) ** 2)
    on_face = np.clip((1.0 - rr) * 40, 0, 1).astype(np.float32)
    lit = np.maximum(lit_weight(blank), on_face)
    hls = cv2.cvtColor((np.clip(blank[..., :3], 0, 255) / 255).astype(np.float32), cv2.COLOR_RGB2HLS)
    l_ref = float(hls[..., 1][on_face > 0.99].mean())
    s_ref = float(np.percentile(hls[..., 2][on_face > 0.99], 90))

    squash = (eh / ew) ** SQUASH_POWER
    out = {"_green": src}
    for colour, tone in TONES.items():
        ink = yellow_ink() if colour == "yellow" else np.array([255.0, 255.0, 255.0])
        shape = shape_coverage(CONFIG["colourShapes"][colour], SHAPE_BOX * ew, squash, (ex, ey), src.shape[:2])
        for name, mark, glow in ((f"exit-{colour}", tick, None), (f"exit-shape-{colour}", shape, shape)):
            base = blank.copy()
            if glow is None:   # the owner's own glow, where it is not under the tick
                base[..., :3] = blank[..., :3] + np.where(clear[..., None], delta, glow_kernel(tick, blur, dy)[..., None] * amp)
            else:
                base[..., :3] = blank[..., :3] + glow_kernel(glow, blur, dy)[..., None] * amp
            base[..., :3] = np.clip(base[..., :3], 0, 255)
            pad = ink_on(retone(base, lit, on_face, tone, l_ref, s_ref), mark, ink)
            out[name] = pad
        if colour == "yellow":
            face_lum = luminance(out[f"exit-{colour}"][..., :3][on_face > 0.99]).mean()
            ink_lum = luminance(ink)
            print(f"yellow tick {np.round(ink).astype(int).tolist()}: contrast {(face_lum + 0.05) / (ink_lum + 0.05):.2f}:1 on the face")
    out["_frame"] = target_frame(src, face)
    out["_squash"] = (squash, eh / ew)
    return out


def run() -> None:
    pads = build()
    size, at = pads["_frame"]
    print(f"output {size[0]}x{size[1]} px, anchor ({at[0]:.2f}, {at[1]:.2f}), squash {pads['_squash'][0]:.3f} (face {pads['_squash'][1]:.3f})")
    sprites = {}
    for name, rgba in pads.items():
        if not name.startswith("_"):
            sprites[name] = (to_frame(rgba, size), at, 1.0 / PAD_STONE_OUT_PX)
    write_part("colour_exits", sprites)

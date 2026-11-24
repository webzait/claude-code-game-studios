#!/usr/bin/env python3
"""Cut the garden exit, gazebo and special tiles out of the owner's pictures.

Reads  design/reference/turnflock/garden/{22-sheet-exit-pad-states,08-gazebo,
       24-sheet-gazebo-goal,18-sheet-action-buttons}.png
Writes assets/turnflock/garden/exit/*.webp (transparent)

The owner's picture is the part. Each piece is cut from the white background with
a clean edge: the background is found by flood fill from the picture's border, the
edge band is un-mixed from the background colour (so no white or grey halo is
left) and the soft painted shadow is kept as half-transparent shadow.

Pieces with no picture of their own are made from pieces of the pictures:
- exit-red / -blue / -yellow: the green pad, its lit face and glow retoned;
- exit-shape-<colour>: the same with the tick painted out and the colour's shape
  (data/config.json colourShapes) in its place;
- turn: the green pad retoned sky blue, tick painted out, the clockwise arrow of
  the owner's "turn" button (18-sheet-action-buttons) in its place;
- plate: the green pad retoned lavender, tick painted out;
- gate: a stretch of balustrade cut from 08-gazebo, retoned lavender.
Design: design/themes/garden-exit.md. Needs Pillow, numpy, scipy, opencv-python-headless.

Run from the repo root:  python3 tools/asset-pipeline/turnflock-garden-exit.py
"""
from __future__ import annotations

import colorsys
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "design/reference/turnflock/garden"
OUT = ROOT / "assets/turnflock/garden/exit"
CONFIG = json.loads((ROOT / "data/config.json").read_text())

# Background: pixels this close (0-255, largest channel difference) to the border colour
# and connected to the border are background. The edge band is un-mixed over `SOFT`.
BG_NEAR = 10
SOFT = 70
BAND = 10
QUALITY = 82
# Inside the outline, background-coloured areas larger than this (px) are background too.
ENCLOSED_MIN = 3000

# Lavender of plate and gate (data/themes/garden/exit.json, plate.colors.lavender).
LAVENDER = "#A27BEA"
# Turn tile face: a warm cream no chick, exit or plate uses, with a leaf-green arrow.
CREAM = "#F4E6C4"
LEAF = (47, 107, 31)
TONES = {c: CONFIG["colors"]["robots"][c]["main"] for c in ("red", "blue", "yellow")}


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(REF / f"{name}.png").convert("RGB"), dtype=float)


def cut_out(rgb: np.ndarray, enclosed: bool = False, bg: np.ndarray | None = None) -> np.ndarray:
    """RGBA float image: the background made transparent, the edge un-mixed from it. With `enclosed`
    background-coloured areas inside the outline go too (the gaps of a balustrade)."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    if bg is None:
        bg = np.median(border, axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    near = dist < BG_NEAR
    labels, _ = ndimage.label(near)
    edge_labels = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, edge_labels[edge_labels > 0])
    if enclosed:
        background = near
    else:
        # Large background-coloured areas inside the outline (the sky seen through the gazebo's
        # arches) go too; small ones (white petals, highlights) stay.
        sizes = ndimage.sum(near, labels, range(1, labels.max() + 1))
        big = np.nonzero(sizes > ENCLOSED_MIN)[0] + 1
        background |= np.isin(labels, big)
    # Distance (px) from the background: inside the band the alpha follows the colour difference.
    away = ndimage.distance_transform_edt(~background)
    soft = np.clip(dist / SOFT, 0, 1)
    ramp = np.clip(away / BAND, 0, 1)
    alpha = np.where(background, 0.0, np.maximum(soft, ramp ** 2))
    alpha = np.clip(alpha, 0, 1)
    # Un-mix: the picture is fg * a + bg * (1 - a), so fg = (picture - bg * (1 - a)) / a.
    a = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((rgb - bg * (1 - a)) / a, 0, 255)
    fg = np.where(alpha[..., None] > 0.02, fg, rgb)
    return np.dstack([fg, alpha * 255])


def crop(rgba: np.ndarray, box: tuple[int, int, int, int] | None = None, margin: int = 2) -> np.ndarray:
    """Crop to `box` (x0, y0, x1, y1) if given, then to what is visible plus a margin."""
    if box:
        x0, y0, x1, y1 = box
        rgba = rgba[y0:y1, x0:x1]
    ys, xs = np.nonzero(rgba[..., 3] > 3)
    y0, y1 = max(0, ys.min() - margin), min(rgba.shape[0], ys.max() + 1 + margin)
    x0, x1 = max(0, xs.min() - margin), min(rgba.shape[1], xs.max() + 1 + margin)
    return rgba[y0:y1, x0:x1]


def to_image(rgba: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(rgba, 0, 255).round().astype(np.uint8), "RGBA")


def save(img: Image.Image, name: str, width: int | None = None) -> None:
    if width and img.width != width:
        img = premultiplied_resize(img, (width, round(img.height * width / img.width)))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.webp"
    img.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=90, exact=False)
    print(f"{name}.webp  {img.width}x{img.height}  {path.stat().st_size / 1024:.1f} kB")


def premultiplied_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Resize without dark or light fringes: colour is scaled premultiplied by alpha."""
    a = np.asarray(img, dtype=float)
    pre = a[..., :3] * a[..., 3:4] / 255
    big = np.dstack([pre, a[..., 3]])
    small = np.dstack([np.asarray(Image.fromarray(big[..., i].astype(np.float32), "F").resize(size, Image.LANCZOS)) for i in range(4)])
    alpha = np.clip(small[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, small[..., :3] * 255 / np.maximum(alpha[..., None], 1e-3), 0)
    return to_image(np.dstack([np.clip(rgb, 0, 255), alpha]))


def hue_sat_val(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    hsv = cv2.cvtColor(np.clip(rgba[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)
    return hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255


def lit_mask(rgba: np.ndarray) -> np.ndarray:
    """0..1: how much a pixel of the green pad is the lime light (face, glow in the joints)."""
    hue, sat, _ = hue_sat_val(rgba)
    green = np.clip(1 - np.abs(hue - 82) / 40, 0, 1)
    return green * np.clip((sat - 0.12) / 0.3, 0, 1) * (rgba[..., 3] / 255)


def tick_mask(rgba: np.ndarray) -> np.ndarray:
    """The white tick on the face: bright, unsaturated pixels inside the lit face."""
    hue, sat, val = hue_sat_val(rgba)
    face = ndimage.binary_closing(lit_mask(rgba) > 0.5, iterations=6)
    face = ndimage.binary_fill_holes(face)
    face = ndimage.binary_erosion(face, iterations=3)
    white = (sat < 0.35) & (val > 0.8)
    lab, n = ndimage.label(white & face)
    sizes = ndimage.sum(white & face, lab, range(1, n + 1))
    m = lab == (int(np.argmax(sizes)) + 1)
    return ndimage.binary_dilation(m, iterations=3)


def tick_alpha(rgba: np.ndarray) -> tuple[np.ndarray, tuple[int, int]]:
    """The painted tick as a soft 0..1 mask (its whiteness on the lit face) and the top-left corner where it sits."""
    hue, sat, val = hue_sat_val(rgba)
    face = ndimage.binary_fill_holes(ndimage.binary_closing(lit_mask(rgba) > 0.5, iterations=6))
    face = ndimage.binary_erosion(face, iterations=3)
    white = np.clip((val - 0.72) / 0.2, 0, 1) * np.clip((0.45 - sat) / 0.3, 0, 1) * face
    lab, n = ndimage.label(white > 0.3)
    sizes = ndimage.sum(white > 0.3, lab, range(1, n + 1))
    keep = ndimage.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=2)
    g = white * keep
    ys, xs = np.nonzero(g > 0.02)
    return g[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (xs.min(), ys.min())


def retone(rgba: np.ndarray, mask: np.ndarray, target: str, keep_light: float = 1.0) -> np.ndarray:
    """Move the masked pixels to the hue and saturation of `target`, keeping their own lightness pattern."""
    out = rgba.copy()
    t = np.array([int(target[i:i + 2], 16) for i in (1, 3, 5)], dtype=float) / 255
    th, tl, ts = colorsys.rgb_to_hls(*t)
    hls = cv2.cvtColor(np.clip(rgba[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2HLS).astype(float)
    light = hls[..., 1] / 255
    # The lime is very light: map its lightness range onto the target's, centred on the target.
    lit = mask > 0.5
    mean = light[lit].mean() if lit.any() else 0.5
    new_l = np.clip(tl + (light - mean) * keep_light, 0.05, 0.97)
    new = np.zeros_like(hls)
    new[..., 0] = th * 180
    new[..., 1] = new_l * 255
    new[..., 2] = np.clip(ts * 255 * np.clip(hls[..., 2] / 255 / 0.6, 0, 1.0), 0, 255)
    rgb = cv2.cvtColor(new.astype(np.uint8), cv2.COLOR_HLS2RGB).astype(float)
    k = mask[..., None]
    out[..., :3] = rgba[..., :3] * (1 - k) + rgb * k
    return out


def paint_out(rgba: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Fill the masked area from its surroundings (the tick painted out of the face)."""
    out = rgba.copy()
    rgb = np.clip(rgba[..., :3], 0, 255).astype(np.uint8)
    filled = cv2.inpaint(rgb, ndimage.binary_dilation(mask, iterations=1).astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA)
    out[..., :3] = filled
    return out


def face_centre(rgba: np.ndarray) -> tuple[float, float, float]:
    """Centre (x, y) and width of the lit face."""
    face = ndimage.binary_fill_holes(ndimage.binary_closing(lit_mask(rgba) > 0.5, iterations=6))
    lab, n = ndimage.label(face)
    sizes = ndimage.sum(face, lab, range(1, n + 1))
    big = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(big)
    return xs.mean(), ys.mean(), xs.max() - xs.min()


def stamp(rgba: np.ndarray, glyph: np.ndarray, cx: float, cy: float, colour=(255, 255, 255), shade: float = 0.28, corner: tuple[int, int] | None = None) -> np.ndarray:
    """Lay a white glyph (alpha 0..1) on the face, with a soft dark edge below it like the painted tick has."""
    out = rgba.copy()
    gh, gw = glyph.shape
    x0 = int(round(cx - gw / 2)) if corner is None else corner[0]
    y0 = int(round(cy - gh / 2)) if corner is None else corner[1]
    under = ndimage.shift(glyph, (1.2, 0.4), order=1)
    under = ndimage.gaussian_filter(under, 0.8)
    for layer, tone in ((under * shade, (0, 0, 0)), (glyph, colour)):
        region = out[y0:y0 + gh, x0:x0 + gw, :3]
        a = layer[..., None]
        out[y0:y0 + gh, x0:x0 + gw, :3] = region * (1 - a) + np.array(tone, dtype=float) * a
    return out


def shape_glyph(name: str, size: int) -> np.ndarray:
    """The colour shape as an antialiased mask, drawn at 4x and scaled down (outlines as in src/ui/colourShapes.ts)."""
    outline = {"circle": (0.92, 0.46, 0), "square": (0.8, 0.07, 0), "diamond": (0.76, 0.05, 45)}[name]
    side, corner, turn = outline
    s = size * 4
    img = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(img)
    half = side * s / 2
    r = corner * s
    d.rounded_rectangle([s / 2 - half, s / 2 - half, s / 2 + half, s / 2 + half], radius=r, fill=255)
    if turn:
        img = img.rotate(turn, resample=Image.BICUBIC)
    return np.asarray(img.resize((size, size), Image.LANCZOS), dtype=float) / 255


def turn_glyph(height: int) -> np.ndarray:
    """The white clockwise arrow of the owner's turn button (top right of 18-sheet-action-buttons)."""
    rgb = load("18-sheet-action-buttons")
    button = rgb[24:58, 78:118]
    hsv = cv2.cvtColor(button.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(float)
    whiteness = np.clip((hsv[..., 2] / 255 - 0.55) / 0.4, 0, 1) * np.clip(1 - hsv[..., 1] / 255 / 0.45, 0, 1)
    # Only the glyph: drop the button's light rim near its border.
    lab, n = ndimage.label(whiteness > 0.35)
    sizes = ndimage.sum(whiteness > 0.35, lab, range(1, n + 1))
    keep = lab == (int(np.argmax(sizes)) + 1)
    keep = ndimage.binary_dilation(keep, iterations=2)
    g = whiteness * keep
    ys, xs = np.nonzero(g > 0.05)
    g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = round(g.shape[1] * height / g.shape[0])
    return np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, height), Image.LANCZOS), dtype=float) / 255


def pads() -> dict[str, np.ndarray]:
    """The three pads of 22-sheet-exit-pad-states, cut out (the small red mark under the third is left out)."""
    rgba = cut_out(load("22-sheet-exit-pad-states"))
    return {
        "grey": crop(rgba, (5, 0, 108, 88)),
        "green": crop(rgba, (117, 0, 224, 88)),
        "rays": crop(rgba, (236, 0, 342, 86)),
    }


MANIFEST = ROOT / "data/themes/garden/exit-sprites.json"
SHEET: dict[str, dict] = {}


def record(name: str, rgba: np.ndarray, anchor: tuple[float, float], cells_per_px: float) -> None:
    """Note a sprite's size in cells and where in it the pad's centre on the floor is, for the game."""
    h, w = rgba.shape[:2]
    SHEET[name] = {"width": round(w * cells_per_px, 4), "height": round(h * cells_per_px, 4), "anchor": [round(anchor[0] / w, 4), round(anchor[1] / h, 4)]}


def bottom(rgba: np.ndarray) -> int:
    ys = np.nonzero((rgba[..., 3] > 128).any(axis=1))[0]
    return int(ys.max())


def main() -> None:
    p = pads()
    for look in ("grey", "green", "rays"):
        save(to_image(p[look]), f"exit-{look}")
    green = p["green"]
    # Scale: the grey pad's stone fills the cell (1 cell wide).
    stone = np.nonzero((p["grey"][..., 3] > 128).any(axis=0))[0]
    cells_per_px = 1.0 / (stone.max() - stone.min() + 1)
    # The lit part, full strength a little inside its soft edge, so the glow in the joints is retoned too.
    lit = np.clip(lit_mask(green) * 1.6, 0, 1)
    tick = tick_mask(green)
    cx, cy, face_w = face_centre(green)
    mark, mark_at = tick_alpha(green)
    # Where the pad's centre is, as a distance up from its lowest solid row: the same for every pad.
    rise = bottom(green) - cy
    for look in ("grey", "green", "rays"):
        img = p[look]
        xs = np.nonzero((img[..., 3] > 128).any(axis=0))[0]
        record(f"exit-{look}", img, ((xs.min() + xs.max()) / 2, bottom(img) - rise), cells_per_px)
    derived = ((cx, cy), cells_per_px)

    for colour, tone in TONES.items():
        blank = paint_out(retone(green, lit, tone, keep_light=0.9), tick)
        ink = (255, 255, 255) if colour != "yellow" else tuple(int(CONFIG["colors"]["robots"]["yellow"]["deep"][i:i + 2], 16) for i in (1, 3, 5))
        if colour == "yellow":
            # White does not read on yellow: the owner's tick, in the colour's darkest tone, as on the robot pad.
            pad = stamp(blank, mark, 0, 0, ink, corner=mark_at)
        else:
            pad = retone(green, lit, tone, keep_light=0.9)
        save(to_image(pad), f"exit-{colour}")
        record(f"exit-{colour}", pad, *derived)
        glyph = shape_glyph(CONFIG["colourShapes"][colour], int(face_w * 0.42))
        # The face is seen at an angle: squash the shape as the tick is.
        glyph = np.asarray(Image.fromarray((glyph * 255).astype(np.uint8)).resize((glyph.shape[1], int(glyph.shape[0] * 0.62)), Image.LANCZOS), dtype=float) / 255
        save(to_image(stamp(blank, glyph, cx, cy, ink)), f"exit-shape-{colour}")
        record(f"exit-shape-{colour}", blank, *derived)

    turn = paint_out(retone(green, lit, CREAM, keep_light=0.45), tick)
    arrow = turn_glyph(int(face_w * 0.3))
    arrow = np.asarray(Image.fromarray((arrow * 255).astype(np.uint8)).resize((int(arrow.shape[1] * 1.45), arrow.shape[0]), Image.LANCZOS), dtype=float) / 255
    save(to_image(stamp(turn, arrow, cx, cy, LEAF, shade=0.12)), "turn")
    record("turn", turn, *derived)

    blank_green = paint_out(green, tick)
    plate = retone(blank_green, np.clip(lit_mask(blank_green) * 1.6, 0, 1), "#A77DF2", keep_light=0.75)
    save(to_image(plate), "plate")
    record("plate", plate, *derived)

    gazebo = cut_out(load("08-gazebo"))
    save(to_image(crop(gazebo)), "gazebo", width=320)
    # The back balustrade between the two middle columns, retoned lavender: the gate.
    whole = load("08-gazebo")
    rail = cut_out(whole[800:912, 553:703], enclosed=True, bg=np.median(whole[0], axis=0))
    save(to_image(retone(rail, np.clip((rail[..., 3] / 255) * 0.95, 0, 1), LAVENDER, keep_light=1.0)), "gate", width=110)
    # The gate stands 0.84 cells wide (gate.size), its foot on the cell's centre line.
    SHEET["gate"] = {"width": 0.84, "height": round(0.84 * rail.shape[0] / rail.shape[1], 4), "anchor": [0.5, 0.97]}

    goal = cut_out(load("24-sheet-gazebo-goal"))
    save(to_image(crop(goal)), "gazebo-goal")
    g1 = crop(gazebo)
    g2 = crop(goal)
    # The gazebo pictures are about three cells across (see design/themes/garden-exit.md).
    SHEET["gazebo"] = {"width": 3.0, "height": round(3.0 * g1.shape[0] / g1.shape[1], 4), "anchor": [0.5, 0.93]}
    SHEET["gazebo-goal"] = {"width": 3.6, "height": round(3.6 * g2.shape[0] / g2.shape[1], 4), "anchor": [0.5, 0.9]}
    MANIFEST.write_text(json.dumps({"_about": "Written by tools/asset-pipeline/turnflock-garden-exit.py: each sprite in assets/turnflock/garden/exit/ with its size in cells and its anchor (the pad's centre on the floor, as fractions of the picture from the top left).", "sprites": SHEET}, indent=2) + "\n")


if __name__ == "__main__":
    main()

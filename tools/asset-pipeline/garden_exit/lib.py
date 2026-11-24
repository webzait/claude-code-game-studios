"""Shared helpers for the garden exit pictures (one module per part next to this one).

Every part is cut from the owner's own pictures in design/reference/turnflock/garden/; nothing is
drawn or brought in from outside except glyph outlines the game already defines (colour shapes).
Each part module has `run()`, which writes its WebP files to assets/turnflock/garden/exit/ and its
sizes to data/themes/garden/exit-sprites/<part>.json through `write_part`. build.py runs them.
Needs Pillow, numpy, scipy, opencv-python-headless.
"""
from __future__ import annotations

import colorsys
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
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


def bottom(rgba: np.ndarray) -> int:
    ys = np.nonzero((rgba[..., 3] > 128).any(axis=1))[0]
    return int(ys.max())



FRAGMENTS = ROOT / "data/themes/garden/exit-sprites"

# Scale. The owner's pad sheet has the grey pad's stone 94 px wide; in the game the stone fills a
# cell. Every pad-derived picture keeps that scale: cells per source pixel.
PAD_STONE_SOURCE_PX = 94
CELLS_PER_SOURCE_PX = 1.0 / PAD_STONE_SOURCE_PX

# Target resolution: a cell is at most 53 CSS px on a phone, 3 device px per CSS px, so a pad needs
# about 160 device px; pads are written at UPSCALE times their source size (~300 px wide).
UPSCALE = 3


def upscale(rgba: np.ndarray, factor: float, sharpen: float = 0.9, radius: float = 2.2) -> np.ndarray:
    """Enlarge an RGBA cut-out without fringes: Lanczos on premultiplied colour, then an unsharp mask
    on the colour (radius in output px) so painted edges stay crisp. Alpha gets a mild unsharp too."""
    h, w = rgba.shape[:2]
    size = (round(w * factor), round(h * factor))
    a = rgba[..., 3:4] / 255
    pre = np.dstack([rgba[..., :3] * a, rgba[..., 3:4]]).astype(np.float32)
    big = cv2.resize(pre, size, interpolation=cv2.INTER_LANCZOS4)
    alpha = np.clip(big[..., 3], 0, 255)
    rgb = np.where(alpha[..., None] > 0.5, big[..., :3] / np.maximum(alpha[..., None] / 255, 1e-3), 0)
    rgb = np.clip(rgb, 0, 255)
    if sharpen > 0:
        blur = cv2.GaussianBlur(rgb, (0, 0), radius)
        rgb = np.clip(rgb + (rgb - blur) * sharpen, 0, 255)
        ab = cv2.GaussianBlur(alpha, (0, 0), radius)
        alpha = np.clip(alpha + (alpha - ab) * sharpen * 0.6, 0, 255)
    return np.dstack([rgb, alpha])


def write_part(part: str, sprites: dict[str, tuple[np.ndarray, tuple[float, float], float]]) -> None:
    """Write each sprite (rgba, anchor in px, cells per px) as WebP and the part's size fragment.

    The anchor is the point the game puts over the cell centre (for pads: the face centre); the
    fragment gives each sprite's width and height in cells and the anchor as fractions."""
    entries = {}
    for name, (rgba, anchor, cells_per_px) in sprites.items():
        save(to_image(rgba), name)
        h, w = rgba.shape[:2]
        entries[name] = {"width": round(w * cells_per_px, 4), "height": round(h * cells_per_px, 4), "anchor": [round(anchor[0] / w, 4), round(anchor[1] / h, 4)]}
    FRAGMENTS.mkdir(parents=True, exist_ok=True)
    (FRAGMENTS / f"{part}.json").write_text(json.dumps({"_about": f"Written by tools/asset-pipeline/garden_exit/{part}.py: size in cells and anchor (fractions from the top left) of each picture.", "sprites": entries}, indent=2) + "\n")

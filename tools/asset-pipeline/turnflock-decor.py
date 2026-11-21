#!/usr/bin/env python3
"""Cut the TURNFLOCK foreground bushes out of the owner's one original image.

Reads  design/reference/turnflock/source/bush-original.png (1177x717, transparent)
Writes assets/turnflock/decor/decor-*.webp

Every piece is a region of that one image: nothing is drawn or brought in from
outside. Each piece is retoned towards the owner's bush palette, given a darker
base and a baked contact shadow (sharp for near pieces, soft for far ones), and
saved as WebP with transparency. Needs Pillow and numpy.

Run from the repo root:  python3 tools/asset-pipeline/turnflock-decor.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design/reference/turnflock/source/bush-original.png"
OUT = ROOT / "assets/turnflock/decor"

# The owner's bush colours: deep shade, dark, main, light, gloss.
PALETTE_MAIN = ["#27722F", "#429B37", "#63C94D", "#92EA73", "#D2F8B4"]
# The owner's second listed set, used so the pieces are not all one tone.
PALETTE_ALT = ["#2F7F3A", "#52A84C", "#79D36B", "#A7ED8D", "#DBFAC4"]
STOPS = [0.0, 0.24, 0.52, 0.82, 1.0]

# Outlines in the original's pixels. Where one cluster hides another the line
# follows the visible edge; the cut bases end up below the screen edge.
SMALL_BUSH = [(0, 0), (250, 0), (366, 322), (384, 339), (398, 352), (412, 375), (424, 400), (431, 423), (450, 414), (470, 411),
              (492, 415), (512, 426), (530, 443), (542, 465), (547, 490), (543, 520), (540, 537), (556, 548), (570, 570),
              (577, 598), (572, 625), (558, 648), (540, 662), (540, 717), (0, 717)]
CLOVER = [(630, 717), (630, 655), (640, 628), (660, 610), (690, 601), (703, 598), (702, 540), (714, 505), (740, 478),
          (775, 466), (806, 468), (811, 448), (826, 414), (855, 388), (890, 373), (930, 368), (975, 378), (1015, 400),
          (1045, 435), (1058, 478), (1061, 499), (1080, 498), (1100, 503), (1120, 514), (1138, 532), (1150, 555),
          (1158, 580), (1177, 600), (1177, 717)]
# The big cluster is what is left of x >= 372 once the small bush in front of it is removed.
BIG_LEFT_EDGE = 372
# Two grass blades (inside the box below), used to build the hanging sprig:
# (tip, base, half width). Each is cut as a smooth almond inside the blade.
BLADE_BOX = (310, 490, 525, 685)
BLADES = [((72, 13), (86, 100), 18), ((184, 50), (130, 138), 16)]
# The sprig's leaves: (blade, turn in degrees from pointing right, scale). They hang from one stem point.
SPRIG_FAN = [(1, 8, 1.15), (0, 30, 1.45), (1, 52, 1.7), (0, 74, 1.4), (1, 94, 1.1)]

def hex_rgb(value: str) -> np.ndarray:
    return np.array([int(value[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)


def polygon_mask(size: tuple[int, int], points: list[tuple[float, float]], feather: float = 0.8) -> np.ndarray:
    """Antialiased 0..1 mask of a polygon (drawn 4x and scaled down)."""
    scale = 4
    big = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(big).polygon([(x * scale, y * scale) for x, y in points], fill=255)
    mask = big.resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(mask, dtype=float) / 255


def foliage(rgba: np.ndarray) -> np.ndarray:
    """True where a pixel is leaf, false on the grey stones."""
    hsv = np.asarray(Image.fromarray(rgba[..., :3].astype("uint8")).convert("HSV"), dtype=float)
    return (hsv[..., 0] > 22) & (hsv[..., 0] < 128) & (hsv[..., 1] > 80)


def retone(rgba: np.ndarray, palette: list[str], strength: float, lift: float = 0.0) -> np.ndarray:
    """Pull the leaf colours towards the palette by brightness; stones keep their colour."""
    rgb = rgba[..., :3]
    luma = (0.30 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) / 255
    leaf = foliage(rgba)
    visible = leaf & (rgba[..., 3] > 128)
    lo, hi = np.percentile(luma[visible], [2, 99.5])
    t = np.clip((luma - lo) / (hi - lo) + lift, 0, 1)
    colours = np.array([hex_rgb(c) for c in palette])
    mapped = np.stack([np.interp(t, STOPS, colours[:, c]) for c in range(3)], axis=-1)
    soft = np.asarray(Image.fromarray((leaf * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.2)), dtype=float)[..., None] / 255
    out = rgba.copy()
    out[..., :3] = rgb * (1 - soft * strength) + mapped * soft * strength
    return out


def trim(rgba: np.ndarray, pad: int = 0) -> np.ndarray:
    ys, xs = np.where(rgba[..., 3] > 6)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + 1 + pad, max(xs.min() - pad, 0), xs.max() + 1 + pad
    return rgba[y0:y1, x0:x1]


def darker_base(rgba: np.ndarray, start: float, amount: float) -> np.ndarray:
    """Shade the lower part so the bush sits on the ground instead of floating."""
    h = rgba.shape[0]
    ramp = np.clip((np.arange(h) / h - start) / (1 - start), 0, 1)[:, None, None] ** 1.4
    shade = hex_rgb("#1E5B3A")
    out = rgba.copy()
    out[..., :3] = rgba[..., :3] * (1 - ramp * amount) + shade * ramp * amount
    return out


def with_shadow(rgba: np.ndarray, blur: float, drop: int, opacity: float) -> np.ndarray:
    """Bake a contact shadow under the piece: its own outline, moved down and blurred."""
    pad = int(blur * 2.5) + drop
    h, w = rgba.shape[:2]
    canvas = np.zeros((h + pad * 2, w + pad * 2, 4), dtype=float)
    canvas[pad:pad + h, pad:pad + w] = rgba
    alpha = Image.fromarray(canvas[..., 3].astype("uint8"))
    shadow = np.asarray(alpha.transform(alpha.size, Image.AFFINE, (1, 0, 0, 0, 1, -drop)).filter(ImageFilter.GaussianBlur(blur)), dtype=float) / 255 * opacity
    piece = canvas[..., 3:4] / 255
    tint = hex_rgb("#12405A")
    out = np.zeros_like(canvas)
    out_alpha = piece[..., 0] + shadow * (1 - piece[..., 0])
    safe = np.maximum(out_alpha, 1e-6)[..., None]
    out[..., :3] = (canvas[..., :3] * piece + tint * (shadow * (1 - piece[..., 0]))[..., None]) / safe
    out[..., 3] = out_alpha * 255
    return trim(out)


def save(rgba: np.ndarray, name: str, width: int, quality: int, soften: float = 0.0) -> None:
    image = Image.fromarray(np.clip(rgba, 0, 255).astype("uint8"), "RGBA")
    image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    if soften:
        image = image.filter(ImageFilter.GaussianBlur(soften))
    path = OUT / name
    image.save(path, "WEBP", quality=quality, alpha_quality=70, method=6)
    print(f"{name}: {image.width}x{image.height}, {path.stat().st_size} bytes")


def main() -> None:
    source = np.asarray(Image.open(SOURCE).convert("RGBA"), dtype=float)
    size = (source.shape[1], source.shape[0])

    def cut(mask: np.ndarray) -> np.ndarray:
        piece = source.copy()
        piece[..., 3] *= mask
        return trim(piece)

    small_mask = polygon_mask(size, SMALL_BUSH)

    # 1. Large corner bush: the big cluster, near the viewer. Sharp, strong shadow.
    big_mask = (1 - small_mask) * polygon_mask(size, [(BIG_LEFT_EDGE, 0), (size[0], 0), (size[0], size[1]), (BIG_LEFT_EDGE, size[1])])
    big = with_shadow(darker_base(retone(cut(big_mask), PALETTE_MAIN, 0.78), 0.55, 0.5), blur=7, drop=9, opacity=0.42)
    save(big, "decor-bush-large.webp", 520, 80)

    # 2. Small bush: the left cluster, a little lighter, for the other corner.
    small = with_shadow(darker_base(retone(cut(small_mask), PALETTE_ALT, 0.74, lift=0.03), 0.6, 0.45), blur=7, drop=8, opacity=0.4)
    save(small, "decor-bush-small.webp", 400, 80)

    # 3. Clover tuft: the three front balls of the big cluster. Stands further back: softer shadow.
    clover = with_shadow(darker_base(retone(cut(polygon_mask(size, CLOVER)), PALETTE_ALT, 0.7, lift=0.06), 0.62, 0.4), blur=12, drop=6, opacity=0.26)
    save(clover, "decor-tuft-clover.webp", 300, 78, soften=0.4)

    # 4. Hanging sprig for a top corner: the two grass blades, fanned out from one stem point.
    box = BLADE_BOX
    region = source[box[1]:box[3], box[0]:box[2]]
    leaves = []
    for tip, base, half in BLADES:
        tip_v, base_v = np.array(tip, dtype=float), np.array(base, dtype=float)
        along = base_v - tip_v
        length = float(np.hypot(*along))
        across = np.array([-along[1], along[0]]) / length
        steps = np.linspace(0, 1, 40)
        widths = half * np.sin(np.pi * steps) ** 0.7
        outline = [tuple(tip_v + along * t + across * w) for t, w in zip(steps, widths)] + [tuple(tip_v + along * t - across * w) for t, w in zip(steps[::-1], widths[::-1])]
        leaf = region.copy()
        leaf[..., 3] *= polygon_mask((box[2] - box[0], box[3] - box[1]), outline, feather=0.9)
        image = Image.fromarray(np.clip(leaf, 0, 255).astype("uint8"), "RGBA")
        # Turn the leaf so it points right (tip at the right, base at the left), then trim it.
        angle = np.degrees(np.arctan2(-(tip_v - base_v)[1], (tip_v - base_v)[0]))
        image = image.rotate(-angle, expand=True, resample=Image.BICUBIC)
        leaves.append(Image.fromarray(trim(np.asarray(image, dtype=float)).astype("uint8"), "RGBA"))
    side = 520
    stem = 150
    sprig = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    for index, turn, scale in SPRIG_FAN:
        leaf = leaves[index].resize((round(leaves[index].width * scale), round(leaves[index].height * scale)), Image.LANCZOS)
        reach = leaf.width * 2 + 8
        holder = Image.new("RGBA", (reach, reach), (0, 0, 0, 0))
        holder.alpha_composite(leaf, (reach // 2 - 6, (reach - leaf.height) // 2))
        turned = holder.rotate(-turn, resample=Image.BICUBIC)
        sprig.alpha_composite(turned, (stem - reach // 2, stem - reach // 2))
    sprig_px = retone(trim(np.asarray(sprig, dtype=float)), PALETTE_MAIN, 0.72, lift=-0.14)
    sprig_px = with_shadow(sprig_px, blur=10, drop=5, opacity=0.22)
    save(sprig_px, "decor-sprig-top.webp", 280, 78, soften=0.5)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the garden backdrop, its foreground decor and its two props from the owner's pictures.

Reads  data/themes/garden/backdrop.json (every crop, row and quality used here)
       design/reference/turnflock/garden/{06,07,09,10}-*.png, elements/hoekbegroeiing.png
Writes src/ui/themes/garden/garden-scene.webp    rows 0..sceneRows of the backdrop, unchanged
       src/ui/themes/garden/garden-paving.webp   three rows of paving stones that repeat downwards
       src/ui/themes/garden/garden-*.webp        decor pieces and props, transparent

Nothing is drawn or brought in from outside: every pixel comes from the owner's
pictures. The plant bases have the wooden post they stood round removed, the
single-object pictures lose their white background and their painted floor
shadow, and each decor piece gets a contact shadow baked in its own outline
(the same treatment as the robot theme's bushes, tools/asset-pipeline/turnflock-decor.py).

Run from the repo root:  python3 tools/asset-pipeline/build-garden-backdrop.py
Needs Pillow and numpy (tools only; the game has no new dependency).
"""
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / 'data/themes/garden/backdrop.json').read_text())
REF = ROOT / 'design/reference/turnflock/garden'
OUT = ROOT / 'src/ui/themes/garden'
OUT.mkdir(parents=True, exist_ok=True)


def load(name: str) -> np.ndarray:
    path = next(REF.glob(name + '*.png'))
    return np.asarray(Image.open(path).convert('RGB')).astype(float)


def load_rgba(name: str) -> np.ndarray:
    path = next(REF.glob(name + '*.png'))
    return np.asarray(Image.open(path).convert('RGBA')).astype(float)


def save_rgb(px: np.ndarray, name: str, quality: int) -> None:
    img = Image.fromarray(np.clip(px, 0, 255).astype(np.uint8), 'RGB')
    img.save(OUT / name, 'WEBP', quality=quality, method=6)
    print(f'{name:34s} {img.size[0]}x{img.size[1]}  {(OUT / name).stat().st_size / 1024:6.1f} kB')


def save_rgba(px: np.ndarray, name: str, width: int, quality: int) -> None:
    img = Image.fromarray(np.clip(px, 0, 255).astype(np.uint8), 'RGBA')
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(OUT / name, 'WEBP', quality=quality, alpha_quality=80, method=6)
    print(f'{name:34s} {img.size[0]}x{img.size[1]}  {(OUT / name).stat().st_size / 1024:6.1f} kB')


def smoothstep(lo: float, hi: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- backdrop ----

def backdrop() -> None:
    src = load('10-backdrop-garden')
    sc, pv = CFG['scene'], CFG['paving']
    save_rgb(src[: sc['sceneRows']], 'garden-scene.webp', sc['quality'])

    # The paving tile: rows top..top+period, its first `blend` rows faded from the rows
    # that follow the tile (top+period..). So the tile's first row is the row right
    # under the scene's last row (sceneRows == top + period), and its last row runs on
    # into its own first row: the stones continue without a seam both ways.
    top, period, blend = pv['pavingTop'], pv['period'], pv['blend']
    assert top + period == sc['sceneRows'], 'the tile must start where the scene stops'
    strip = src[top: top + period + blend]
    tile = strip[:period].copy()
    w = smoothstep(0, 1, (np.arange(blend) + 0.5) / blend)[:, None, None]
    tile[:blend] = strip[:blend] * w + strip[period: period + blend] * (1 - w)
    tile = without_tufts(tile)
    save_rgb(tile, 'garden-paving.webp', pv['quality'])
    print('sky top', src[:12, 300:700].reshape(-1, 3).mean(0).round(), 'sky at row 230', src[225:235, 400:600].reshape(-1, 3).mean(0).round())


def without_tufts(px: np.ndarray) -> np.ndarray:
    """Fill the grass tufts between the stones from the stone on either side, row by row.

    One tuft is charming in the scene; repeated every tile it would show the repeat."""
    hue, sat, val = hsv(px)
    tuft = (hue > 55) & (hue < 150) & (sat > 0.28) & (val > 0.35)
    # Only real tufts, not the green of the moss in the grout lines: tufts are blobs.
    blob = np.asarray(Image.fromarray((tuft * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)), float) > 0
    mask = np.asarray(Image.fromarray((blob * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(27)), float) > 0
    out = px.copy()
    for y in np.nonzero(mask.any(axis=1))[0]:
        row = mask[y]
        xs = np.arange(len(row))
        out[y, row] = np.stack([np.interp(xs[row], xs[~row], px[y, ~row, c]) for c in range(3)], axis=-1)
    soft = np.asarray(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), float)
    out[mask] = soft[mask]
    print('tufts filled:', int(mask.sum()), 'px')
    return out


# ------------------------------------------------------------ cut-outs ----

def flood_from_border(mask: np.ndarray) -> np.ndarray:
    """Pixels of `mask` connected to the picture's border."""
    h, w = mask.shape
    img = Image.new('L', (w + 2, h + 2), 255)
    img.paste(Image.fromarray((mask * 255).astype(np.uint8)), (1, 1))
    ImageDraw.floodfill(img, (0, 0), 128, thresh=0)
    return (np.asarray(img)[1:-1, 1:-1] == 128)


def flood_from_top(mask: np.ndarray) -> np.ndarray:
    """Pixels of `mask` connected to the picture's top edge."""
    h, w = mask.shape
    img = Image.new('L', (w, h + 1), 0)
    img.paste(Image.fromarray((mask * 255).astype(np.uint8)), (0, 1))
    img.paste(255, (0, 0, w, 1))
    ImageDraw.floodfill(img, (0, 0), 128, thresh=0)
    return (np.asarray(img)[1:] == 128)


def hsv(px: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r, g, b = (px[..., i] / 255 for i in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = np.where(mx - mn == 0, 1, mx - mn)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx == 0, 0, (mx - mn) / np.where(mx == 0, 1, mx))
    return np.where(mx - mn == 0, 0, h), s, mx


def white_cutout(px: np.ndarray) -> np.ndarray:
    """RGBA of an object on the owner's near-white studio background, floor shadow removed."""
    h, w, _ = px.shape
    border = np.concatenate([px[0], px[-1], px[:, 0], px[:, -1]])
    bg = np.median(border, axis=0)
    ratio = px / bg
    # Background and its soft floor shadow are the background's own tint, only darker.
    tint = ratio.max(axis=2) - ratio.min(axis=2)
    backish = (tint < 0.04) & (ratio.mean(axis=2) > 0.78)
    # The floor shadow is a cool lavender grey; the rocks are a warm grey, so they stay.
    _, sat, val = hsv(px)
    lavender = (sat < 0.2) & (val > 0.55) & (px[..., 2] >= px[..., 1] - 3) & (px[..., 0] >= px[..., 1] - 3)
    away = flood_from_border(backish | lavender)
    # Grow one pixel into the antialiased rim (no white fringe), then a soft edge.
    away = np.asarray(Image.fromarray((away * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)), float) > 0
    alpha = 1 - np.asarray(Image.fromarray((away * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), float) / 255
    a = np.clip(alpha, 1e-3, 1)[..., None]
    colour = np.clip((px - (1 - a) * bg) / a, 0, 255)  # take the white back out of the rim
    return np.dstack([colour, alpha * 255])


def remove_posts(rgba: np.ndarray) -> np.ndarray:
    """Clear the wooden post a plant base stood round (orange-brown, reaching the crop's top)."""
    hue, sat, val = hsv(rgba[..., :3])
    wood = (hue > 10) & (hue < 40) & (sat > 0.38) & (val > 0.3) & (rgba[..., 3] > 30)
    post = flood_from_top(wood)
    # The post's dark outline and antialiased rim: grow 3 px, but never into green leaves.
    grown = np.asarray(Image.fromarray((post * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)), float) > 0
    green = (hue > 60) & (hue < 160) & (sat > 0.3)
    post = grown & ~green
    keep = 1 - np.asarray(Image.fromarray((post * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), float) / 255
    out = rgba.copy()
    out[..., 3] *= keep
    return out


def erase(rgba: np.ndarray, poly: list[tuple[float, float]]) -> np.ndarray:
    """Clear a hand-drawn polygon, with a soft edge."""
    h, w, _ = rgba.shape
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    keep = 1 - np.asarray(m.filter(ImageFilter.GaussianBlur(1.2)), float) / 255
    out = rgba.copy()
    out[..., 3] *= keep
    return out


def sky_cutout(px: np.ndarray) -> np.ndarray:
    """RGBA of the tree branch in the backdrop's top-left corner: sky and clouds removed."""
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    sky = (b > r + 35) & (b > g + 4)
    cloud = (r > 205) & (g > 215) & (b > 228)
    away = (sky | cloud) & ~((g > b) & (g > r))  # holes between the leaves too
    alpha = 1 - np.asarray(Image.fromarray((away * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), float) / 255
    # Blue fringe on the rim: pull it towards the leaf green.
    rim = (alpha > 0.02) & (alpha < 0.98)
    px = px.copy()
    px[rim, 2] = np.minimum(px[rim, 2], px[rim, 1] * 0.75)
    return np.dstack([px, alpha * 255])


def drop_specks(rgba: np.ndarray, share: float = 0.02) -> np.ndarray:
    """Clear loose bits (opaque islands smaller than `share` of the piece) left by the cuts."""
    solid = rgba[..., 3] > 40
    img = Image.fromarray((solid * 255).astype(np.uint8))
    seen = np.zeros_like(solid)
    small = np.zeros_like(solid)
    for y, x in zip(*np.nonzero(solid)):
        if seen[y, x]:
            continue
        probe = img.copy()
        ImageDraw.floodfill(probe, (int(x), int(y)), 128, thresh=0)
        island = np.asarray(probe) == 128
        seen |= island
        if island.sum() < share * solid.sum():
            small |= island
    # Their faint antialiased rim goes too, but never a pixel of a kept island.
    grown = np.asarray(Image.fromarray((small * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), float) > 0
    out = rgba.copy()
    out[grown & ~(solid & ~small), 3] = 0
    return out


def trim(rgba: np.ndarray, pad: int) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 6)
    y0, y1, x0, x1 = max(0, ys.min() - pad), ys.max() + 1, max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + 1 + pad)
    out = rgba[y0:y1, x0:x1]
    return np.pad(out, ((0, pad), (0, 0), (0, 0)))  # room under the piece for its shadow


def with_shadow(rgba: np.ndarray, blur: float, drop: int, opacity: float, squash: float = 0.35, foot_rows: float = 1.0) -> np.ndarray:
    """A contact shadow from the piece's own outline: its lowest `foot_rows` flattened, moved down, blurred."""
    h, w, _ = rgba.shape
    alpha = Image.fromarray(rgba[..., 3].astype(np.uint8)).crop((0, round(h * (1 - foot_rows)), w, h))
    foot = alpha.resize((w, max(1, round(alpha.height * squash))))
    flat = Image.new('L', (w, h), 0)
    flat.paste(foot, (0, h - foot.height - max(0, drop)))
    flat = flat.transform((w, h), Image.AFFINE, (1, 0, 0, 0, 1, -drop)).filter(ImageFilter.GaussianBlur(blur))
    shadow = np.asarray(flat, float) / 255 * opacity
    piece = rgba[..., 3:4] / 255
    out_a = piece[..., 0] + shadow * (1 - piece[..., 0])
    tint = np.array([40, 70, 30], float)  # green-grey shade, as under the backdrop's own bushes
    safe = np.where(out_a > 0, out_a, 1)[..., None]
    rgb = (rgba[..., :3] * piece + tint * (shadow * (1 - piece[..., 0]))[..., None]) / safe
    return np.dstack([rgb, out_a * 255])


def pieces() -> None:
    dec = CFG['decor']
    for name, p in dec['pieces'].items():
        x0, y0, x1, y1 = p['box']
        if p['from'].startswith('elements/'):
            # Already a transparent picture from the owner: crop, shade the foot, nothing else.
            rgba = load_rgba(p['from'])[y0:y1, x0:x1]
            rgba = with_shadow(trim(rgba, 14), blur=8, drop=6, opacity=0.3, squash=0.5, foot_rows=0.3)
            save_rgba(rgba, name + '.webp', p['width'], dec['quality'])
            continue
        px = load(p['from'])[y0:y1, x0:x1]
        if p['from'].startswith('10-'):
            rgba = trim(sky_cutout(px), 0)
            rgba = with_shadow(rgba, blur=9, drop=4, opacity=0.18, squash=1)
        else:
            rgba = white_cutout(px)
            if p['from'].startswith(('07-', '09-')):
                rgba = remove_posts(rgba)
            for poly in p.get('erase', []):
                rgba = erase(rgba, [(x - x0, y - y0) for x, y in poly])
            rgba = drop_specks(rgba)
            rgba = with_shadow(trim(rgba, 14), blur=8, drop=6, opacity=0.34)
        save_rgba(rgba, name + '.webp', p['width'], dec['quality'])
    pr = CFG['props']
    for name, p in pr['pieces'].items():
        x0, y0, x1, y1 = p['box']
        rgba = with_shadow(trim(white_cutout(load(p['from'])[y0:y1, x0:x1]), 16), blur=10, drop=6, opacity=0.3, squash=0.3, foot_rows=0.12)
        save_rgba(rgba, name + '.webp', p['width'], pr['quality'])


if __name__ == '__main__':
    backdrop()
    pieces()

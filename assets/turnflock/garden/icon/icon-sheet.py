#!/usr/bin/env python3
"""Evidence sheet for the garden app icon: both themes' icons at 180, 64, 32 and 16 px, and the
tab icon's 64, 32 and 16 enlarged with its pixels shown as they are.

Run from the repo root:  python3 assets/turnflock/garden/icon/icon-sheet.py
Writes production/qa/evidence/garden-icon/icons-180-64-32-16.png.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "production/qa/evidence/garden-icon/icons-180-64-32-16.png"
THEMES = [
    ("Garden", ROOT / "assets/turnflock/garden/icon/icon-180-garden.png", ROOT / "assets/turnflock/garden/icon/favicon-64-garden.png"),
    ("Robot", ROOT / "assets/turnflock/brand/icon-180.png", ROOT / "assets/turnflock/brand/favicon-64.png"),
]
BG = (244, 246, 250)


def ios(img: Image.Image) -> Image.Image:
    """The touch icon cut to the rounded square a phone's home screen shows."""
    size, scale = img.width, 4
    mask = Image.new("L", (size * scale,) * 2, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * scale - 1, size * scale - 1), 0.225 * size * scale, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def main() -> None:
    row_h = 200 + 230 + 30
    sheet = Image.new("RGB", (1000, 20 + row_h * len(THEMES)), BG)
    d = ImageDraw.Draw(sheet)
    y = 10
    for name, touch_path, tab_path in THEMES:
        touch = Image.open(touch_path).convert("RGBA")
        tab = Image.open(tab_path).convert("RGBA")
        kb = touch_path.stat().st_size / 1024, tab_path.stat().st_size / 1024
        d.text((20, y), f"{name}: true size 180 (touch icon {kb[0]:.1f} KB, and with the rounding a phone applies), tab icon 64, 32, 16 ({kb[1]:.1f} KB)", fill=(40, 40, 40))
        y += 20
        x = 20
        sheet.paste(touch, (x, y), touch)
        x += 200
        r = ios(touch)
        sheet.paste(r, (x, y), r)
        x += 200
        for s in (64, 32, 16):
            t = tab.resize((s, s), Image.LANCZOS) if s != 64 else tab
            sheet.paste(t, (x, y), t)
            x += s + 20
        for dark, ty in ((True, y), (False, y + 50)):
            d.rectangle((x + 20, ty, x + 300, ty + 40), fill=(40, 42, 46) if dark else (255, 255, 255))
            t16 = tab.resize((16, 16), Image.LANCZOS)
            sheet.paste(t16, (x + 32, ty + 12), t16)
            d.text((x + 56, ty + 14), "Turnflock", fill=(230, 230, 230) if dark else (40, 40, 40))
        y += 190
        d.text((20, y), f"{name}: tab icon enlarged to the same height (pixels shown as they are): 64, 32, 16", fill=(40, 40, 40))
        y += 20
        x = 20
        for s in (64, 32, 16):
            t = tab.resize((s, s), Image.LANCZOS) if s != 64 else tab
            big = Image.new("RGBA", (s, s), BG + (255,))
            big.alpha_composite(t)
            big = big.resize((208, 208), Image.NEAREST)
            sheet.paste(big, (x, y))
            x += 228
        y += 240
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print(f"written {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

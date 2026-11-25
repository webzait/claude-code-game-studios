#!/usr/bin/env python3
"""Builds the garden level screen's backdrop from the owner's pictures.

Run from the repo root:  python3 tools/asset-pipeline/build-garden-levels-backdrop.py
Needs Pillow (with WebP), numpy and scipy. Writes src/ui/themes/garden/levels-backdrop.webp.

The owner's 25-backdrop-level-path is shown covering a phone screen, which cuts off its left and
right edges; its birdhouse stands right at the left edge and so is never seen on a phone. Here:
  1. That half birdhouse is taken out: the strip it stands in is covered with the mirror image of
     the strip just right of it (tree, hedge, fence), with soft edges.
  2. The owner's birdhouse (07-birdhouse, cut out by garden_cutout.py) is put back further in,
     standing on the lawn in front of the fence, inside the part a phone shows (from about 11% of
     the width on a 19.5:9 phone).
Nothing else is changed. Saved as WebP.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from garden_cutout import cut_out  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GARDEN = ROOT / "design/reference/turnflock/garden"
BACKDROP = GARDEN / "25-backdrop-level-path.webp"
BIRDHOUSE = GARDEN / "07-birdhouse.png"
OUT = ROOT / "src/ui/themes/garden/levels-backdrop.webp"
# The strip with the half birdhouse (x0, y0, x1, y1 in backdrop pixels) and how soft its edges are.
OLD = (0, 455, 62, 640)
FEATHER = 12
# Where the birdhouse goes: the middle of its base (backdrop pixels) and its height.
BASE_X, BASE_Y, HEIGHT = 172, 668, 196
QUALITY = 76


def main() -> None:
    img = Image.open(BACKDROP).convert("RGB")
    x0, y0, x1, y1 = OLD
    width, height = x1 - x0, y1 - y0
    patch = ImageOps.mirror(img.crop((x1, y0, x1 + width, y1)))
    mask = Image.new("L", (width, height), 0)
    for y in range(height):
        for x in range(width):
            edge = min(width - 1 - x, y, height - 1 - y)
            mask.putpixel((x, y), min(255, round(255 * edge / FEATHER)))
    img.paste(patch, (x0, y0), mask)
    house = cut_out(BIRDHOUSE)
    house = house.resize((round(house.width * HEIGHT / house.height), HEIGHT), Image.LANCZOS)
    canvas = img.convert("RGBA")
    canvas.alpha_composite(house, (BASE_X - house.width // 2, BASE_Y - house.height))
    canvas.convert("RGB").save(OUT, "WEBP", quality=QUALITY, method=6)
    print(f"{OUT.relative_to(ROOT)}: {canvas.width}x{canvas.height}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()

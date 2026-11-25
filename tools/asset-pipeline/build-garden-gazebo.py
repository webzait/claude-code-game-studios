#!/usr/bin/env python3
"""Cuts the gazebo for the end of the garden level path out of the owner's picture.

Run from the repo root:  python3 tools/asset-pipeline/build-garden-gazebo.py
Needs Pillow (with WebP), numpy and scipy. Writes src/ui/themes/garden/levels-gazebo.webp.
The cut-out itself is garden_cutout.py; here it is scaled down to WIDTH (pixel ratio 3 at the
largest size the path shows it, about 120 CSS px).
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from garden_cutout import cut_out  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design/reference/turnflock/garden/08-gazebo.png"
OUT = ROOT / "src/ui/themes/garden/levels-gazebo.webp"
WIDTH, QUALITY, ALPHA_QUALITY = 360, 82, 85


def main() -> None:
    img = cut_out(SOURCE)
    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
    img.save(OUT, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6)
    print(f"{OUT.relative_to(ROOT)}: {img.width}x{img.height}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the garden exit pictures: every part, or only those named.

    python3 tools/asset-pipeline/garden_exit/build.py                # all parts
    python3 tools/asset-pipeline/garden_exit/build.py turn gate      # only these

Each part is its own module here (exit_pads, colour_exits, turn, plate, gate, gazebo) with a
`run()` that writes assets/turnflock/garden/exit/*.webp and data/themes/garden/exit-sprites/<part>.json.
Design: design/themes/garden-exit.md.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

PARTS = ["exit_pads", "colour_exits", "turn", "plate", "gate", "gazebo"]

if __name__ == "__main__":
    for part in sys.argv[1:] or PARTS:
        if part not in PARTS:
            raise SystemExit(f"unknown part {part!r}; parts: {', '.join(PARTS)}")
        print(f"== {part}")
        importlib.import_module(part).run()

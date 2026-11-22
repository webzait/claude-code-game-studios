"""Colour-blindness simulation of a screenshot.

Matrices: Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
Greyscale is luminance only (Rec. 709): no colour at all.

usage: cvd.py <in.png> <out-prefix>
  ->   <out-prefix>-<kind>.png for protanopia, deuteranopia, tritanopia and greyscale
"""
import sys

import numpy as np
from PIL import Image

M = {
    'protanopia': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deuteranopia': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritanopia': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
    'greyscale': [[0.2126, 0.7152, 0.0722]] * 3,
}

src, out = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float64) / 255
lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
for name, m in M.items():
    sim = np.clip(lin @ np.array(m).T, 0, 1)
    srgb = np.where(sim <= 0.0031308, sim * 12.92, 1.055 * sim ** (1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8)).save(f'{out}-{name}.png')

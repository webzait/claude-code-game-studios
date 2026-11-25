#!/usr/bin/env python3
"""Evidence sheet for the garden star coin (design/themes/garden-coin.md): the cut star coin beside the
robot coin on light and dark, both at every size the game shows a coin, and the real price tags from the game.

Run from the repo root after tests/integration/garden-coin.spec.ts saved its shots (COIN_SHOTS=production/qa/evidence/garden-coin):
    python3 tools/asset-pipeline/garden-coin-sheet.py
"""
from PIL import Image, ImageDraw, ImageFont

E = 'production/qa/evidence/garden-coin'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
robot = Image.open('assets/turnflock/ui/coin.webp').convert('RGBA')
star = Image.open('assets/turnflock/garden/coin/star-coin.webp').convert('RGBA')
small = Image.open('assets/turnflock/garden/coin/star-coin-small.webp').convert('RGBA')
src = Image.open('design/reference/turnflock/garden/elements/stermunt.png').convert('RGBA')
font, tiny, bold = (ImageFont.truetype(FONT, 18), ImageFont.truetype(FONT, 14), ImageFont.truetype(FONT.replace('Sans.', 'Sans-Bold.'), 22))

W, H = 1500, 1420
sheet = Image.new('RGBA', (W, H), (255, 255, 255, 255))
d = ImageDraw.Draw(sheet)
d.text((30, 20), 'Garden star coin (stermunt) beside the robot coin', font=bold, fill='black')
for i, (bg, name) in enumerate([((255, 255, 255), 'light'), ((28, 30, 44), 'dark')]):
    y = 70 + i * 350
    col = (0, 0, 0) if i == 0 else (235, 235, 235)
    d.rectangle((20, y, W - 20, y + 335), fill=bg)
    d.text((40, y + 10), f'On {name}, pixels enlarged so the edge can be judged:', font=font, fill=col)
    for x, img, label in ((40, robot, 'robot coin.webp, 144 px (x2)'), (380, star, 'star-coin.webp, 96 px (x3)'), (720, small, 'star-coin-small.webp, 48 px (x6)')):
        sheet.alpha_composite(img.resize((288, 288), Image.NEAREST), (x, y + 38))
        d.text((x, y + 310), label, font=tiny, fill=col)
    sheet.alpha_composite(src.resize((288, 285), Image.LANCZOS), (1100, y + 38))
    d.text((1100, y + 310), "owner's stermunt.png (scaled)", font=tiny, fill=col)

y = 790
d.text((30, y), 'At the sizes the game uses, as a 2x phone draws them; robot coin above, star coin below:', font=font, fill='black')
sizes = [('Undo/Hint tag 24', 24, True), ('offer tag 32', 32, False), ('counter 26', 26, False), ('shop 30', 30, False), ('flying 34', 34, False), ('reward 40', 40, False), ('get-coins 18', 18, False)]
x = 40
for label, s, use_small in sizes:
    px = s * 2
    sheet.alpha_composite(robot.resize((px, px), Image.LANCZOS), (x, y + 40))
    sheet.alpha_composite((small if use_small else star).resize((px, px), Image.LANCZOS), (x, y + 130))
    d.text((x, y + 220), label, font=tiny, fill='black')
    if use_small:
        d.text((x, y + 238), '(small cut)', font=tiny, fill='black')
    x += max(px, 120) + 40

y = 1080
d.text((30, y), 'In the game at 320x568 (2x screenshot): the Undo and Hint price tags, the smallest coins on screen.', font=font, fill='black')
game = Image.open(f'{E}/garden-level-top-bar-price-tags-320x568.png').convert('RGBA')
sheet.alpha_composite(game.crop((80, 805, 560, 935)).resize((960, 260), Image.NEAREST), (40, y + 35))
d.text((1020, y + 120), 'shown x2 again', font=tiny, fill='black')
sheet.convert('RGB').save(f'{E}/star-coin-beside-robot-coin.png')
print(f'{E}/star-coin-beside-robot-coin.png')

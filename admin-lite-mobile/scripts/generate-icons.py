#!/usr/bin/env python3
"""Regenerate the Expo app icons from the black "AL" wordmark.

Writes into ./assets:
  - icon.png          1024  rounded black square + white "AL"  (iOS / base)
  - adaptive-icon.png 1024  white "AL" on transparent (Android foreground;
                            background colour supplied via app.json)
  - splash-icon.png    432  white "AL" on transparent (splash bg via app.json)
  - favicon.png         48  rounded black square + white "AL"

Self-contained: uses Pillow (PIL), which ships in the toolchain, plus system
Arial Bold. Run:  python3 scripts/generate-icons.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

ASSETS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))

TEXT = "AL"
BG = (0, 0, 0, 255)            # black
FG = (255, 255, 255, 255)      # white
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
SS = 4  # supersample


def _fit_font(draw, text, target_w):
    lo, hi = 4, 8000
    while lo < hi:
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(FONT_PATH, mid)
        l, t, r, b = draw.textbbox((0, 0), text, font=f)
        if (r - l) <= target_w:
            lo = mid
        else:
            hi = mid - 1
    return ImageFont.truetype(FONT_PATH, lo)


def render(size, *, width_ratio, corner_ratio=0.0, transparent_bg=False):
    W = size * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not transparent_bg:
        if corner_ratio > 0:
            d.rounded_rectangle([0, 0, W - 1, W - 1], radius=int(W * corner_ratio), fill=BG)
        else:
            d.rectangle([0, 0, W, W], fill=BG)
    font = _fit_font(d, TEXT, target_w=width_ratio * W)
    l, t, r, b = d.textbbox((0, 0), TEXT, font=font)
    x = (W - (r - l)) / 2 - l
    y = (W - (b - t)) / 2 - t
    d.text((x, y), TEXT, font=font, fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    path = os.path.join(ASSETS, name)
    img.save(path)
    print("  wrote assets/" + name)


if __name__ == "__main__":
    os.makedirs(ASSETS, exist_ok=True)
    # Main icon: rounded black square + white AL
    save(render(1024, width_ratio=0.56, corner_ratio=0.22), "icon.png")
    # Adaptive foreground: white AL within the safe zone, transparent bg
    save(render(1024, width_ratio=0.42, transparent_bg=True), "adaptive-icon.png")
    # Splash glyph: white AL on transparent (bg colour from app.json)
    save(render(432, width_ratio=0.50, transparent_bg=True), "splash-icon.png")
    # Web favicon
    save(render(48, width_ratio=0.56, corner_ratio=0.22), "favicon.png")
    print("Done.")

#!/usr/bin/env python3
"""Regenerate the talent-app launcher icons from the black "SH" wordmark.

Produces, from a single design (black background + white bold "SH"):
  - Android legacy bitmaps: res/mipmap-*/ic_launcher.png
  - Android adaptive icon:  res/mipmap-*/ic_launcher_foreground.png
                            res/mipmap-anydpi-v26/ic_launcher.xml
                            res/values/colors.xml (ic_launcher_background)
  - iOS AppIcon set:        ios/Runner/Assets.xcassets/AppIcon.appiconset/*.png
                            (opaque, no alpha — required by App Store)

No third-party installs: uses Pillow (PIL) which ships in the toolchain, and
Arial Bold from the system. Run from anywhere:  python3 scripts/generate-icons.py
"""

import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
IOS_ICONSET = os.path.join(
    ROOT, "ios", "Runner", "Assets.xcassets", "AppIcon.appiconset"
)

TEXT = "SH"
BG = (0, 0, 0, 255)            # black
FG = (255, 255, 255, 255)      # white
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

SS = 4  # supersample factor for crisp anti-aliasing


def _fit_font(draw, text, target_w):
    """Largest Arial-Bold size whose ink width <= target_w."""
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


def render(size, *, width_ratio, corner_ratio=0.0, transparent_bg=False, opaque=False):
    """Render one square icon at `size` px (supersampled then downscaled)."""
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
    img = img.resize((size, size), Image.LANCZOS)
    if opaque:  # iOS: flatten onto black, drop alpha
        bg = Image.new("RGB", (size, size), (0, 0, 0))
        bg.paste(img, mask=img.split()[3])
        return bg
    return img


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("  wrote", os.path.relpath(path, ROOT))


# --- Android -------------------------------------------------------------
# (density -> legacy px, adaptive-foreground canvas px)
ANDROID = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def gen_android():
    print("Android:")
    for dens, (legacy, fg) in ANDROID.items():
        # Legacy full-bleed rounded icon (pre-API 26 launchers)
        save(
            render(legacy, width_ratio=0.56, corner_ratio=0.22),
            os.path.join(ANDROID_RES, f"mipmap-{dens}", "ic_launcher.png"),
        )
        # Adaptive foreground: white SH inside the 66% safe zone, transparent bg
        save(
            render(fg, width_ratio=0.42, transparent_bg=True),
            os.path.join(ANDROID_RES, f"mipmap-{dens}", "ic_launcher_foreground.png"),
        )

    # Adaptive background colour
    colors = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#000000</color>\n'
        "</resources>\n"
    )
    cpath = os.path.join(ANDROID_RES, "values", "colors.xml")
    os.makedirs(os.path.dirname(cpath), exist_ok=True)
    with open(cpath, "w") as fh:
        fh.write(colors)
    print("  wrote", os.path.relpath(cpath, ROOT))

    # Adaptive icon descriptor (API 26+)
    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    apath = os.path.join(ANDROID_RES, "mipmap-anydpi-v26", "ic_launcher.xml")
    os.makedirs(os.path.dirname(apath), exist_ok=True)
    with open(apath, "w") as fh:
        fh.write(adaptive)
    print("  wrote", os.path.relpath(apath, ROOT))


# --- iOS -----------------------------------------------------------------
def gen_ios():
    print("iOS:")
    contents_path = os.path.join(IOS_ICONSET, "Contents.json")
    with open(contents_path) as fh:
        contents = json.load(fh)
    done = {}
    for entry in contents["images"]:
        fname = entry["filename"]
        side = float(entry["size"].split("x")[0])
        scale = int(entry["scale"].replace("x", ""))
        px = int(round(side * scale))
        if fname in done:  # same filename shared across idioms
            continue
        done[fname] = px
        save(render(px, width_ratio=0.56, opaque=True), os.path.join(IOS_ICONSET, fname))


if __name__ == "__main__":
    gen_android()
    gen_ios()
    print("Done.")

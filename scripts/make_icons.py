"""Generates the PWA icons (basketball on a dark tile) into public/icons/.
Usage: python scripts/make_icons.py   (needs Pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BG, BALL, SEAM = (11, 13, 18), (255, 176, 32), (11, 13, 18)
SS = 4  # supersampling for smooth edges


def icon(size, ball_ratio, rounded=True):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22) if rounded else 0, fill=BG)
    r = int(s * ball_ratio / 2)
    c = s // 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=BALL)
    w = max(2, int(s * 0.018))
    d.line([c - r, c, c + r, c], fill=SEAM, width=w)            # horizontal seam
    d.line([c, c - r, c, c + r], fill=SEAM, width=w)            # vertical seam
    for dx in (-1, 1):                                          # curved side seams
        box = [c + dx * r - int(r * 0.9), c - r, c + dx * r + int(r * 0.9), c + r]
        d.arc(box, 90 + (0 if dx < 0 else 0), 270 if dx > 0 else 450, fill=SEAM, width=w)
    d.ellipse([c - r, c - r, c + r, c + r], outline=SEAM, width=w)
    return img.resize((size, size), Image.LANCZOS)


icon(192, 0.62).save(OUT / "icon-192.png")
icon(512, 0.62).save(OUT / "icon-512.png")
icon(512, 0.46, rounded=False).save(OUT / "maskable-512.png")  # full-bleed, ball inside the safe zone
icon(180, 0.62, rounded=False).save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)

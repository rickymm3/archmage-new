"""Normalize transparent submenu icons to consistent production canvases."""

from pathlib import Path

from PIL import Image


MOBILE = Path(__file__).resolve().parents[1]
ICON_DIR = MOBILE / "assets" / "ui" / "submenu-icons" / "final"
CANVAS_SIZE = 160
CONTENT_SIZE = 144


for path in sorted(ICON_DIR.glob("*.png")):
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible pixels in {path.name}")
    icon = image.crop(bounds)
    icon.thumbnail((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    position = ((CANVAS_SIZE - icon.width) // 2, (CANVAS_SIZE - icon.height) // 2)
    canvas.alpha_composite(icon, position)
    canvas.save(path, optimize=True)
    print(f"{path.name}: {icon.width}x{icon.height} on {CANVAS_SIZE}x{CANVAS_SIZE}")

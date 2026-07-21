"""Crop and normalize transparent universal-HUD production assets."""

from pathlib import Path

from PIL import Image


MOBILE = Path(__file__).resolve().parents[1]
ASSET_DIR = MOBILE / "assets" / "ui" / "universal-hud" / "final"


def visible_crop(path):
    image = Image.open(path).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError(f"No visible pixels in {path.name}")
    return image.crop(bounds)


resource_path = ASSET_DIR / "resource-cell.png"
resource = visible_crop(resource_path)
resource.thumbnail((640, 320), Image.Resampling.LANCZOS)
resource.save(resource_path, optimize=True)
print(f"resource-cell.png: {resource.width}x{resource.height}")


for name in ["profile-frame", "settings-frame"]:
    path = ASSET_DIR / f"{name}.png"
    frame = visible_crop(path)
    frame.thumbnail((232, 232), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    canvas.alpha_composite(frame, ((256 - frame.width) // 2, (256 - frame.height) // 2))
    canvas.save(path, optimize=True)
    print(f"{path.name}: 256x256")


for name in ["gold-icon", "mana-icon", "land-icon", "settings-icon"]:
    path = ASSET_DIR / f"{name}.png"
    icon = visible_crop(path)
    icon.thumbnail((144, 144), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((160 - icon.width) // 2, (160 - icon.height) // 2))
    canvas.save(path, optimize=True)
    print(f"{path.name}: 160x160")

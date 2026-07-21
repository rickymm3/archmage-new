"""Split generated universal-HUD atlases into chroma-key production cells."""

from pathlib import Path

from PIL import Image


MOBILE = Path(__file__).resolve().parents[1]
SOURCE = MOBILE / "assets" / "ui" / "universal-hud" / "chroma"


def split_horizontal(source_name, names):
    image = Image.open(SOURCE / source_name).convert("RGB")
    width, height = image.size
    for index, name in enumerate(names):
        left = round(index * width / len(names))
        right = round((index + 1) * width / len(names))
        image.crop((left, 0, right, height)).save(SOURCE / f"{name}.png")
        print(f"{name}: {right - left}x{height}")


split_horizontal(
    "action-frames.png",
    [
        "profile-frame",
        "settings-frame",
    ],
)

split_horizontal(
    "resource-icons.png",
    [
        "gold-icon",
        "mana-icon",
        "land-icon",
        "settings-icon",
    ],
)

print("resource-cell: ready")

"""Split generated submenu atlases into equal chroma-key icon cells."""

from pathlib import Path

from PIL import Image


MOBILE = Path(__file__).resolve().parents[1]
SOURCE = MOBILE / "assets" / "ui" / "submenu-atlases"
OUTPUT = MOBILE / "assets" / "ui" / "submenu-icons" / "chroma"

ATLASES = {
    "home": (3, 1, ["home-overview", "home-tax", "home-mana"]),
    "kingdom": (
        4,
        2,
        [
            "kingdom-keep",
            "kingdom-barracks",
            "kingdom-bank",
            "kingdom-core",
            "kingdom-altar",
            "kingdom-farm",
            "kingdom-camp",
            "kingdom-market",
        ],
    ),
    "army": (5, 1, ["army-overview", "army-units", "army-defense", "army-recruit", "army-gear"]),
    "war": (4, 1, ["war-attack", "war-explore", "war-barbarians", "war-rankings"]),
    "magic": (3, 1, ["magic-research", "magic-cast", "magic-active"]),
}


OUTPUT.mkdir(parents=True, exist_ok=True)

for atlas_name, (columns, rows, icon_names) in ATLASES.items():
    atlas = Image.open(SOURCE / f"{atlas_name}.png").convert("RGB")
    width, height = atlas.size
    for index, icon_name in enumerate(icon_names):
        column = index % columns
        row = index // columns
        left = round(column * width / columns)
        right = round((column + 1) * width / columns)
        top = round(row * height / rows)
        bottom = round((row + 1) * height / rows)
        atlas.crop((left, top, right, bottom)).save(OUTPUT / f"{icon_name}.png")
        print(f"{icon_name}: {right - left}x{bottom - top}")

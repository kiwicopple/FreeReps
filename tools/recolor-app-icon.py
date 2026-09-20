#!/usr/bin/env python3
"""Recolour the web app icons onto the current accent and ground tokens.

The icons are two flat colours — the accent behind, the light ground for the
letters — plus the antialiasing between them. Rather than redraw the mark, each
pixel is projected onto the line between the two old colours and remixed from
the two new ones, which keeps the glyph shapes and edges exactly as they were.

Run from the repository root after changing the colour tokens in
server/web/src/index.css:

    python3 tools/recolor-app-icon.py --from-accent '#ec3013' --from-ground '#f3f2f2' \
        --to-accent '#1d5fa8' --to-ground '#edf0f1'
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

ICON_DIR = Path(__file__).resolve().parent.parent / "server" / "web" / "public" / "app-icon"


def parse_hex(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    if len(v) != 6:
        raise argparse.ArgumentTypeError(f"expected a six-digit hex colour, got {value!r}")
    return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4))


def recolour(path: Path, old_a, old_b, new_a, new_b) -> int:
    """Rewrite one icon in place. Returns the number of pixels touched."""
    image = Image.open(path).convert("RGBA")
    pixels = list(image.getdata())

    # The direction the two old colours span. Every pixel in the icon sits on
    # or near this line, so its position along it is the mix factor.
    axis = [b - a for a, b in zip(old_a, old_b)]
    length_sq = sum(c * c for c in axis)
    if length_sq == 0:
        raise ValueError("the two source colours are identical")

    out = []
    for r, g, b, alpha in pixels:
        offset = (r - old_a[0], g - old_a[1], b - old_a[2])
        t = sum(o * c for o, c in zip(offset, axis)) / length_sq
        t = min(1.0, max(0.0, t))
        out.append(
            (
                round(new_a[0] + t * (new_b[0] - new_a[0])),
                round(new_a[1] + t * (new_b[1] - new_a[1])),
                round(new_a[2] + t * (new_b[2] - new_a[2])),
                alpha,
            )
        )

    image.putdata(out)
    image.save(path)
    return len(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-accent", type=parse_hex, required=True)
    parser.add_argument("--from-ground", type=parse_hex, required=True)
    parser.add_argument("--to-accent", type=parse_hex, required=True)
    parser.add_argument("--to-ground", type=parse_hex, required=True)
    args = parser.parse_args()

    icons = sorted(ICON_DIR.glob("*.png"))
    if not icons:
        sys.exit(f"no icons found in {ICON_DIR}")

    for icon in icons:
        n = recolour(icon, args.from_accent, args.from_ground, args.to_accent, args.to_ground)
        print(f"{icon.relative_to(ICON_DIR.parent.parent.parent.parent)}: {n} pixels")


if __name__ == "__main__":
    main()

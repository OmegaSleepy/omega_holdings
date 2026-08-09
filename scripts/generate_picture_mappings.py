#!/usr/bin/env python3
"""
Scan each listing in `listings/`, collect all image files under its `pictures/` folder,
and write a `pictures.txt` mapping file inside the listing folder.

Each mapping file contains one relative path per line, for example:

pictures/main.png
pictures/room1.png
"""

from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
listings_dir = root / 'listings'

SUPPORTED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'}

if not listings_dir.exists():
    print('No listings/ folder found')
    raise SystemExit(1)


def natural_sort_key(value):
    parts = re.split(r'(\d+)', value)
    return [int(part) if part.isdigit() else part.lower() for part in parts]


def gather_picture_paths(pictures_dir):
    if not pictures_dir.exists() or not pictures_dir.is_dir():
        return []

    paths = []
    for path in pictures_dir.rglob('*'):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            relative_path = path.relative_to(pictures_dir.parent)
            paths.append(str(relative_path).replace('\\', '/'))

    paths.sort(key=natural_sort_key)
    return paths


for listing_dir in sorted(listings_dir.iterdir()):
    if not listing_dir.is_dir():
        continue

    pictures_dir = listing_dir / 'pictures'
    picture_paths = gather_picture_paths(pictures_dir)
    mapping_file = listing_dir / 'pictures.txt'

    mapping_text = '\n'.join(picture_paths)
    if picture_paths:
        mapping_text += '\n'

    mapping_file.write_text(mapping_text, encoding='utf-8')
    print(f'Wrote {mapping_file} ({len(picture_paths)} images)')

#!/usr/bin/env python3
"""
Generate static root-level listing pages from `listing.html` using each listing folder.
"""

import json
import re
from html import escape
from pathlib import Path

root = Path(__file__).resolve().parent.parent
listings_dir = root / 'listings'
template_path = root / 'listing.html'

if not template_path.exists():
    raise SystemExit('Missing listing template: listing.html')

if not listings_dir.exists():
    raise SystemExit('Missing listings directory')


def normalize_value(value: str) -> str:
    text = value.strip()
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
    return text


def parse_listing_metadata(contents: str) -> dict:
    lines = contents.splitlines()
    data = {}
    details = []
    if lines and lines[0].strip() == '---':
        i = 1
        while i < len(lines):
            line = lines[i]
            if line.strip() == '---':
                i += 1
                break
            if ':' in line:
                key, value = line.split(':', 1)
                data[key.strip().lower()] = normalize_value(value)
            i += 1
        details = lines[i:]
    else:
        details = lines
    data['details'] = '\n'.join(details).strip()
    return data


def natural_sort_key(value: str):
    parts = re.split(r'(\d+)', str(value))
    return [int(part) if part.isdigit() else part.lower() for part in parts]


def find_images(listing_dir: Path) -> list[Path]:
    picture_file = listing_dir / 'pictures.txt'
    if picture_file.exists():
        raw = picture_file.read_text(encoding='utf-8')
        entries = [line.strip().lstrip('./') for line in raw.splitlines() if line.strip() and not line.strip().startswith('#')]
        images = []
        for entry in entries:
            candidate = (listing_dir / entry).resolve()
            if candidate.exists() and candidate.is_file():
                images.append(candidate)
        if images:
            return sorted(images, key=lambda p: natural_sort_key(p.name))

    pictures_dir = listing_dir / 'pictures'
    if not pictures_dir.exists() or not pictures_dir.is_dir():
        return []

    images = [p for p in pictures_dir.rglob('*') if p.is_file() and p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'}]
    return sorted(images, key=lambda p: natural_sort_key(p.name))


def format_details_html(details: str) -> str:
    if not details:
        return '<p>Описание на резиденцията не е налично.</p>'

    html_parts = []
    paragraph_lines = []
    list_items = []

    def flush_paragraph():
        nonlocal paragraph_lines
        if paragraph_lines:
            html_parts.append(f'<p>{escape(" ".join(paragraph_lines))}</p>')
            paragraph_lines = []

    def flush_list():
        nonlocal list_items
        if list_items:
            items = ''.join(f'<li>{escape(item)}</li>' for item in list_items)
            html_parts.append(f'<ul>{items}</ul>')
            list_items = []

    for line in details.splitlines():
        stripped = line.strip()
        if stripped.startswith('- '):
            flush_paragraph()
            list_items.append(stripped[2:].strip())
        elif stripped == '':
            flush_list()
            flush_paragraph()
        else:
            paragraph_lines.append(stripped)

    flush_list()
    flush_paragraph()
    return '\n'.join(html_parts)


def safe_filename(name: str) -> str:
    sanitized = re.sub(r'[^0-9A-Za-z_-]+', '_', name.strip())
    sanitized = sanitized.strip('_')
    return sanitized or 'listing'


def replace_element_content(html: str, element_id: str, new_content: str) -> str:
    """Safely replace inner content of an element matching id="..." using regex."""
    pattern = rf'(<[^>]+id=["\']{element_id}["\'][^>]*>)(.*?)(</[^>]+>)'
    return re.sub(pattern, rf'\g<1>{new_content}\g<3>', html, flags=re.DOTALL)


def build_page(listing_name: str, metadata: dict, image_paths: list[Path], template: str) -> str:
    formatted_name = listing_name.replace('_', ' ')
    page_title = f'{formatted_name} — ОМЕГА Холдингс'

    price_display = metadata.get('price', '—')
    raw_size = metadata.get('size', '—')
    if raw_size and raw_size != '—' and not raw_size.lower().endswith('m2') and not raw_size.lower().endswith('m²'):
        size_display = f'{raw_size} m²'
    else:
        size_display = raw_size

    address_display = metadata.get('address', 'Paris, France')
    summary = f'{size_display} | {price_display} | {address_display}'

    images = image_paths if image_paths else []
    if images:
        main_image = next((img for img in images if img.name.lower() == 'main.png'), images[0])
        primary_image = './' + str(main_image.relative_to(root)).replace('\\', '/')
    else:
        primary_image = './img/hero.png'

    image_rel_paths = [('./' + str(p.relative_to(root)).replace('\\', '/')) for p in images]
    if not image_rel_paths:
        image_rel_paths = [primary_image]

    details_html = format_details_html(metadata.get('details', ''))
    year_display = metadata.get('year', '—')
    image_caption = Path(image_rel_paths[0]).stem.replace('_', ' ')
    page_url = f'./{safe_filename(listing_name)}.html'

    # Embedded payload for listing.js
    listing_data = {
        'name': listing_name,
        'title': formatted_name,
        'price': metadata.get('price', ''),
        'size': metadata.get('size', ''),
        'year': metadata.get('year', ''),
        'address': metadata.get('address', ''),
        'details': metadata.get('details', ''),
        'details_html': details_html,  # Preserved HTML format for listing.js
        'images': image_rel_paths,
        'description': summary,
    }

    page_html = template

    # Metadata & Titles
    page_html = re.sub(r'<title>.*?</title>', f'<title>{escape(page_title)}</title>', page_html)
    page_html = re.sub(r'content="[^"]*?"\s+name="description"', f'content="{escape(summary)}" name="description"', page_html)
    page_html = re.sub(r'property="og:title"\s+content="[^"]*?"', f'property="og:title" content="{escape(page_title)}"', page_html)
    page_html = re.sub(r'property="og:image"\s+content="[^"]*?"', f'property="og:image" content="{escape(primary_image)}"', page_html)

    # Dynamic element replacements via ID matching
    page_html = replace_element_content(page_html, 'listing-title', escape(formatted_name))
    page_html = replace_element_content(page_html, 'listing-eyebrow', 'Резиденция')
    page_html = replace_element_content(page_html, 'listing-price', escape(price_display))
    page_html = replace_element_content(page_html, 'listing-size', escape(size_display))
    page_html = replace_element_content(page_html, 'listing-year', escape(year_display))
    page_html = replace_element_content(page_html, 'listing-address', escape(address_display))
    page_html = replace_element_content(page_html, 'listing-details', details_html)
    page_html = replace_element_content(page_html, 'carousel-caption', escape(image_caption))
    page_html = replace_element_content(page_html, 'carousel-counter', f'1 / {len(image_rel_paths)}')

    # Carousel Main Image update
    page_html = re.sub(
        r'<img\s+id="carousel-image"\s+src="[^"]*"\s+alt="[^"]*"',
        f'<img id="carousel-image" src="{escape(image_rel_paths[0])}" alt="{escape(formatted_name)}"',
        page_html
    )

    # Inject static data payload
    json_block = json.dumps(listing_data, ensure_ascii=False, indent=2)
    listing_data_script = f'<script id="listing-data" type="application/json">\n{json_block}\n</script>\n  '
    page_html = page_html.replace('<script src="./js/listing.js"></script>', f'{listing_data_script}<script src="./js/listing.js"></script>')

    return page_html


def main():
    template = template_path.read_text(encoding='utf-8')

    for listing_dir in sorted(listings_dir.iterdir()):
        if not listing_dir.is_dir() or listing_dir.name.startswith('.'):
            continue

        info_file = listing_dir / 'information.md'
        if not info_file.exists():
            print(f'Skipping {listing_dir.name}: missing information.md')
            continue

        metadata = parse_listing_metadata(info_file.read_text(encoding='utf-8'))
        images = find_images(listing_dir)
        output_name = f'{safe_filename(listing_dir.name)}.html'
        output_path = root / output_name

        page_html = build_page(listing_dir.name, metadata, images, template)
        output_path.write_text(page_html, encoding='utf-8')
        print(f'Wrote {output_path.relative_to(root)}')


if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
Scan the `listings/` folder and produce `listings.csv` with header:
name,price,size,year_of_building

This script expects each listing to have an `information.md` file that contains
lines of the form `Key: Value` such as `Price: 850000` and `Size: 85` and `Year: 1890`.
"""
import csv
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
listings_dir = root / 'listings'
out = root / 'listings.csv'
rows = []
if not listings_dir.exists():
    print('No listings/ folder found')
    exit(0)

def parse_frontmatter(text):
    lines = text.splitlines()
    fm = {}
    if lines and lines[0].strip() == '---':
        i = 1
        while i < len(lines) and lines[i].strip() != '---':
            line = lines[i]
            if ':' in line:
                k,v = line.split(':',1)
                fm[k.strip().lower()] = v.strip()
            i += 1
    return fm

num_re = re.compile(r"([0-9]+)")

for p in listings_dir.iterdir():
    if not p.is_dir():
        continue
    info_file = p / 'information.md'
    if not info_file.exists():
        print(f'skipping {p.name}: no information.md')
        continue
    text = info_file.read_text(encoding='utf-8')
    fm = parse_frontmatter(text)
    price_raw = fm.get('price','')
    size_raw = fm.get('size','')
    year_raw = fm.get('year','')
    # Extract numeric parts
    price_m = num_re.search(price_raw)
    size_m = num_re.search(size_raw)
    year_m = num_re.search(year_raw)
    price = price_m.group(1) if price_m else ''
    size = size_m.group(1) if size_m else ''
    year = year_m.group(1) if year_m else ''
    address_raw = fm.get('address','')
    rows.append((p.name,price,size,year,address_raw))

with out.open('w',newline='',encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['name','price','size','year_of_building','address'])
    for r in rows:
        writer.writerow(r)
print(f'Wrote {out}')

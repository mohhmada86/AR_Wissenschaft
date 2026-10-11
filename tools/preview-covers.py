#!/usr/bin/env python3
"""Create a contact sheet of actual generated covers; requires Pillow.

This is a cover proof, not a screenshot of the website or its CSS layout.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / 'data/covers.json').read_text())
    selected = []
    for subject in dict.fromkeys(value['subject'] for value in manifest['books'].values()):
        selected.extend([(key, value) for key, value in manifest['books'].items()
                         if value['subject'] == subject][:2])
    width, height, columns = 224, 336, 6
    rows = (len(selected) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * (width + 24) + 24, rows * (height + 58) + 100), '#f8f6ee')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(ROOT / 'assets/fonts/DejaVuSans.ttf'), 15)
    draw.text((24, 22), 'AL ILM BIL ARABI  /  ACTUAL GENERATED DISPLAY COVERS', fill='#183343', font=font)
    for index, (_, data) in enumerate(selected):
        file = ROOT / data['path']
        if file.suffix != '.webp':
            raise RuntimeError('Generate WebP derivatives with Pillow before making the contact sheet.')
        with Image.open(file) as image:
            image = image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
            x = 24 + (index % columns) * (width + 24)
            y = 70 + (index // columns) * (height + 58)
            sheet.paste(image, (x, y))
        draw.text((x, y + height + 12), data['subject'].upper(), fill='#183343', font=font)
    (ROOT / 'qa').mkdir(exist_ok=True)
    destination = ROOT / 'qa/cover-contact-sheet.png'
    sheet.save(destination)
    print(f'{len(selected)} actual covers rendered to {destination.name}')


if __name__ == '__main__':
    main()

"""Copy exact vector definitions from the stimulus generator's SVG template."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
source = root.parent / 'smst_eyetrack_stimuli/export/positions_svg/8_REPEAT_PRACTICE.svg'
ns = {'svg': 'http://www.w3.org/2000/svg'}
ET.register_namespace('', ns['svg'])
template = ET.parse(source).getroot()
pieces = {}
names = {'pawn': 'p', 'knight': 'n', 'bishop': 'b', 'rook': 'r', 'queen': 'q', 'king': 'k'}
out = root / 'docs/assets/pieces'
out.mkdir(parents=True, exist_ok=True)
for definition in template.find('svg:defs', ns):
    color, name = definition.attrib['id'].split('-')
    if name not in names:
        continue
    letter = names[name].upper() if color == 'white' else names[name]
    image = ET.Element(f'{{{ns["svg"]}}}svg', {'viewBox': '0 0 45 45'})
    image.append(definition)
    filename = f'{color}-{name}.svg'
    (out / filename).write_text(ET.tostring(image, encoding='unicode'), encoding='utf-8')
    pieces[letter] = f'assets/pieces/{filename}'
assert len(pieces) == 12
js = '// Exact piece artwork copied from the original stimulus SVG template.\n'
js += f'const assets = {json.dumps(pieces, indent=2)};\n'
js += '''export function pieceSvg(piece) {
  if (!Object.hasOwn(assets, piece)) throw new Error('Unknown chess piece');
  return `<img aria-hidden="true" alt="" draggable="false" class="piece" src="${assets[piece]}">`;
}
'''
(root / 'docs/pieces.js').write_text(js, encoding='utf-8')
print('Copied all twelve original piece definitions.')

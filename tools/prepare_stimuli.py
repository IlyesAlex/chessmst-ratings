"""Read the original XLSX files and create a reproducible constrained order.
Standard library only. Run from any directory: python tools/prepare_stimuli.py
"""
import argparse
import csv
import hashlib
import json
import math
import random
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rows = []
        for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:sheetData/s:row', NS):
            values = {}
            for cell in row:
                col = re.match(r'[A-Z]+', cell.attrib['r'])[0]
                index = 0
                for c in col:
                    index = index * 26 + ord(c) - 64
                v = cell.find('s:v', NS)
                raw = v.text if v is not None else None
                typ = cell.get('t')
                if typ == 's':
                    value = strings[int(raw)]
                elif typ == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                elif raw is not None:
                    value = float(raw) if '.' in raw else int(raw)
                else:
                    value = None
                values[index - 1] = value
            rows.append([values.get(i) for i in range(max(values, default=-1) + 1)])
        return [dict(zip(rows[0], r)) for r in rows[1:] if any(v is not None for v in r)]

def validate_fen(fen):
    ranks = fen.split()[0].split('/')
    assert len(ranks) == 8, fen
    for rank in ranks:
        assert all(c in '12345678prnbqkPRNBQK' for c in rank), fen
        assert sum(int(c) if c.isdigit() else 1 for c in rank) == 8, fen

def violations(order):
    locations = defaultdict(list)
    score = 0
    run = 0
    last = None
    for i, s in enumerate(order):
        locations[s['pair_id']].append(i)
        run = run + 1 if last == s['stimtype'] else 1
        last = s['stimtype']
        score += max(0, run - 3) * 3
    for positions in locations.values():
        for a, b in zip(positions, positions[1:]):
            score += max(0, 16 - (b - a))
    return score

def generate_order(rows, seed):
    rng = random.Random(seed)
    for restart in range(30):
        order = list(rows)
        rng.shuffle(order)
        score = violations(order)
        for step in range(30000):
            if score == 0:
                return order
            a, b = rng.sample(range(len(order)), 2)
            order[a], order[b] = order[b], order[a]
            candidate = violations(order)
            temp = max(.1, 2 * (1 - step / 30000))
            if candidate <= score or rng.random() < math.exp((score - candidate) / temp):
                score = candidate
            else:
                order[a], order[b] = order[b], order[a]
    raise RuntimeError('No valid order found; try another seed. Constraints were NOT relaxed.')

def prepare_set(set_name, seed):
    source = read_xlsx(ROOT / f'ChessMST_stimuli_{set_name}.xlsx')
    excluded = []
    if set_name == 'B':
        excluded = [s['trialno'] for s in source if s['stimtype'] == 'REPEAT' and s['order'] == 2]
        rows = [dict(s) for s in source if s['trialno'] not in excluded]
        for s in rows:
            match = re.fullmatch(r'(\d+)_(BOTHLURE|BLACKLURE|REPEAT)(?:_([12]))?\.png', s['position_fname'])
            assert match and match[2] == s['stimtype']
            s['pair_id'] = f'{match[2]}:{match[1]}'
            s['id'] = f'trial-{s["trialno"]:03d}'
    else:
        rows = []
        for item in source:
            for version, prefix in ((1, 'baseline'), (2, 'repeat')):
                # Demo rows contain BOTH versions. Expand them into separate positions.
                # Keep the original item fields alongside the common frontend fields.
                rows.append({**item, 'trialno': (item['itemno'] - 1) * 2 + version,
                             'order': version, 'position_fname': item[f'{prefix}_fname'],
                             'position_fen': item[f'{prefix}_FEN'], 'position_eval': item[f'{prefix}_evaluation'],
                             'pair_id': f'{item["stimtype"]}:{item["itemno"]}',
                             'id': f'demo-item-{item["itemno"]:03d}-v{version}'})
    questions = read_xlsx(ROOT / 'stimuli_q.xlsx')
    for s in rows:
        validate_fen(s['position_fen'])
    assert len({s['position_fen'].split()[0] for s in rows}) == len(rows), 'Duplicate board positions in retained set'
    groups = defaultdict(list)
    for s in rows:
        groups[s['pair_id']].append(s)
    assert all((len(g) == 1 and g[0]['order'] == 1) if g[0]['stimtype'] == 'REPEAT'
               else (len(g) == 2 and {s['order'] for s in g} == {1, 2}) for g in groups.values())
    for q in questions:
        assert q['q_type'] in ('likert', 'indicate')
        q['mode'] = 'pairs' if q['q_id'] == 'ch_conflict' else ('scale' if q['q_type'] == 'likert' else 'squares')
        if q['mode'] == 'scale':
            q['min'], q['max'] = (-3, 3) if q['q_id'] == 'ch_material' else (1, 7)
    order = generate_order(rows, seed)
    for i, s in enumerate(order, 1):
        s['presentation_index'] = i
    assert violations(order) == 0
    assert Counter(s['id'] for s in rows) == Counter(s['id'] for s in order)
    positions = defaultdict(list)
    for i, s in enumerate(order):
        positions[s['pair_id']].append(i)
    gaps = {k: v[1] - v[0] - 1 for k, v in positions.items() if len(v) == 2}
    runs = []
    for s in order:
        if runs and runs[-1][0] == s['stimtype']:
            runs[-1][1] += 1
        else:
            runs.append([s['stimtype'], 1])
    payload = {'set': set_name, 'seed': seed, 'stimuli': order, 'questions': questions}
    fingerprint = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    payload['studyVersion'] = f'chessmst-{set_name.lower()}-{fingerprint}'
    out = ROOT / 'docs' / 'data'
    out.mkdir(parents=True, exist_ok=True)
    (out / f'study_{set_name}.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    fields = ['presentation_index', 'id', 'pair_id'] + [k for k in rows[0] if k not in ('presentation_index', 'id', 'pair_id')]
    suffix = '' if set_name == 'B' else '_demo'
    with (ROOT / f'stimuli_order{suffix}.csv').open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fields)
        w.writeheader()
        w.writerows(order)
    report = {'set': set_name, 'studyVersion': payload['studyVersion'], 'seed': seed, 'source_row_count': len(source), 'trial_count': len(order),
              'question_count': len(questions), 'required_answers': len(order) * len(questions),
              'pair_count': len(gaps), 'singleton_count': sum(len(g) == 1 for g in groups.values()),
              'stimtype_counts': dict(Counter(s['stimtype'] for s in rows)),
              'minimum_intervening_positions': min(gaps.values(), default=None), 'maximum_same_type_run': max(r[1] for r in runs),
              'all_retained_positions_preserved': True, 'unique_board_positions': len(rows),
              'excluded_repeat_second_trialnos': excluded, 'pair_gaps': gaps}
    (ROOT / f'order_validation{suffix}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'pair_gaps'}, indent=2))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=20261012)
    parser.add_argument('--set', choices=['B', 'demo', 'all'], default='all', help='Generate one set or both (default).')
    args = parser.parse_args()
    for name in (['B', 'demo'] if args.set == 'all' else [args.set]):
        prepare_set(name, args.seed)

if __name__ == '__main__':
    main()

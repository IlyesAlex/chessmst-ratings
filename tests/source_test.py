"""Independently reconcile both generated sets with the actual XLSX source positions."""
import json
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from prepare_stimuli import read_xlsx

for name in ('B','demo'):
    source=read_xlsx(root/f'ChessMST_stimuli_{name}.xlsx')
    data=json.loads((root/f'docs/data/study_{name}.json').read_text(encoding='utf8'))
    if name=='B':
        retained=[s for s in source if not(s['stimtype']=='REPEAT' and s['order']==2)]
        actual={s['trialno']:s for s in data['stimuli']}
        assert set(actual)=={s['trialno'] for s in retained}
        for original in retained:
            assert all(actual[original['trialno']][k]==v for k,v in original.items())
    else:
        actual={(s['itemno'],s['order']):s for s in data['stimuli']}
        assert len(actual)==len(source)*2
        for item in source:
            for version,prefix in ((1,'baseline'),(2,'repeat')):
                row=actual[(item['itemno'],version)]
                assert row['position_fen']==item[f'{prefix}_FEN']
                assert row['position_fname']==item[f'{prefix}_fname']
                assert all(row[k]==v for k,v in item.items())
    assert len({s['position_fen'].split()[0] for s in data['stimuli']})==len(data['stimuli'])
    assert [(q['q_id'],q['q_type'],q['q_name']) for q in data['questions']]==[(q['q_id'],q['q_type'],q['q_name']) for q in read_xlsx(root/'stimuli_q.xlsx')]
    print(f'{name}: source reconciliation, unique boards, question preservation: PASS')

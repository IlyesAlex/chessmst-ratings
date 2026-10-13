"""Exercise the actual SQL with SQLite, including triggers and concurrent revisions."""
import json
import sqlite3
import re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.executescript((root/'backend/schema.sql').read_text())
study=json.loads((root/'docs/data/study_B.json').read_text(encoding='utf8'))
state={'studyVersion':study['studyVersion'],'cursor':0,'records':{}}
sql=re.search(r'export const SAVE_SQL = `([^`]+)`', (root/'backend/worker.js').read_text()).group(1)
generation=db.execute('SELECT generation FROM collection_control WHERE id=1').fetchone()[0]
def save(base,mutation):
    cur=db.execute(sql,('single',study['studyVersion'],json.dumps(state),mutation,'2026-10-12T12:00:00Z',generation,base,'single',base,base))
    return cur.rowcount
assert save(0,'a')==1
assert save(0,'stale')==0
state['records']['trial-001:ch_material']={'value':0,'submitted':False,'updatedAt':'t1'}
assert save(1,'b')==1
assert db.execute('SELECT count(*) FROM response_history').fetchone()[0]==1
state['cursor']=1
assert save(2,'c')==1
assert db.execute('SELECT count(*) FROM response_history').fetchone()[0]==1
state['records']['trial-001:ch_material']['submitted']=True
assert save(3,'d')==1
assert db.execute('SELECT answer,submitted FROM responses').fetchone()==(0,1)
assert db.execute('SELECT count(*) FROM response_history').fetchone()[0]==2
db.commit()
print('SQLite schema, revision compare-and-swap, history and response view: PASS')
db.executescript((root/'backend/reset-all-test-data.sql').read_text())
assert db.execute('SELECT count(*) FROM study_state').fetchone()[0]==0
assert db.execute('SELECT count(*) FROM response_history').fetchone()[0]==0
assert db.execute('SELECT count(*) FROM responses').fetchone()[0]==0
assert db.execute("SELECT count(*) FROM sqlite_master WHERE type='trigger'").fetchone()[0]==3
assert db.execute('SELECT generation FROM collection_control WHERE id=1').fetchone()[0]>generation
assert save(0,'stale-insert')==0
assert save(4,'stale-update')==0
assert db.execute('SELECT count(*) FROM study_state').fetchone()[0]==0
generation=db.execute('SELECT generation FROM collection_control WHERE id=1').fetchone()[0]
assert save(0,'after-reset')==1
db.execute('DELETE FROM study_state')
assert save(0,'stale-after-manual-delete')==0
generation=db.execute('SELECT generation FROM collection_control WHERE id=1').fetchone()[0]
assert save(1,'cannot-insert-with-nonzero-revision')==0
db.executescript((root/'backend/reset-all-test-data.sql').read_text())
assert save(0,'stale-after-already-empty-reset')==0
print('Reset SQL deletes test data and preserves the working schema: PASS (in-memory test only)')
print('Actual Worker SQL rejects stale generations, manual deletion and insert/update reset races: PASS')

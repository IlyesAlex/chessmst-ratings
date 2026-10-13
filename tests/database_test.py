"""Exercise the actual SQL with SQLite, including triggers and concurrent revisions."""
import json
import sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.executescript((root/'backend/schema.sql').read_text())
study=json.loads((root/'docs/data/study_B.json').read_text(encoding='utf8'))
state={'studyVersion':study['studyVersion'],'cursor':0,'records':{}}
sql='''INSERT INTO study_state(id,study_version,revision,state_json,last_mutation_id,updated_at)
VALUES(?,?,1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=revision+1,state_json=excluded.state_json,
last_mutation_id=excluded.last_mutation_id,updated_at=excluded.updated_at
WHERE study_state.revision=? AND study_state.study_version=excluded.study_version'''
def save(base,mutation):
    cur=db.execute(sql,('single',study['studyVersion'],json.dumps(state),mutation,'2026-10-12T12:00:00Z',base))
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

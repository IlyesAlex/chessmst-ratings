"""Exercise history migration and compare actual SQLite work without remote D1 usage."""
import json
import re
import sqlite3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
schema=(root/'backend/schema.sql').read_text()
migration=(root/'backend/migrate-low-read-history.sql').read_text()
save_sql=re.search(r'export const SAVE_SQL = `([^`]+)`',(root/'backend/worker.js').read_text()).group(1)
old_trigger='''CREATE TRIGGER history_update AFTER UPDATE ON study_state BEGIN
 INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
 SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
 FROM json_each(NEW.state_json,'$.records') AS j
 LEFT JOIN json_each(OLD.state_json,'$.records') AS o ON o.key=j.key
 WHERE o.value IS NULL OR j.value!=o.value;
END;'''

def database(legacy=False):
    db=sqlite3.connect(':memory:')
    db.executescript(schema)
    if legacy:
        db.executescript('DROP TRIGGER history_update;'+old_trigger)
    return db

def save(db,state,base):
    if '_historyChanges' in state:
        state['_historyRevision']=base+1
    return db.execute(save_sql,('s','v',json.dumps(state),f'm{base}','now',0,base,'s',base,base)).rowcount

def record(value):
    return {'value':value,'submitted':False,'updatedAt':str(value)}

db=database(legacy=True)
state={'studyVersion':'v','cursor':0,'records':{'a':record(1),'b':record(2)}}
assert save(db,state,0)==1
snapshot=db.execute('SELECT * FROM study_state').fetchall()
history=db.execute('SELECT * FROM response_history').fetchall()
for _ in range(2):
    db.executescript(migration)
    assert db.execute('SELECT * FROM study_state').fetchall()==snapshot
    assert db.execute('SELECT * FROM response_history').fetchall()==history
    assert db.execute('SELECT generation FROM collection_control').fetchone()==(0,)
# Legacy callers still get correct history via a linear fallback.
state['records']['b']=record(3)
assert save(db,state,1)==1
assert db.execute('SELECT count(*) FROM response_history').fetchone()==(3,)
state['cursor']=1
assert save(db,state,2)==1
assert db.execute('SELECT count(*) FROM response_history').fetchone()==(3,)
# New callers supply a computed delta. Navigation cannot duplicate old answer history.
state['records']['a']=record(4)
state['_historyChanges']={'a':state['records']['a']}
assert save(db,state,3)==1
assert db.execute('SELECT response_key FROM response_history ORDER BY id DESC LIMIT 1').fetchone()==('a',)
state['_historyChanges']={}
assert save(db,state,4)==1
assert db.execute('SELECT count(*) FROM response_history').fetchone()==(4,)
# Old/manual writers may retain stale metadata: it must fall back to actual records.
state['records']['a']=record(5)
db.execute('UPDATE study_state SET revision=revision+1,state_json=?,last_mutation_id=? WHERE id=?',(json.dumps(state),'legacy-after-new','s'))
assert db.execute('SELECT count(*) FROM response_history').fetchone()==(5,)
db.execute('UPDATE study_state SET state_json=json_set(state_json,\'$.cursor\',2) WHERE id=\'s\'')
assert db.execute('SELECT count(*) FROM response_history').fetchone()==(5,)
print('History migration is repeatable; answers/history/reset marker preserved; legacy and delta saves: PASS')

def work(size,legacy=False):
    db=database(legacy)
    records={f'answer-{n}':record(n) for n in range(size)}
    state={'studyVersion':'v','cursor':0,'records':records,'_historyChanges':records.copy()}
    assert save(db,state,0)==1
    records['answer-0']=record(-1)
    state['_historyChanges']={'answer-0':records['answer-0']}
    steps=0
    def progress():
        nonlocal steps
        steps+=1
        return 0
    db.set_progress_handler(progress,1)
    assert save(db,state,1)==1
    db.set_progress_handler(None,0)
    assert db.execute('SELECT count(*) FROM response_history').fetchone()==(size+1,)
    return steps

old=work(300,legacy=True)
new=work(300)
small=work(10)
assert old>new*100,(old,new)
assert new<small*2,(new,small)
print(f'SQLite VM steps for ONE changed answer among 300: old={old:,}; optimized={new:,}. Not a D1 billing measurement.')

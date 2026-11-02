import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotsFromBackup} from '../tools/backup-snapshot.js';

test('Processed exports use the exact downloaded SQL snapshot without a second remote read',()=>{
  const sql="CREATE TABLE study_state(id TEXT,revision INTEGER,state_json TEXT,updated_at TEXT); INSERT INTO study_state VALUES ('current',9,'{\"records\":{\"answer\":{\"value\":0}}}','2026-11-02'); INSERT INTO study_state VALUES ('old',2,'{}','2026-10-01');";
  const rows=snapshotsFromBackup(sql,"SELECT id AS study_id,revision,state_json,updated_at AS server_saved_at FROM study_state WHERE id='current'");
  assert.equal(rows.length,1);assert.equal(rows[0].revision,9);assert.equal(JSON.parse(rows[0].state_json).records.answer.value,0);
  assert.deepEqual(snapshotsFromBackup(sql,"SELECT id FROM study_state WHERE id='missing'"),[]);
  assert.throws(()=>snapshotsFromBackup('broken SQL','SELECT 1'));
});

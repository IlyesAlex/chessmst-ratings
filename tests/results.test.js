import test from 'node:test';
import assert from 'node:assert/strict';
import study from '../docs/data/study_demo.json' with {type:'json'};
import {emptyState,recordKey} from '../docs/core.js';
import {resultRows,resultsSql} from '../tools/results-core.js';
import {elapsed} from '../docs/timing.js';
test('Fresh preprocessing preserves zero, pairs, clock time and missing old elapsed time',()=>{
  const state=emptyState(study),s=study.stimuli[0],q=study.questions.find(q=>q.q_id==='ch_material');
  state.records[recordKey(s,q)]={value:0,submitted:true,updatedAt:'2026-10-13T12:34:56.123Z'};
  let row=resultRows(study,state,'test')[0];assert.equal(row.response,0);assert.equal(row.response_date,'2026-10-13');assert.equal(row.response_time,'14:34:56.123');assert.equal(row.response_time_seconds,'');assert.equal(row.trialno,1);assert.equal(row.itemnumber,s.position_fname.replace('.png',''));
  state.records[recordKey(s,q)].responseTimeMs=1234;row=resultRows(study,state,'test')[0];assert.equal(row.response_time_seconds,1.234);
  state.records[recordKey(s,q)].submitted=false;assert.equal(resultRows(study,state,'test',{submittedOnly:true}).length,0);
  assert.ok(resultsSql([row]).includes('CREATE TABLE exported_responses'));assert.ok(resultsSql([row]).includes('INSERT INTO exported_responses'));
  assert.equal(elapsed(100,1000,1500),600);
});

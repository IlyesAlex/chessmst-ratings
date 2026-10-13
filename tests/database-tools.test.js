import test from 'node:test';
import assert from 'node:assert/strict';
import study from '../docs/data/study_demo.json' with {type:'json'};
import {emptyState,recordKey} from '../docs/core.js';
import {inspectState,resetSql} from '../tools/database-core.js';
test('Inspection distinguishes drafts, submitted answers and complete positions',()=>{
  const state=emptyState(study),s=study.stimuli[0];
  for(const q of study.questions)state.records[recordKey(s,q)]={value:q.mode==='scale'?q.min:[],submitted:true,updatedAt:'2026-10-13T12:00:00Z'};
  state.records[recordKey(study.stimuli[1],study.questions[0])]={value:3,submitted:false,updatedAt:'2026-10-13T12:00:00Z'};
  const report=inspectState(study,{state,revision:2});
  assert.equal(report.valid,true);assert.equal(report.expectedResponses,480);assert.equal(report.submitted,12);assert.equal(report.drafts,1);assert.equal(report.completedPositions,1);
  state.records[recordKey(s,study.questions[0])].value=99;assert.equal(inspectState(study,{state,revision:2}).valid,false);
});
test('Empty cloud state is recognised and reset SQL scope is explicit',()=>{
  assert.equal(inspectState(study,{state:null,revision:0}).empty,true);
  const sql=resetSql(["test's-demo"]);assert.ok(sql.includes("'test''s-demo'"));assert.ok(sql.includes('WHERE study_id IN'));assert.ok(sql.includes('WHERE id IN'));
  assert.throws(()=>resetSql([]));assert.ok(resetSql([],{allData:true}).includes('DELETE FROM study_state;'));
  assert.ok(sql.includes('UPDATE collection_control SET generation=generation+1'));
});

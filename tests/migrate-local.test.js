import test from 'node:test';
import assert from 'node:assert/strict';
import study from '../docs/data/study_B.json' with {type:'json'};
import {emptyState,recordKey} from '../docs/core.js';
import {migrationCandidate} from '../docs/migrate-local.js';
import {remoteAction} from '../docs/sync-state.js';

test('Account migration preserves pending edits and blocks re-import after any reset',()=>{
  const state=emptyState(study),key=recordKey(study.stimuli[0],study.questions[0]);
  state.records[key]={value:3,submitted:false,updatedAt:'2026-11-02'};
  const old={state,generation:7,revision:649,dirty:true,edits:22,lastMutationId:'old'};
  const remote={state:emptyState(study),generation:7,revision:649,lastMutationId:'server'};
  const candidate=migrationCandidate(study,JSON.stringify(old),remote,7);
  assert.deepEqual(candidate,old);assert.equal(remoteAction(candidate,remote),'keep');
  assert.equal(migrationCandidate(study,JSON.stringify(old),{...remote,generation:8,state:null,revision:0},7),null);
  assert.equal(migrationCandidate(study,JSON.stringify({...old,generation:6}),remote,7),null);
  assert.equal(migrationCandidate(study,'broken',remote,7),null);
  assert.equal(migrationCandidate(study,JSON.stringify(old),{...remote,state:null,revision:0},7),null);
  assert.equal(remoteAction(candidate,{...remote,revision:650}),'conflict');
});

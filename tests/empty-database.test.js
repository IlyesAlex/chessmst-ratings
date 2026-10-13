import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmed,backupLooksComplete,parseCounts} from '../tools/empty-database-core.js';
test('Database cleanup requires the exact named target and complete backup',()=>{
  assert.equal(confirmed('EMPTY chessmst-ratings','chessmst-ratings'),true);
  for(const input of ['','yes','EMPTY','EMPTY another-database'])assert.equal(confirmed(input,'chessmst-ratings'),false);
  assert.equal(backupLooksComplete(''),false);assert.equal(backupLooksComplete('CREATE TABLE study_state;'),false);
  assert.equal(backupLooksComplete('CREATE TABLE study_state; CREATE TABLE response_history;'),true);
});
test('Cleanup verifies both response state and history counts',()=>{
  assert.deepEqual(parseCounts('[{"results":[{"remaining_states":0,"remaining_history":0}]}]'),{remaining_states:0,remaining_history:0});
  assert.throws(()=>parseCounts('[{"results":[]}]'));
});

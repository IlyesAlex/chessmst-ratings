import test from 'node:test';
import assert from 'node:assert/strict';
import {stateWithHistoryChanges,publicState,quotaError} from '../backend/history.js';
import {retryDelay,shouldSync,SYNC_INTERVAL_MS} from '../docs/sync-policy.js';

test('History records only changed answers, with cursor-only writes producing an empty delta',()=>{
  const a={value:3,submitted:true,updatedAt:'a'},b={value:['e4'],submitted:false,updatedAt:'b'};
  const before={studyVersion:'v',cursor:0,records:{a,b}};
  const current={...before,cursor:1};
  assert.deepEqual(stateWithHistoryChanges(current,JSON.stringify(before))._historyChanges,{});
  const edited={...current,records:{...before.records,b:{...b,submitted:true}}};
  assert.deepEqual(stateWithHistoryChanges(edited,JSON.stringify(before))._historyChanges,{b:edited.records.b});
  assert.deepEqual(stateWithHistoryChanges(before,null)._historyChanges,before.records);
  assert.deepEqual(publicState(JSON.stringify(stateWithHistoryChanges(edited,JSON.stringify(before)))),edited);
  assert.deepEqual(stateWithHistoryChanges({...current,_historyChanges:{fake:a}},JSON.stringify(before))._historyChanges,{});
  assert.deepEqual(publicState(JSON.stringify(before)),before);assert.equal(publicState(null),null);
});
test('Quota backoff and hidden-tab policy limit retries without blocking edits or manual checks',()=>{
  assert.equal(quotaError(new Error("D1_ERROR: Your account has exceeded D1's maximum amount of rows read per day")),true);
  assert.equal(quotaError(new Error('SQL syntax error')),false);
  assert.equal(retryDelay(1,true),900000);assert.equal(retryDelay(8,true),900000);
  assert.equal(retryDelay(1),30000);assert.equal(retryDelay(2),60000);assert.equal(retryDelay(10),300000);
  const policy={hidden:false,dirty:true,now:100,retryAt:200};
  assert.equal(shouldSync(policy),false);assert.equal(shouldSync({...policy,force:true}),true);
  assert.equal(shouldSync({...policy,now:200}),true);
  assert.equal(shouldSync({...policy,hidden:true,dirty:false,now:300}),false);
  assert.equal(shouldSync({...policy,hidden:true,dirty:true,now:300}),true);
  assert.equal(SYNC_INTERVAL_MS,300000);
});

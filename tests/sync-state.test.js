import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteAction} from '../docs/sync-state.js';
const remote={generation:0,revision:0,state:null,lastMutationId:null};
const fresh=()=>({generation:0,revision:0,dirty:false,state:{cursor:0,records:{}},lastMutationId:null});

test('An empty server clears legacy browser answers, including dirty revision-zero saves',()=>{
  for(const dirty of [false,true])for(const revision of [0,7]){
    const box={...fresh(),generation:undefined,dirty,revision,state:{cursor:1,records:{answer:{value:3}}}};
    assert.equal(remoteAction(box,remote),'reset');
  }
  assert.equal(remoteAction({...fresh(),generation:undefined},remote),'load');
  const legacy={...fresh(),generation:undefined,revision:2,dirty:true,state:{cursor:1,records:{answer:{value:3}}}};
  assert.equal(remoteAction(legacy,{...remote,revision:2,state:{cursor:1,records:{other:{value:4}}}}),'reset');
});
test('A reset generation clears pending answers even when revisions happen to match',()=>{
  const box={...fresh(),dirty:true,state:{cursor:1,records:{answer:{value:3}}}};
  assert.equal(remoteAction(box,{...remote,generation:1}),'reset');
  assert.equal(remoteAction({...box,revision:2},{...remote,generation:1,revision:2,state:{cursor:0,records:{}}}),'reset');
});
test('Fresh answers after fetching an empty server and offline edits in the same generation can sync',()=>{
  const box={...fresh(),dirty:true,state:{cursor:1,records:{answer:{value:3}}}};
  assert.equal(remoteAction(box,remote),'keep');
  assert.equal(remoteAction({...box,revision:4},{...remote,revision:4,state:box.state}),'keep');
  assert.equal(remoteAction({...box,revision:4,lastMutationId:'retry'},{...remote,revision:5,lastMutationId:'retry',state:box.state}),'ack');
});
test('Ordinary competing edits stay conflicts; clean clients load server progress',()=>{
  const newer={...remote,revision:3,state:{cursor:1,records:{}}};
  assert.equal(remoteAction({...fresh(),dirty:true},newer),'conflict');
  assert.equal(remoteAction(fresh(),newer),'load');
  assert.equal(remoteAction({...fresh(),revision:3,dirty:true},remote),'reset');
  assert.throws(()=>remoteAction(fresh(),{...remote,generation:undefined}));
});

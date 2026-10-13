import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseFen,validAnswer,clickPair,toPairs,emptyState,validateState,recordKey,firstIncomplete,completedCount,exportRows} from '../docs/core.js';
import {selectSet,databaseStudyId} from '../docs/sets.js';
const studies=['B','demo'].map(name=>JSON.parse(fs.readFileSync(new URL(`../docs/data/study_${name}.json`,import.meta.url),'utf8')));
const study=studies[0];
for(const dataset of studies)test(`${dataset.set}: unique positions, retained trials, pair spacing and type runs`,()=>{
  const study=dataset,expected=study.set==='B'?216:40;
  assert.equal(study.stimuli.length,expected);assert.equal(new Set(study.stimuli.map(s=>s.id)).size,expected);
  assert.equal(new Set(study.stimuli.map(s=>s.position_fen.split(/\s+/)[0])).size,expected);
  assert.equal(study.stimuli.filter(s=>s.stimtype==='REPEAT'&&s.order===2).length,0);
  const pairs=new Map();let run=0,last;
  study.stimuli.forEach((s,i)=>{
    assert.equal(s.presentation_index,i+1);assert.doesNotThrow(()=>parseFen(s.position_fen));
    if(!pairs.has(s.pair_id))pairs.set(s.pair_id,[]);pairs.get(s.pair_id).push(i);
    run=s.stimtype===last?run+1:1;last=s.stimtype;assert.ok(run<=3);
  });
  assert.equal([...pairs.values()].filter(x=>x.length===2).length,study.set==='B'?88:20);
  for(const [key,indices] of pairs){if(key.startsWith('REPEAT:'))assert.equal(indices.length,1);else{assert.equal(indices.length,2);assert.ok(indices[1]-indices[0]-1>=15);}}
  assert.notDeepEqual(study.stimuli.map(s=>s.trialno),study.stimuli.map(s=>s.trialno).sort((a,b)=>a-b));
});
test('Config and URL selection isolate each set, fingerprint and collection',()=>{
  assert.equal(selectSet('', 'B'),'B');assert.equal(selectSet('', 'demo'),'demo');
  assert.equal(selectSet('?set=demo','B'),'demo');assert.equal(selectSet('?set=B','demo'),'B');
  assert.throws(()=>selectSet('?set=unknown'));
  assert.notEqual(databaseStudyId('rater',studies[0]),databaseStudyId('rater',studies[1]));
  assert.notEqual(databaseStudyId('rater',study),databaseStudyId('test',study));
  assert.notEqual(databaseStudyId('rater',study),databaseStudyId('rater',{...study,studyVersion:'changed'}));
  assert.equal(validateState(studies[1],emptyState(study)),false);
});
test('FEN coordinates correctly place pieces without inventing missing metadata',()=>{
  const board=parseFen('r6k/8/8/8/8/8/8/K6R');
  assert.deepEqual(board,{a8:'r',h8:'k',a1:'K',h1:'R'});
  assert.deepEqual(parseFen('r6k/8/8/8/8/8/8/K6R w - - 0 1'),board);
  for(const bad of ['8/8','9/8/8/8/8/8/8/8','7/8/8/8/8/8/8/8','x7/8/8/8/8/8/8/8'])assert.throws(()=>parseFen(bad));
});
test('Scales require actual selection and material accepts zero and negative integers',()=>{
  assert.equal(study.questions.length,12);
  for(const q of study.questions.filter(q=>q.mode==='scale')) {
    assert.equal(q.max-q.min,6);
    for(let i=q.min;i<=q.max;i++)assert.ok(validAnswer(q,i));
    for(const bad of [null,undefined,'1',q.min-1,q.max+1,1.5])assert.equal(validAnswer(q,bad),false);
  }
  assert.ok(validAnswer(study.questions.find(q=>q.q_id==='ch_material'),0));
});
test('Pairs preserve sequential grouping, allow shared squares, reject unfinished pairs',()=>{
  const q=study.questions.find(q=>q.mode==='pairs');
  let clicks=[];for(const s of ['a1','b2','a1','c3'])clicks=clickPair(clicks,s);
  assert.deepEqual(toPairs(clicks),[['a1','b2'],['a1','c3']]);assert.ok(validAnswer(q,toPairs(clicks)));
  assert.equal(validAnswer(q,[['a1']]),false);assert.equal(validAnswer(q,[['a1','a1']]),false);
  assert.deepEqual(clickPair(['a1'],'a1'),[]);assert.ok(validAnswer(q,[]));assert.equal(validAnswer(q,null),false);
});
for(const study of studies)test(`${study.set}: resume, draft validation, full completion and backup roundtrip`,()=>{
  const total=study.stimuli.length*study.questions.length;
  const state=emptyState(study),s=study.stimuli[0],q=study.questions[0];
  state.cursor=total;assert.equal(validateState(study,state),false);state.cursor=0;
  state.records[recordKey(s,q)]={value:3,submitted:false,updatedAt:new Date().toISOString()};
  assert.equal(firstIncomplete(study,state),0);assert.equal(completedCount(state),0);
  state.records[recordKey(s,q)].submitted=true;assert.equal(firstIncomplete(study,state),1);
  const pairQ=study.questions.find(q=>q.mode==='pairs');state.records[recordKey(s,pairQ)]={value:[['e4']],submitted:false,updatedAt:new Date().toISOString()};
  assert.ok(validateState(study,state));state.records[recordKey(s,pairQ)].submitted=true;assert.equal(validateState(study,state),false);
  for(const s of study.stimuli)for(const q of study.questions)state.records[recordKey(s,q)]={value:q.mode==='scale'?q.min:[],submitted:true,updatedAt:new Date().toISOString()};
  state.cursor=total;assert.equal(firstIncomplete(study,state),total);assert.equal(completedCount(state),total);
  const restored=JSON.parse(JSON.stringify(state));assert.ok(validateState(study,restored));assert.equal(exportRows(study,restored).length,total);
  assert.equal(exportRows(study,restored)[0].stimulus_set,study.set);
  restored.studyVersion='wrong';assert.equal(validateState(study,restored),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import b from '../docs/data/study_B.json' with {type:'json'};
import demo from '../docs/data/study_demo.json' with {type:'json'};
import {scaleLabels} from '../docs/scales.js';
import {emptyState,recordKey,validAnswer} from '../docs/core.js';
import {resultRows} from '../tools/results-core.js';

const order=['ch_typicality','ch_unint','ch_king_white','ch_king_black','ch_material','ch_position_eval','ch_hang','ch_endangered','ch_weak_pawn','ch_strong_piece','ch_conflict','ch_attention'];
for(const study of [b,demo])test(`${study.set}: revised questionnaire order, wording, scales and exports`,()=>{
  assert.deepEqual(study.questions.map(q=>q.q_id),order);
  assert.equal(study.questions[7].q_name,'Jelöld meg a mezőket, ahol veszélyben levő figurát látsz!');
  assert.equal(study.questions.filter(q=>q.mode==='scale').length,5);
  assert.equal(study.questions.some(q=>q.q_id==='ch_strong_pawn'||q.q_id==='ch_undefended'),false);
  const material=study.questions[4],overall=study.questions[5];
  assert.equal(overall.q_name,'Ki áll jobban az állás alapján?');
  assert.deepEqual([material.min,material.max],[-3,3]);
  assert.deepEqual([overall.min,overall.max],[1,7]);
  assert.deepEqual(scaleLabels(overall),['1 · Sötét áll jobban','4 · Egyenlő','7 · Világos áll jobban']);
  assert.ok(validAnswer(overall,4));assert.equal(validAnswer(overall,0),false);
  assert.deepEqual(scaleLabels(material),['−3 · Sötét előnye','0 · Egyenlő','+3 · Világos előnye']);
  const state=emptyState(study);
  state.records[recordKey(study.stimuli[0],overall)]={value:4,submitted:true,updatedAt:'2026-10-17T12:00:00Z'};
  const [row]=resultRows(study,state,'test');
  assert.equal(row.question_type,'ch_position_eval');assert.equal(row.response,4);assert.equal(row.question_format,'scale');
});

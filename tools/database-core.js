import {validateState,recordKey,validAnswer,completedCount,firstIncomplete} from '../docs/core.js';
export function inspectState(study,envelope) {
  const state=envelope.state;
  if(!state)return {set:study.set,studyVersion:study.studyVersion,expectedResponses:study.stimuli.length*study.questions.length,storedResponses:0,submitted:0,drafts:0,completedPositions:0,revision:envelope.revision,valid:true,empty:true,errors:[]};
  const errors=[];let valid=false;
  try{valid=validateState(study,state);}catch{}
  if(!valid)errors.push('State shape, version, cursor or response values are invalid.');
  const entries=Object.entries(state.records||{});
  const submitted=entries.filter(([,r])=>r?.submitted===true).length;
  const completedPositions=study.stimuli.filter(s=>study.questions.every(q=>{
    const r=state.records?.[recordKey(s,q)];return r?.submitted===true&&validAnswer(q,r.value);
  })).length;
  return {set:study.set,studyVersion:study.studyVersion,expectedResponses:study.stimuli.length*study.questions.length,
    storedResponses:entries.length,submitted,drafts:entries.length-submitted,completedPositions,
    revision:envelope.revision,cursor:state.cursor,firstIncomplete:valid?firstIncomplete(study,state):null,valid,empty:entries.length===0,errors};
}
const quote = value => "'"+value.replaceAll("'","''")+"'";
export function resetSql(ids,{allData=false}={}) {
  if(!allData&&!ids.length)throw new Error('Choose a reset scope');
  const history=allData?'':` WHERE study_id IN (${ids.map(quote).join(', ')})`;
  const states=allData?'':` WHERE id IN (${ids.map(quote).join(', ')})`;
  return '-- DELETES STORED RESPONSES. Run only after backup and closing all survey tabs.\n'+
    'UPDATE collection_control SET generation=generation+1 WHERE id=1;\n'+
    `DELETE FROM study_state${states};\nDELETE FROM response_history${history};\n`+
    'SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states, (SELECT COUNT(*) FROM response_history) AS remaining_history;\n';
}

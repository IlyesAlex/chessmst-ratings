import {recordKey,validateState} from '../docs/core.js';
export const FIELDS=['trialno','itemnumber','question_type','response','response_date','response_time','response_time_seconds','stimulus_set','source_trialno','item_no','condition','variant','question_format','submitted','response_timestamp_utc','study_version','study_id'];
export function resultsSql(rows){
  const numeric=new Set(['trialno','response_time_seconds','source_trialno','item_no','variant']);
  const literal=v=>v===''||v===null||v===undefined?'NULL':typeof v==='boolean'?String(Number(v)):typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
  return '-- Preprocessed latest responses. Import into SQLite as a separate table.\nCREATE TABLE exported_responses (\n'+FIELDS.map(f=>`  ${f} ${f==='submitted'?'INTEGER':numeric.has(f)?'REAL':'TEXT'}`).join(',\n')+'\n);\n'+rows.map(r=>`INSERT INTO exported_responses (${FIELDS.join(',')}) VALUES (${FIELDS.map(f=>literal(r[f])).join(',')});`).join('\n')+'\n';
}
export function resultRows(study,state,id,{submittedOnly=false,timeZone='Europe/Budapest'}={}){
  if(!state)return [];
  if(!validateState(study,state))throw new Error(`Invalid state for ${study.set}`);
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  return study.stimuli.flatMap(s=>study.questions.flatMap(q=>{
    const r=state.records[recordKey(s,q)];if(!r||submittedOnly&&!r.submitted)return [];
    const date=new Date(r.updatedAt);if(Number.isNaN(date.valueOf()))throw new Error('Invalid response timestamp');
    const p=Object.fromEntries(formatter.formatToParts(date).map(x=>[x.type,x.value]));
    return [{trialno:s.presentation_index,itemnumber:s.position_fname.replace(/\.png$/i,''),question_type:q.q_id,
      response:r.value===null?'':Array.isArray(r.value)?JSON.stringify(r.value):r.value,
      response_date:`${p.year}-${p.month}-${p.day}`,response_time:`${p.hour}:${p.minute}:${p.second}.${String(date.getUTCMilliseconds()).padStart(3,'0')}`,
      response_time_seconds:r.responseTimeMs===undefined?'':r.responseTimeMs/1000,
      stimulus_set:study.set,source_trialno:s.trialno,item_no:s.itemno??Number(s.position_fname.split('_')[0]),condition:s.stimtype,
      variant:s.order,question_format:q.mode,submitted:r.submitted,response_timestamp_utc:date.toISOString(),study_version:study.studyVersion,study_id:id}];
  }));
}

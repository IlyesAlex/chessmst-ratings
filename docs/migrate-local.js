import {validateState} from './core.js';

// One-time account migration. A future database reset changes generation and blocks it.
export function migrationCandidate(study,saved,remote,expectedGeneration){
  if(!Number.isSafeInteger(expectedGeneration)||remote.generation!==expectedGeneration)return null;
  let box;try{box=JSON.parse(saved);}catch{return null;}
  if(!box||box.generation!==expectedGeneration||!Number.isSafeInteger(box.revision)||box.revision<0||!Number.isSafeInteger(box.edits)||box.edits<0||typeof box.dirty!=='boolean')return null;
  if(!validateState(study,box.state))return null;
  if(!remote.state&&box.revision>0)return null;
  return box;
}

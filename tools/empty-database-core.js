export const confirmationText = database => `EMPTY ${database}`;
export function confirmed(input,database){return input.trim()===confirmationText(database);}
export function backupLooksComplete(text){return text.includes('CREATE TABLE')&&text.includes('study_state')&&text.includes('response_history');}
export function parseCounts(stdout){
  const row=JSON.parse(stdout).flatMap(r=>r.results||[])[0];
  if(!row||!Number.isInteger(row.remaining_states)||!Number.isInteger(row.remaining_history))throw new Error('Cannot verify database counts.');
  return row;
}

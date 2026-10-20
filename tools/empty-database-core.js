export const confirmationText = database => `EMPTY ${database}`;
export function confirmed(input,database){return input.trim()===confirmationText(database);}
export function backupLooksComplete(text){return text.includes('CREATE TABLE')&&text.includes('study_state')&&text.includes('response_history');}
export function parseCounts(stdout){
  const row=JSON.parse(stdout).flatMap(r=>r.results||[])[0];
  if(!row||!Number.isSafeInteger(row.remaining_states)||row.remaining_states<0||!Number.isSafeInteger(row.remaining_history)||row.remaining_history<0)throw new Error('Cannot verify database counts.');
  if(!Number.isSafeInteger(row.generation)||row.generation<0)throw new Error('The database reset marker is missing or invalid. Apply backend/schema.sql before emptying.');
  return row;
}

export const SETS = {B: {file:'study_B.json',label:'B'}, demo: {file:'study_demo.json',label:'Demo'}};
export function selectSet(search, fallback='B') {
  const selected=new URLSearchParams(search).get('set') ?? fallback;
  if(!Object.hasOwn(SETS,selected))throw new Error('Unknown stimulus set. Use B or demo.');
  return selected;
}
export const databaseStudyId = (prefix,study) => `${prefix}:${study.set}:${study.studyVersion}`;

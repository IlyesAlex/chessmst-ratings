// Compute the delta in JavaScript, where comparing records does not consume D1 rows.
export function stateWithHistoryChanges(state,previousJson,revision){
  const previous=previousJson?JSON.parse(previousJson).records:{};
  const changes=Object.fromEntries(Object.entries(state.records).filter(([key,record])=>JSON.stringify(record)!==JSON.stringify(previous?.[key])));
  return {...state,_historyChanges:changes,_historyRevision:revision};
}
export function publicState(json){
  if(!json)return null;
  const {_historyChanges,_historyRevision,...state}=JSON.parse(json);
  return state;
}
export function quotaError(error){
  return /exceeded D1|D1.*(?:read|write).*(?:limit|quota)|(?:daily|read|write).*(?:quota|limit).*exceed|(?:quota|limit).*(?:exceeded|reached)/i.test(error?.message||'');
}

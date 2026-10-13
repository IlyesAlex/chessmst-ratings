// The database generation survives deleted states and invalidates pre-reset sessions.
export function remoteAction(box,remote) {
  if(!Number.isSafeInteger(remote.generation)||remote.generation<0)throw new Error('Az adatbázis resetvédelme még nincs telepítve.');
  const known=Number.isSafeInteger(box.generation);
  const progress=box.revision>0||box.state.cursor>0||Object.keys(box.state.records).length>0;
  if(known&&box.generation!==remote.generation)return 'reset';
  // Legacy dirty saves cannot prove they belong to the current collection.
  if(!known&&progress&&box.dirty)return 'reset';
  if(!remote.state&&((!known&&progress)||box.revision>0))return 'reset';
  if(remote.revision!==box.revision){
    if(remote.lastMutationId&&remote.lastMutationId===box.lastMutationId)return 'ack';
    return box.dirty?'conflict':'load';
  }
  return box.dirty?'keep':'load';
}

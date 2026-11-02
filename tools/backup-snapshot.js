import {DatabaseSync} from 'node:sqlite';

// Restore a trusted D1 export in memory, never over a live database.
export function snapshotsFromBackup(sql,query){
  const database=new DatabaseSync(':memory:');
  try{
    database.exec(sql);
    const check=database.prepare('PRAGMA integrity_check').get();
    if(Object.values(check)[0]!=='ok')throw new Error('The downloaded SQL backup failed the local integrity check.');
    return database.prepare(query).all();
  }finally{database.close();}
}

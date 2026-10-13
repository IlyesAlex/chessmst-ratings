// Manual admin utility. The confirmation gate is never bypassed by a command flag.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {confirmationText,confirmed,backupLooksComplete,parseCounts} from './empty-database-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const backend=path.join(root,'backend');
const config=await fs.readFile(path.join(backend,'wrangler.toml'),'utf8');
const database=config.match(/^database_name\s*=\s*"([^"]+)"/m)?.[1];
const uuid=config.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
if(!database||!uuid||uuid.includes('REPLACE'))throw new Error('Configure database_name and database_id in backend/wrangler.toml first.');
const npx=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
const query='SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states, (SELECT COUNT(*) FROM response_history) AS remaining_history, (SELECT generation FROM collection_control WHERE id=1) AS generation;';
function wrangler(args,capture=false){
  const result=spawnSync(process.execPath,[npx,'--yes','--prefer-online','wrangler@4.150.0',...args],{cwd:backend,encoding:'utf8',env:{...process.env,CI:'true'},stdio:capture?['ignore','pipe','pipe']:'inherit'});
  if(result.status!==0)throw new Error(capture?(result.stderr||result.stdout||'Wrangler failed.'):'Wrangler failed. Stop here and inspect the error.');
  return result.stdout;
}
console.log(`Database: ${database}\nDatabase UUID: ${uuid}`);
console.log('This removes ALL responses, drafts and history from BOTH B and demo, including old dataset versions.');
console.log('Tables and the Worker remain. Close every survey tab on every device first.');
const before=parseCounts(wrangler(['d1','execute',database,'--remote','--command',query,'--json'],true));
console.log('Current counts:',before);
const input=createInterface({input:process.stdin,output:process.stdout});
try{
  const ready=await input.question('Have you closed ALL survey tabs? Type CLOSED to continue, or press Enter to cancel: ');
  if(ready.trim()!=='CLOSED'){console.log('Cancelled. Nothing deleted.');process.exit(0);}
  const folder=path.join(root,'backups',`before-empty-${new Date().toISOString().replaceAll(':','-')}`);
  await fs.mkdir(folder,{recursive:true});
  const backup=path.join(folder,'database-backup.sql');
  console.log('Creating the full SQL backup before deletion...');
  wrangler(['d1','export',database,'--remote','--output',backup]);
  if(!backupLooksComplete(await fs.readFile(backup,'utf8')))throw new Error('Backup validation failed. Nothing has been deleted.');
  await fs.writeFile(path.join(folder,'before.json'),JSON.stringify({database,uuid,counts:before},null,2));
  console.log(`Backup verified and saved: ${backup}`);
  const answer=await input.question(`To delete all test responses, type exactly ${confirmationText(database)}: `);
  if(!confirmed(answer,database)){console.log('Cancelled. Backup retained; nothing deleted.');process.exit(0);}
  wrangler(['d1','execute',database,'--remote','--file',path.join(backend,'reset-all-test-data.sql'),'--yes']);
  const after=parseCounts(wrangler(['d1','execute',database,'--remote','--command',query,'--json'],true));
  await fs.writeFile(path.join(folder,'after.json'),JSON.stringify(after,null,2));
  if(after.remaining_states!==0||after.remaining_history!==0)throw new Error('Database is not empty. A survey tab may still be writing. Close all tabs and inspect the counts.');
  if(!Number.isSafeInteger(after.generation)||after.generation<=before.generation)throw new Error('The reset marker did not advance. Stop and check the reset protection schema.');
  console.log('SUCCESS: database responses and history are empty (0 / 0).');
  console.log('Reset protection advanced. Updated survey pages refetch the server and discard stale active progress.');
  console.log('Optional: use reset-local.html on each browser to download and remove isolated local recovery copies.');
  console.log('Older survey pages cannot save until reloaded. Do not import old test backups into the new collection.');
  console.log(`Full backup remains at: ${backup}`);
}finally{input.close();}

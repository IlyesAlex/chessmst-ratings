// Manual admin utility. No flag can bypass the typed deletion confirmations.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {confirmationText,confirmed,backupLooksComplete,parseCounts} from './empty-database-core.js';
import {authenticationError,createWrangler,loginCommand} from './wrangler.js';
import {checkProjectAccess,verifyIdentity,verifyProjectConfig,PROJECT_ACCOUNT} from './project-account.js';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function emptyDatabase({root=projectRoot,args=[],run,ask,log=console.log}={}){
  if(args.some(arg=>arg!=='--check'))throw new Error('Usage: EMPTY_DATABASE.cmd [--check]. --check only reads database counts.');
  const checkOnly=args.includes('--check'),backend=path.join(root,'backend');
  const config=await fs.readFile(path.join(backend,'wrangler.toml'),'utf8');
  const database=config.match(/^database_name\s*=\s*"([^"]+)"/m)?.[1];
  const uuid=config.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
  if(!database||!uuid||uuid.includes('REPLACE'))throw new Error('Configure database_name and database_id in backend/wrangler.toml first.');
  const wrangler=run||createWrangler({cwd:backend});
  const query='SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states, (SELECT COUNT(*) FROM response_history) AS remaining_history, (SELECT generation FROM collection_control WHERE id=1) AS generation;';
  const counts=()=>parseCounts(wrangler(['d1','execute',database,'--remote','--command',query,'--json'],true));
  log(`Database: ${database}\nDatabase UUID: ${uuid}`);
  log(checkOnly?'CHECK ONLY: no backup or deletion will run.':'This removes ALL responses, drafts and history from BOTH B and demo, including old dataset versions.');
  if(!checkOnly)log('Tables and the Worker remain. Close every survey tab on every device first.');
  let input;
  const question=ask||((prompt)=>{input??=createInterface({input:process.stdin,output:process.stdout});return input.question(prompt);});
  let deletionAttempted=false;
  try{
    const access=await checkProjectAccess({config,root,run:wrangler,ask:question,log,checkOnly,probe:counts});
    if(!access)return;
    const before=access.result;
    log('Current counts: '+JSON.stringify(before));
    if(checkOnly){log('CHECK PASSED: Cloudflare login, database access and reset marker are working. Nothing deleted.');return;}
    const ready=await question('Have you closed ALL survey tabs? Type CLOSED to continue, or press Enter to cancel: ');
    if(ready.trim()!=='CLOSED'){log('Cancelled. Nothing deleted.');return;}
    await fs.mkdir(path.join(root,'backups'),{recursive:true});
    const folder=await fs.mkdtemp(path.join(root,'backups',`before-empty-${new Date().toISOString().replaceAll(':','-')}-`));
    const backup=path.join(folder,'database-backup.sql');
    log('Creating the full SQL backup before deletion...');
    wrangler(['d1','export',database,'--remote','--output',backup]);
    if(!backupLooksComplete(await fs.readFile(backup,'utf8')))throw new Error('Backup validation failed. Nothing has been deleted.');
    await fs.writeFile(path.join(folder,'before.json'),JSON.stringify({database,uuid,identity:access.identity,counts:before},null,2));
    log(`Backup verified and saved: ${backup}`);
    const answer=await question(`To delete all test responses, type exactly ${confirmationText(database)}: `);
    if(!confirmed(answer,database)){log('Cancelled. Backup retained; nothing deleted.');return;}
    log('Rechecking sign-in and database target before deletion...');
    verifyProjectConfig(await fs.readFile(path.join(backend,'wrangler.toml'),'utf8'));
    verifyIdentity(wrangler(['whoami','--json'],true));
    deletionAttempted=true;
    wrangler(['d1','execute',database,'--remote','--file',path.join(backend,'reset-all-test-data.sql'),'--yes']);
    const after=counts();
    await fs.writeFile(path.join(folder,'after.json'),JSON.stringify(after,null,2));
    if(after.remaining_states!==0||after.remaining_history!==0)throw new Error('Database is not empty. A survey tab may still be writing. Close all tabs and inspect the counts.');
    if(after.generation<=before.generation)throw new Error('The reset marker did not advance. Stop and check the reset protection schema.');
    log('SUCCESS: database responses and history are empty (0 / 0).');
    log('Reset protection advanced. Updated survey pages refetch the server and discard stale active progress.');
    log('Optional: use reset-local.html on each browser to download and remove isolated local recovery copies.');
    log('Older survey pages cannot save until reloaded. Do not import old test backups into the new collection.');
    log(`Full backup remains at: ${backup}`);
  }catch(error){
    if(deletionAttempted)log('The reset command was attempted. Its outcome is not verified. Preserve the backup and run EMPTY_DATABASE.cmd --check before retrying.');
    else log('Stopped before deletion. Nothing was deleted by this script.');
    throw error;
  }finally{input?.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  emptyDatabase({args:process.argv.slice(2)}).catch(error=>{
    console.error('\nERROR: '+error.message);
    if(error.code==='account_sign_in'||authenticationError(error))console.error(`\nFrom the project folder, run: ${loginCommand}\nSign in as ${PROJECT_ACCOUNT.email}, then run EMPTY_DATABASE.cmd --check.`);
    process.exitCode=1;
  });
}

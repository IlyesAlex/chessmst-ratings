// Verified new-account backup, then local SQL/CSV/XLSX processing of that snapshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {createWrangler} from './wrangler.js';
import {checkProjectAccess,PROJECT_ACCOUNT,readResetMarker} from './project-account.js';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function exportOptions(args){
  let checkOnly=false;
  const filters=[];
  for(let i=0;i<args.length;i++){
    if(args[i]==='--check')checkOnly=true;
    else if(args[i]==='--submitted-only')filters.push(args[i]);
    else if(args[i]==='--set'&&['B','demo','all'].includes(args[i+1]))filters.push(args[i],args[++i]);
    else throw new Error('Usage: EXPORT_DATA.cmd [--check] [--set B|demo|all] [--submitted-only]. This launcher is locked to the migrated project account/database; account/config overrides are not accepted.');
  }
  return {checkOnly,filters};
}
function child(args,root){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)throw new Error(`Local export processing failed${result.error?': '+result.error.message:''}. The SQL backup is retained; the database was not changed.`);
}
async function spreadsheetRuntime(root){
  const runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  try{await fs.access(path.join(runtime,'@oai/artifact-tool'));}catch{throw new Error('The bundled Codex spreadsheet runtime is missing. Use this computer with Codex workspace dependencies installed.');}
  const link=path.join(root,'tools/node_modules');
  try{await fs.access(path.join(link,'@oai/artifact-tool'));}catch{await fs.symlink(runtime,link,process.platform==='win32'?'junction':'dir');}
}
export async function exportAll({root=projectRoot,args=[],run,runNode,ask,log=console.log}={}){
  const {checkOnly,filters}=exportOptions(args),backend=path.join(root,'backend');
  const config=await fs.readFile(path.join(backend,'wrangler.toml'),'utf8');
  const wrangler=run||createWrangler({cwd:backend});
  let input;
  const question=ask||((prompt)=>{input??=createInterface({input:process.stdin,output:process.stdout});return input.question(prompt);});
  try{
    const access=await checkProjectAccess({config,root,run:wrangler,ask:question,log,checkOnly,
      probe:()=>readResetMarker(wrangler(['d1','execute',PROJECT_ACCOUNT.databaseName,'--remote','--command','SELECT generation FROM collection_control WHERE id=1;','--json'],true))});
    if(!access)return;
    if(checkOnly){log('CHECK PASSED: correct email, account and migrated database. No export created; nothing deleted.');return {checkOnly:true,identity:access.identity};}
    if(!runNode)await spreadsheetRuntime(root);
    await fs.mkdir(path.join(root,'export'),{recursive:true});
    const out=path.join(root,'export',new Date().toISOString().replaceAll(':','-'));
    await fs.mkdir(out); // Fail rather than overwrite an existing export directory.
    await fs.writeFile(path.join(out,'account-check.json'),JSON.stringify({verifiedAt:new Date().toISOString(),...access.identity,databaseName:PROJECT_ACCOUNT.databaseName,databaseId:PROJECT_ACCOUNT.databaseId},null,2));
    const backup=path.join(out,'database-backup.sql');
    log('1/2: Creating full SQL database backup. Keep the survey paused during export.');
    wrangler(['d1','export',PROJECT_ACCOUNT.databaseName,'--remote','--output',backup]);
    await fs.access(backup);
    log('2/2: Processing the SQL backup locally (no additional response query against D1).');
    await (runNode||((nodeArgs)=>child(nodeArgs,root)))([path.join(root,'tools/export-results.mjs'),'--output-dir',out,'--from-backup',backup,...filters]);
    log(`DONE. Files saved in: ${out}`);
    return {folder:out,identity:access.identity};
  }finally{input?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  exportAll({args:process.argv.slice(2)}).catch(error=>{console.error('\nEXPORT FAILED: '+error.message+'\nNo database records were deleted.');process.exitCode=1;});
}

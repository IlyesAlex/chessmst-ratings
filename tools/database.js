// Administrative read/export/reset preparation. This tool NEVER executes a DELETE.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {API_URL} from '../docs/config.js';
import {databaseStudyId} from '../docs/sets.js';
import {emptyState,exportRows} from '../docs/core.js';
import {inspectState,resetSql} from './database-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [command,...args]=process.argv.slice(2);
const at=args.indexOf('--set'),selected=at>=0?args[at+1]:'all';
if(!['inspect','export','prepare-reset'].includes(command)||!['B','demo','all'].includes(selected)){
  console.log('Usage: node tools/database.js inspect|export|prepare-reset [--set B|demo|all] [--all-data]');
  process.exit(1);
}
if(!API_URL)throw new Error('Set API_URL in docs/config.js first.');
const config=await fs.readFile(path.join(root,'backend/wrangler.toml'),'utf8');
const prefix=config.match(/^STUDY_ID\s*=\s*"([^"]+)"/m)?.[1];
if(!prefix)throw new Error('Cannot read STUDY_ID from backend/wrangler.toml');
const directory=path.join(root,'backups',new Date().toISOString().replaceAll(':','-'));
const reports=[],ids=[];
for(const name of selected==='all'?['B','demo']:[selected]){
  const study=JSON.parse(await fs.readFile(path.join(root,`docs/data/study_${name}.json`),'utf8'));
  const response=await fetch(`${API_URL.replace(/\/$/,'')}/state?set=${name}`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${name}: API HTTP ${response.status}`);
  const envelope=await response.json(),report=inspectState(study,envelope);reports.push(report);
  console.log(JSON.stringify(report,null,2));
  if(!report.valid)process.exitCode=2;
  ids.push(databaseStudyId(prefix,study));
  if(command!=='inspect'){
    await fs.mkdir(directory,{recursive:true});
    await fs.writeFile(path.join(directory,`${name}-api-state.json`),JSON.stringify(envelope,null,2));
    await fs.writeFile(path.join(directory,`${name}-backup.json`),JSON.stringify({format:'chessmst-backup-v1',state:envelope.state||emptyState(study)},null,2));
    const rows=exportRows(study,envelope.state||emptyState(study)),fields=Object.keys(rows[0]);
    const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
    await fs.writeFile(path.join(directory,`${name}-responses.csv`),'\uFEFF'+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(row=>row.map(quote).join(',')).join('\r\n'));
  }
}
if(command!=='inspect'){
  await fs.writeFile(path.join(directory,'inspection.json'),JSON.stringify(reports,null,2));
  console.log(`Backups saved: ${directory}`);
}
if(command==='prepare-reset'){
  const allData=args.includes('--all-data');
  const file=path.join(directory,'reset.sql');
  await fs.writeFile(file,resetSql(ids,{allData}));
  console.log(allData?'Scope: ALL database states and ALL response history, including older versions.':`Scope: current configured collection and selected dataset versions: ${ids.join(', ')}`);
  console.log('No data has been deleted. First create a full SQL backup using Wrangler d1 export.');
  console.log(`Review the SQL file: ${file}`);
  console.log('Close all survey tabs on every device before running it; then clear local survey saves.');
}

// Full database backup, followed by latest-response SQL/CSV/XLSX in ONE dated folder.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(args,options={}){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',...options});if(r.status!==0)throw new Error(`Command failed (${r.status}). The database was not erased.`);}
const npx=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npx-cli.js');
const runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
try{await fs.access(path.join(runtime,'@oai/artifact-tool'));}catch{throw new Error('The bundled Codex spreadsheet runtime is missing. Run this on the computer where the project was created, with Codex workspace dependencies installed.');}
const link=path.join(root,'tools/node_modules');
try{await fs.access(path.join(link,'@oai/artifact-tool'));}catch{await fs.symlink(runtime,link,process.platform==='win32'?'junction':'dir');}
const config=await fs.readFile(path.join(root,'backend/wrangler.toml'),'utf8');
const db=config.match(/^database_name\s*=\s*"([^"]+)"/m)?.[1];if(!db)throw new Error('Missing database_name in backend/wrangler.toml');
const out=path.join(root,'export',new Date().toISOString().replaceAll(':','-'));await fs.mkdir(out,{recursive:true});
console.log('1/2: Creating full SQL database backup. Keep the survey paused during export.');
run([npx,'--yes','--prefer-online','wrangler@4.150.0','d1','export',db,'--remote','--output',path.join(out,'database-backup.sql')],{cwd:path.join(root,'backend')});
console.log('2/2: Reading latest responses and preparing SQL, CSV and Excel.');
run([path.join(root,'tools/export-results.mjs'),'--output-dir',out,...process.argv.slice(2)]);
console.log(`DONE. Files saved in: ${out}`);

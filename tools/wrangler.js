import path from 'node:path';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

export const WRANGLER_VERSION='4.150.0';
export const loginCommand=`npx.cmd --yes --prefer-online wrangler@${WRANGLER_VERSION} login`;
export function authenticationError(error){
  return /7403|10000|9109|unauthenticated|not authenticated|not logged in|authentication (?:error|failed)|authorization (?:error|failed)|not authorized|invalid (?:access |oauth )?token|token (?:has )?expired|CLOUDFLARE_API_TOKEN/i.test(error.message);
}
export function createWrangler({cwd,node=process.execPath,env=process.env,spawn=spawnSync,exists=existsSync}={}){
  // Invoke npm through Node: Windows .cmd launchers cannot be spawned directly.
  const npx=path.join(path.dirname(node),'node_modules/npm/bin/npx-cli.js');
  return (args,capture=false)=>{
    if(!exists(npx))throw new Error('The npm launcher was not found beside Node.js. Repair/reinstall Node.js LTS with npm included, then reopen EMPTY_DATABASE.cmd.');
    const result=spawn(node,[npx,'--yes','--prefer-online',`wrangler@${WRANGLER_VERSION}`,...args],{
      cwd,encoding:'utf8',env:{...env},maxBuffer:16*1024*1024,
      // Keep Wrangler from consuming confirmations belonging to the parent script.
      stdio:capture?['ignore','pipe','pipe']:['ignore','inherit','inherit']
    });
    if(result.error||result.status!==0){
      const detail=[result.error?.message,result.stderr,result.stdout].filter(Boolean).join('\n').trim();
      throw new Error(`Wrangler ${args.slice(0,2).join(' ')} failed${result.status===null?'':` (exit ${result.status})`}.${detail?'\n'+detail:''}`);
    }
    return result.stdout||'';
  };
}

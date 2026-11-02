import {authenticationError,AUTH_PROFILE,loginCommand} from './wrangler.js';

export const PROJECT_ACCOUNT=Object.freeze({email:'alexitoo96@gmail.com',accountId:'eba3e44ef375d3d66b901acf3297244a',databaseId:'fa58000e-f5ec-4541-b30e-d22039056dbd',databaseName:'chessmst-ratings',profile:AUTH_PROFILE});

export function verifyProjectConfig(config){
  const value=name=>config.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`,'m'))?.[1];
  if(value('account_id')!==PROJECT_ACCOUNT.accountId||value('database_id')!==PROJECT_ACCOUNT.databaseId||value('database_name')!==PROJECT_ACCOUNT.databaseName){
    throw new Error('Configuration does not match the migrated ChessMST database. Check account_id, database_id and database_name in backend/wrangler.toml. No database command was run.');
  }
  return PROJECT_ACCOUNT;
}

export function verifyIdentity(output){
  const fail=message=>{const error=new Error(message);error.code='account_sign_in';throw error;};
  let identity;try{identity=JSON.parse(output);}catch{fail('Cannot verify Cloudflare identity: whoami did not return valid JSON.');}
  if(identity?.loggedIn!==true)fail('Not authenticated with Cloudflare.');
  const email=String(identity.email||'').trim().toLowerCase();
  if(email!==PROJECT_ACCOUNT.email)fail(`Wrong or unverifiable Cloudflare sign-in: ${email||'email unavailable'}. Required: ${PROJECT_ACCOUNT.email}.`);
  if(!Array.isArray(identity.accounts)||!identity.accounts.some(account=>account.id===PROJECT_ACCOUNT.accountId))fail(`The ${PROJECT_ACCOUNT.email} login cannot access the configured ChessMST account.`);
  return {email,accountId:PROJECT_ACCOUNT.accountId,profile:AUTH_PROFILE};
}

export function readResetMarker(stdout){
  const row=JSON.parse(stdout).flatMap(result=>result.results||[])[0];
  if(!Number.isSafeInteger(row?.generation)||row.generation<0)throw new Error('Cannot verify the database reset marker. Check the database schema.');
  return row;
}

export async function checkProjectAccess({config,root,run,ask,log=console.log,checkOnly=false,probe}){
  verifyProjectConfig(config);
  log(`Required sign-in: ${PROJECT_ACCOUNT.email} | Project profile: ${AUTH_PROFILE}`);
  const attempt=async()=>{
    const identity=verifyIdentity(run(['whoami','--json'],true));
    log(`Sign-in verified: ${identity.email} | Account: ${identity.accountId}`);
    return {identity,result:await probe()};
  };
  try{return await attempt();}
  catch(error){
    if(error.code!=='account_sign_in'&&!authenticationError(error))throw error;
    const recovery=`${loginCommand}\nnpx.cmd --yes --prefer-online wrangler@4.150.0 auth activate ${AUTH_PROFILE} "${root}"`;
    log(error.message);
    log(`Sign in as ${PROJECT_ACCOUNT.email}. A CLOUDFLARE_API_TOKEN can override the named OAuth login.`);
    if(checkOnly)throw new Error(`Sign-in check failed. No database changes were made.\nFrom the project folder, run:\n${recovery}\nThen repeat --check.`);
    const answer=await ask(`Type LOGIN to sign in as ${PROJECT_ACCOUNT.email}, or press Enter to cancel: `);
    if(answer.trim()!=='LOGIN'){log('Cancelled. No database changes were made.');return null;}
    run(['auth','create',AUTH_PROFILE]);
    run(['auth','activate',AUTH_PROFILE,root]);
    // Never trust a successful browser callback without verifying the email again.
    try{return await attempt();}catch(retryError){throw new Error(`${retryError.message}\nSign-in/access still failed; stopped without continuing.\n${recovery}`);}
  }
}

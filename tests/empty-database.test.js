import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmed,backupLooksComplete,parseCounts} from '../tools/empty-database-core.js';
import fs from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {emptyDatabase} from '../tools/empty-database.mjs';
import {authenticationError,createWrangler} from '../tools/wrangler.js';
test('Database cleanup requires the exact named target and complete backup',()=>{
  assert.equal(confirmed('EMPTY chessmst-ratings','chessmst-ratings'),true);
  for(const input of ['','yes','EMPTY','EMPTY another-database'])assert.equal(confirmed(input,'chessmst-ratings'),false);
  assert.equal(backupLooksComplete(''),false);assert.equal(backupLooksComplete('CREATE TABLE study_state;'),false);
  assert.equal(backupLooksComplete('CREATE TABLE study_state; CREATE TABLE response_history;'),true);
});
test('Cleanup verifies both response state and history counts',()=>{
  assert.deepEqual(parseCounts('[{"results":[{"remaining_states":0,"remaining_history":0,"generation":3}]}]'),{remaining_states:0,remaining_history:0,generation:3});
  assert.throws(()=>parseCounts('[{"results":[]}]'));
  assert.throws(()=>parseCounts('[{"results":[{"remaining_states":0,"remaining_history":0}]}]'),/reset marker/);
});

async function fixture(t,{answers=[],authFailure=false,badBackup=false,resetFailure=false,advance=true}={}){
  const temp=path.resolve(os.tmpdir()),root=await fs.mkdtemp(path.join(temp,'chessmst-empty-test-'));
  t.after(async()=>{assert.equal(path.dirname(root),temp);await fs.rm(root,{recursive:true,force:true});});
  await fs.mkdir(path.join(root,'backend'));
  await fs.writeFile(path.join(root,'backend/wrangler.toml'),'database_name = "chessmst-ratings"\ndatabase_id = "test-database"\n');
  const calls=[],messages=[];let reset=false,authFailed=false;
  const run=(args)=>{
    calls.push(args);
    if(args[0]==='whoami')return 'Logged in with an OAuth Token';
    if(args[0]==='login')return '';
    if(args.includes('--json')){
      if(authFailure&&!authFailed){authFailed=true;throw new Error('not authorized to access this service [code: 7403]');}
      return JSON.stringify([{results:[{remaining_states:reset?0:2,remaining_history:reset?0:10,generation:reset&&advance?3:2}]}]);
    }
    if(args[1]==='export'){
      writeFileSync(args[args.indexOf('--output')+1],badBackup?'incomplete':'CREATE TABLE study_state; CREATE TABLE response_history; CREATE TABLE collection_control;');return '';
    }
    if(args.includes('--file')){if(resetFailure)throw new Error('Network failed after reset request');reset=true;return '';}
    throw new Error('Unexpected command: '+args.join(' '));
  };
  const ask=async()=>{assert.ok(answers.length,'Unexpected confirmation');return answers.shift();};
  return {root,calls,messages,run,ask,log:message=>messages.push(message)};
}

test('Check mode never prompts, exports or deletes, and rejects unknown flags',async t=>{
  const f=await fixture(t);await emptyDatabase({...f,args:['--check']});
  assert.equal(f.calls.length,2);assert.equal(f.calls[0][0],'whoami');assert.ok(f.calls[1].includes('--json'));
  assert.ok(f.messages.some(m=>m.includes('CHECK PASSED')));
  await assert.rejects(emptyDatabase({...f,args:['--yes']}),/Usage:/);
});
test('Cancellation, wrong target and incomplete backup all prevent the reset command',async t=>{
  for(const options of [{answers:['']},{answers:['CLOSED','EMPTY other']},{answers:['CLOSED'],badBackup:true}]){
    const f=await fixture(t,options);
    if(options.badBackup)await assert.rejects(emptyDatabase(f),/Backup validation failed/);else await emptyDatabase(f);
    assert.equal(f.calls.some(args=>args.includes('--file')),false);
  }
});
test('Authentication failure offers login before any deletion confirmations',async t=>{
  const f=await fixture(t,{authFailure:true,answers:['LOGIN','']});
  await emptyDatabase(f);assert.ok(f.calls.some(args=>args[0]==='login'));assert.equal(f.calls.some(args=>args.includes('--file')),false);
  const check=await fixture(t,{authFailure:true});
  await assert.rejects(emptyDatabase({...check,args:['--check']}),/login/);
  assert.equal(check.calls.some(args=>args[0]==='login'),false);
});
test('A confirmed reset runs only after backup and verifies counts and advanced generation',async t=>{
  const f=await fixture(t,{answers:['CLOSED','EMPTY chessmst-ratings']});await emptyDatabase(f);
  assert.deepEqual(f.calls.map(args=>args[0]==='whoami'?'whoami':args.includes('--json')?'counts':args[1]),['whoami','counts','export','execute','counts']);
  assert.ok(f.messages.some(m=>m.startsWith('SUCCESS:')));
  const stale=await fixture(t,{answers:['CLOSED','EMPTY chessmst-ratings'],advance:false});
  await assert.rejects(emptyDatabase(stale),/marker did not advance/);
  assert.equal(stale.messages.some(m=>m.startsWith('SUCCESS:')),false);
});
test('A failed reset is never automatically retried and reports an unverified outcome',async t=>{
  const f=await fixture(t,{answers:['CLOSED','EMPTY chessmst-ratings'],resetFailure:true});
  await assert.rejects(emptyDatabase(f),/Network failed/);
  assert.equal(f.calls.filter(args=>args.includes('--file')).length,1);
  assert.ok(f.messages.some(m=>m.includes('outcome is not verified')));
});
test('Wrangler launcher preserves SQL arguments and reports auth and spawn failures',()=>{
  let invocation;
  const runner=createWrangler({cwd:'backend',node:process.execPath,env:{EXAMPLE:'value'},exists:()=>true,spawn:(...args)=>{invocation=args;return {status:0,stdout:'[]'};}});
  assert.equal(runner(['d1','execute','db','--command','SELECT 1;'],true),'[]');
  assert.ok(invocation[1].includes('SELECT 1;'));assert.deepEqual(invocation[2].stdio,['ignore','pipe','pipe']);assert.equal(invocation[2].env.CI,undefined);
  assert.equal(authenticationError(new Error('API error code: 7403')),true);assert.equal(authenticationError(new Error('SQL syntax error')),false);
  const failed=createWrangler({exists:()=>true,spawn:()=>({status:1,stderr:'npm error',stdout:'details'})});
  assert.throws(()=>failed(['whoami'],true),/npm error\ndetails/);
  assert.throws(()=>createWrangler({exists:()=>false})(['whoami']),/npm launcher/);
});

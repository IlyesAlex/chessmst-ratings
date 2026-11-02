import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {PROJECT_ACCOUNT as expected,verifyIdentity,verifyProjectConfig,checkProjectAccess} from '../tools/project-account.js';
import {exportAll,exportOptions} from '../tools/export-all.mjs';

const config=`account_id = "${expected.accountId}"\ndatabase_name = "${expected.databaseName}"\ndatabase_id = "${expected.databaseId}"\n`;
const identity=(email=expected.email,account=expected.accountId)=>JSON.stringify({loggedIn:true,email,accounts:[{id:account}]});

test('Identity check requires the exact migrated email and account, not simply a valid login',()=>{
  assert.equal(verifyIdentity(identity(' ALEXITOO96@GMAIL.COM ')).email,expected.email);
  for(const raw of [identity('hcccl.lab@gmail.com'),identity(expected.email,'old-account'),identity(''),JSON.stringify({loggedIn:false}),'{broken'])assert.throws(()=>verifyIdentity(raw));
  assert.equal(verifyProjectConfig(config),expected);
  assert.throws(()=>verifyProjectConfig(config.replace(expected.databaseId,'old-database')),/Configuration/);
  assert.throws(()=>verifyProjectConfig(config.replace(expected.accountId,'old-account')),/Configuration/);
});
test('Wrong login never reaches a database probe; recovery rechecks email after project-scoped sign-in',async()=>{
  const calls=[];let email='other@example.com',probes=0;
  const run=args=>{calls.push(args);if(args[0]==='whoami'){assert.ok(args.includes('--json'));return identity(email);}if(args[1]==='create')email=expected.email;return '';};
  const options={config,root:'C:\\Research Folder',run,log:()=>{},probe:()=>{probes++;return {generation:7};}};
  await assert.rejects(checkProjectAccess({...options,checkOnly:true,ask:()=>assert.fail('Check must never prompt')}),/Sign-in check failed/);
  assert.equal(probes,0);
  const access=await checkProjectAccess({...options,ask:async()=> 'LOGIN'});
  assert.equal(access.identity.email,expected.email);assert.equal(probes,1);
  assert.ok(calls.some(args=>args[0]==='auth'&&args[1]==='activate'&&args[2]==='chessmst-new'&&args[3]===options.root));
  assert.equal(calls.some(args=>args[0]==='login'),false);
  let unsafeProbes=0;
  await assert.rejects(checkProjectAccess({...options,run:args=>args[0]==='whoami'?identity('wrong@example.com'):'',ask:async()=> 'LOGIN',probe:()=>{unsafeProbes++;}}),/Wrong or unverifiable/);
  assert.equal(unsafeProbes,0);
});

async function fixture(t,{email=expected.email,account=expected.accountId,backupFailure=false}={}){
  const temp=path.resolve(os.tmpdir()),root=await fs.mkdtemp(path.join(temp,'chessmst-export-test-'));
  t.after(async()=>{assert.equal(path.dirname(root),temp);await fs.rm(root,{recursive:true,force:true});});
  await fs.mkdir(path.join(root,'backend'));
  await fs.writeFile(path.join(root,'backend/wrangler.toml'),config);
  const calls=[],processing=[],logs=[];
  const run=args=>{
    calls.push(args);
    if(args[0]==='whoami')return identity(email,account);
    if(args.includes('--json'))return JSON.stringify([{results:[{generation:7}]}]);
    if(args[1]==='export'){
      if(backupFailure)throw new Error('Backup download failed');
      writeFileSync(args[args.indexOf('--output')+1],'CREATE TABLE study_state(id TEXT);');return '';
    }
    throw new Error('Unexpected command');
  };
  const runNode=async args=>{processing.push(args);assert.ok(args.includes('--from-backup'));await fs.access(args[args.indexOf('--from-backup')+1]);};
  return {root,run,runNode,calls,processing,logs,log:message=>logs.push(message),ask:async()=> ''};
}
test('Exporter check mode verifies sign-in/database without creating export folders or requiring spreadsheet runtime',async t=>{
  const f=await fixture(t);await exportAll({...f,args:['--check']});
  assert.equal(f.calls.length,2);assert.equal(f.calls[1][1],'execute');assert.equal(f.processing.length,0);
  await assert.rejects(fs.access(path.join(f.root,'export')));
});
test('Wrong exporter identity or database config stops before any D1 command, backup or processing',async t=>{
  for(const options of [{email:'hcccl.lab@gmail.com'},{account:'old-account'}]){
    const f=await fixture(t,options);await assert.rejects(exportAll({...f,args:['--check']}),/Sign-in check failed/);
    assert.equal(f.calls.length,1);assert.equal(f.processing.length,0);
  }
  const f=await fixture(t);await fs.writeFile(path.join(f.root,'backend/wrangler.toml'),config.replace(expected.databaseId,'old-db'));
  await assert.rejects(exportAll(f),/Configuration/);assert.equal(f.calls.length,0);
});
test('Export downloads from migrated DB once and processes that backup locally; backup failures stop processing',async t=>{
  const f=await fixture(t),result=await exportAll({...f,args:['--set','B','--submitted-only']});
  assert.equal(f.calls.length,3);assert.equal(f.calls[2][1],'export');assert.equal(f.calls[2][2],expected.databaseName);
  assert.equal(f.processing.length,1);assert.ok(f.processing[0].includes('--submitted-only'));
  const record=JSON.parse(await fs.readFile(path.join(result.folder,'account-check.json'),'utf8'));
  assert.equal(record.email,expected.email);assert.equal(record.databaseId,expected.databaseId);
  const failed=await fixture(t,{backupFailure:true});
  await assert.rejects(exportAll(failed),/Backup download failed/);assert.equal(failed.processing.length,0);
});
test('Normal export launcher cannot override the new account or accidentally select the source database',()=>{
  assert.throws(()=>exportOptions(['--profile','chessmst-source']),/locked/);
  assert.throws(()=>exportOptions(['--config','old-config.toml']),/locked/);
  assert.throws(()=>exportOptions(['--set','unknown']),/Usage/);
});

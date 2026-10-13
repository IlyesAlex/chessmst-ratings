import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import study from '../docs/data/study_B.json' with {type:'json'};
import demo from '../docs/data/study_demo.json' with {type:'json'};
import {emptyState} from '../docs/core.js';
function environment() {
  const rows=new Map();
  return {STUDY_ID:'test',ALLOWED_ORIGINS:'https://example.github.io',DB:{prepare(sql){return{bind(...params){return {
    async first(){return rows.get(params[0])||null;},
    async run(){
      const [id,version,json,mutation,time,base]=params;
      const row=rows.get(id);
      if(row&&row.revision!==base)return {meta:{changes:0}};
      rows.set(id,{revision:(row?.revision||0)+1,state_json:json,last_mutation_id:mutation});
      return {meta:{changes:1}};
    }
  };}};}}};
}
const req=(method,body,origin='https://example.github.io',set='B')=>new Request(`https://api.example/state?set=${set}`,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('Database API saves and restores exact drafts with optimistic revision control',async()=>{
  const env=environment();let r=await worker.fetch(req('GET'),env);assert.deepEqual(await r.json(),{revision:0,state:null,lastMutationId:null});
  const state=emptyState(study),body={state,baseRevision:0,mutationId:'mutation-1'};
  r=await worker.fetch(req('PUT',body),env);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
  r=await worker.fetch(req('PUT',body),env);assert.equal(r.status,200);assert.equal((await r.json()).revision,1);
  r=await worker.fetch(req('PUT',{...body,mutationId:'stale-device'}),env);assert.equal(r.status,409);
  r=await worker.fetch(req('GET'),env);assert.deepEqual((await r.json()).state,state);
  r=await worker.fetch(req('PUT',{...body,baseRevision:1,mutationId:'mutation-2'}),env);assert.equal((await r.json()).revision,2);
});
test('API rejects foreign origins and malformed data and handles preflight',async()=>{
  const env=environment();assert.equal((await worker.fetch(req('GET',null,'https://other.example'),env)).status,403);
  const r=await worker.fetch(req('OPTIONS'),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://example.github.io');
  assert.equal((await worker.fetch(req('PUT',{baseRevision:0,mutationId:'abc',state:{}}),env)).status,400);
  assert.equal((await worker.fetch(new Request('https://api.example/state',{method:'PUT',body:'{oops'}),env)).status,400);
  assert.equal((await worker.fetch(new Request('https://api.example/wrong'),env)).status,404);
});
test('B and demo cloud states stay independent and cross-set payloads are rejected',async()=>{
  const env=environment(),b=emptyState(study),d=emptyState(demo);b.cursor=7;d.cursor=4;
  assert.equal((await worker.fetch(req('PUT',{state:b,baseRevision:0,mutationId:'b'}),env)).status,200);
  assert.equal((await worker.fetch(req('PUT',{state:d,baseRevision:0,mutationId:'d'},undefined,'demo'),env)).status,200);
  assert.deepEqual((await (await worker.fetch(req('GET'),env)).json()).state,b);
  assert.deepEqual((await (await worker.fetch(req('GET',null,undefined,'demo'),env)).json()).state,d);
  assert.equal((await worker.fetch(req('PUT',{state:b,baseRevision:1,mutationId:'bad'},undefined,'demo'),env)).status,400);
  assert.equal((await worker.fetch(req('GET',null,undefined,'missing'),env)).status,400);
});
test('Mixed-case configured hostnames match canonical browser origins',async()=>{
  const env=environment();env.ALLOWED_ORIGINS='https://IlyesAlex.github.io,http://localhost:8000';
  for(const method of ['GET','OPTIONS']){
    const response=await worker.fetch(req(method,null,'https://ilyesalex.github.io'),env);
    assert.equal(response.status,method==='OPTIONS'?204:200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://ilyesalex.github.io');
  }
  assert.equal((await worker.fetch(req('GET',null,'https://other.github.io'),env)).status,403);
});

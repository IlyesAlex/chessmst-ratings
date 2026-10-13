import studyB from '../docs/data/study_B.json' with {type:'json'};
import studyDemo from '../docs/data/study_demo.json' with {type:'json'};
import {validateState} from '../docs/core.js';
import {selectSet,databaseStudyId} from '../docs/sets.js';
const studies={B:studyB,demo:studyDemo};

// Check generation AND revision inside the write itself, including the insert path.
// A reset between the initial read and this statement cannot resurrect old answers.
export const SAVE_SQL = `INSERT INTO study_state (id,study_version,revision,state_json,last_mutation_id,updated_at)
  SELECT ?, ?, 1, ?, ?, ?
  WHERE (SELECT generation FROM collection_control WHERE id=1)=?
    AND (?=0 OR EXISTS(SELECT 1 FROM study_state WHERE id=? AND revision=?))
  ON CONFLICT(id) DO UPDATE SET revision=revision+1,state_json=excluded.state_json,
    last_mutation_id=excluded.last_mutation_id,updated_at=excluded.updated_at
  WHERE study_state.revision=? AND study_state.study_version=excluded.study_version`;

export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    // Browsers send canonical origins (including lowercase hostnames).
    // Canonicalise configuration too, so mixed-case GitHub usernames work.
    const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>{
      try{return new URL(x.trim()).origin;}catch{return null;}
    });
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if(origin&&allowed.includes(origin)) {
      headers['Access-Control-Allow-Origin']=origin;
      headers['Access-Control-Allow-Methods']='GET,PUT,OPTIONS';
      headers['Access-Control-Allow-Headers']='Content-Type';
    }else if(origin)return Response.json({error:'Origin not allowed'},{status:403,headers});
    const reply=(body,status=200)=>Response.json(body,{status,headers});
    if(new URL(request.url).pathname!=='/state')return reply({error:'Not found'},404);
    let selected;try{selected=selectSet(new URL(request.url).search);}catch{return reply({error:'Unknown stimulus set; use B or demo'},400);}
    const study=studies[selected],studyId=databaseStudyId(env.STUDY_ID,study);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    try {
      if(request.method==='GET') {
        const row=await env.DB.prepare('SELECT c.generation,s.revision,s.state_json,s.last_mutation_id FROM collection_control AS c LEFT JOIN study_state AS s ON s.id=? WHERE c.id=1').bind(studyId).first();
        if(!row)return reply({error:'Reset protection schema is missing'},503);
        return reply({generation:row.generation,revision:row.revision??0,state:row.state_json?JSON.parse(row.state_json):null,lastMutationId:row.last_mutation_id??null});
      }
      if(request.method==='PUT') {
        // Bounded streaming read: Content-Length may be absent or misleading.
        const reader=request.body?.getReader();if(!reader)return reply({error:'Missing body'},400);
        let size=0;const chunks=[];
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();return reply({error:'Payload too large'},413);}chunks.push(value);}
        const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
        let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Invalid JSON'},400);}
        if(!Number.isSafeInteger(body.generation)||body.generation<0)return reply({error:'Reload the updated survey before saving',code:'reload_required'},428);
        if(!Number.isInteger(body.baseRevision)||body.baseRevision<0||typeof body.mutationId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(body.mutationId)||!validateState(study,body.state))return reply({error:'Invalid study state'},400);
        const control=await env.DB.prepare('SELECT generation FROM collection_control WHERE id=1').first();
        if(!control||control.generation!==body.generation)return reply({error:'Database was reset; fetch the current state',code:'database_reset'},409);
        const existing=await env.DB.prepare('SELECT revision,last_mutation_id FROM study_state WHERE id = ?').bind(studyId).first();
        if(existing?.last_mutation_id===body.mutationId)return reply({revision:existing.revision});
        if((existing?.revision||0)!==body.baseRevision)return reply({error:'Revision conflict'},409);
        const json=JSON.stringify(body.state);
        const result=await env.DB.prepare(SAVE_SQL)
          .bind(studyId,study.studyVersion,json,body.mutationId,new Date().toISOString(),body.generation,body.baseRevision,studyId,body.baseRevision,body.baseRevision).run();
        if(result.meta.changes===0){
          const current=await env.DB.prepare('SELECT generation FROM collection_control WHERE id=1').first();
          return reply(current?.generation!==body.generation?{error:'Database was reset; fetch the current state',code:'database_reset'}:{error:'Revision conflict'},409);
        }
        return reply({revision:body.baseRevision+1});
      }
      return reply({error:'Method not allowed'},405);
    }catch {return reply({error:'Database operation failed'},500);}
  }
};

import {API_URL,STIMULUS_SET} from './config.js';
import {SETS,selectSet} from './sets.js';
import {parseFen,recordKey,validAnswer,clickPair,toPairs,emptyState,validateState,completedCount,firstIncomplete,exportRows} from './core.js';
import {pieceSvg} from './pieces.js?v=reference-art-1';
import {elapsed} from './timing.js';
const $ = id => document.getElementById(id);
const colors = ['#b64a27','#315cbb','#873fb0','#197663','#b07110','#b43875'];
const names = {p:'gyalog',n:'huszár',b:'futó',r:'bástya',q:'vezér',k:'király'};
let study, box, key, selectedSet, syncing=false, conflict=false, timer, storageFailed=false, ready=false;
let lock;
let timedKey=null,timingStarted=null;
function startTiming(){const c=current();timedKey=c.key;timingStarted=c.key&&!document.hidden?performance.now():null;}
function checkpointTiming(){
  if(!timedKey||timingStarted===null)return;
  const now=performance.now();
  const r=box.state.records[timedKey];
  if(r?.timingVersion===1)r.responseTimeMs=elapsed(r.responseTimeMs,timingStarted,now);
  timingStarted=now;
}
const preview = new URLSearchParams(location.search).get('preview')==='1';
const api = preview ? '' : API_URL.replace(/\/$/,'');
const error = message => { $('error').textContent=message; $('error').hidden=!message; };
function persist() {
  try { localStorage.setItem(key,JSON.stringify(box)); storageFailed=false; return true; }
  catch { storageFailed=true; error('A böngésző nem tudja menteni az adatokat. Tölts le JSON biztonsági másolatot a „Mentés és adatok” menüben.'); return false; }
}
function status(message) {
  $('save-status').textContent=message || (storageFailed?'Helyi mentés sikertelen.': conflict?'Eltérő szervermentés. Nyisd meg a „Mentés és adatok” menüt.':!api?'Ezen a böngészőn mentve. Adatbázis nincs csatlakoztatva.':box.dirty?'Ezen a böngészőn mentve. Adatbázis-szinkronizálásra vár.':'Adatbázisba mentve.');
  $('sync-detail').textContent=$('save-status').textContent;
  $('conflict-tools').hidden=!conflict;
}
function changed() {
  box.edits++; box.dirty=true; box.state.updatedAt=new Date().toISOString();
  const ok=persist(); status(); clearTimeout(timer); timer=setTimeout(sync,650); return ok;
}
function current() {
  const n=study.questions.length,i=box.state.cursor;
  const s=study.stimuli[Math.floor(i/n)],q=study.questions[i%n];
  return {s,q,key:s?recordKey(s,q):null};
}
function record() { const c=current(); return box.state.records[c.key]; }
function value() { return record()?.value ?? null; }
function setValue(v) {
  const c=current();
  const old=box.state.records[c.key],started=timingStarted;checkpointTiming();
  const ms=old?.timingVersion===1?old.responseTimeMs:(started===null?0:elapsed(0,started,performance.now()));
  box.state.records[c.key]={value:v,submitted:false,updatedAt:new Date().toISOString(),responseTimeMs:ms,timingVersion:1};
  timingStarted=document.hidden?null:performance.now();
  changed(); render();
}
function renderBoard(s,q) {
  const pieces=parseFen(s.position_fen), v=value(), pairs=q.mode==='pairs'?(v||[]):[];
  $('board').replaceChildren(); $('connections').replaceChildren();
  for (let r=8;r>=1;r--) for (let f=0;f<8;f++) {
    const square=`${'abcdefgh'[f]}${r}`,p=pieces[square];
    const button=document.createElement('button');
    button.className=`square ${(f+r)%2===1?'dark':''}`;
    button.dataset.square=square;
    button.disabled=q.mode==='scale';
    button.setAttribute('aria-label',`${square}${p?`, ${p===p.toUpperCase()?'világos':'sötét'} ${names[p.toLowerCase()]}`:', üres'}`);
    button.innerHTML=p?pieceSvg(p):'';
    const groups=pairs.map((pair,i)=>pair.includes(square)?i:-1).filter(i=>i>=0);
    const selected=q.mode==='squares'&&v?.includes(square);
    if (selected||groups.length) button.classList.add('selected');
    if(groups.length) {
      button.classList.add('paired'); button.style.setProperty('--pair-color',colors[groups.at(-1)%colors.length]);
      const badge=document.createElement('span'); badge.className='pair-badge'; badge.textContent=groups.map(i=>i+1).join(','); button.append(badge);
    }
    button.setAttribute('aria-pressed',String(Boolean(selected||groups.length)));
    button.onclick=()=>{
      if(q.mode==='pairs') setValue(toPairs(clickPair((value()||[]).flat(),square)));
      else {const old=value()||[]; setValue(old.includes(square)?old.filter(x=>x!==square):[...old,square]);}
      $('board').querySelector(`[data-square="${square}"]`).focus({preventScroll:true});
    };
    $('board').append(button);
  }
  pairs.forEach((pair,i)=>{
    if(pair.length!==2)return;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    pair.forEach((s,j)=>{line.setAttribute(`x${j+1}`,('abcdefgh'.indexOf(s[0])+.5)*100);line.setAttribute(`y${j+1}`,(8-Number(s[1])+.5)*100);});
    line.setAttribute('stroke',colors[i%colors.length]);$('connections').append(line);
  });
}
function render() {
  const total=study.stimuli.length*study.questions.length,done=completedCount(box.state);
  $('progress').max=total;$('progress').value=done;$('total-count').textContent=`${done} / ${total} válasz`;
  const c=current(),finished=!c.s;
  if(ready&&timedKey!==c.key)startTiming();
  $('survey').hidden=finished;$('complete').hidden=!finished;
  $('position-count').textContent=`${preview?'Előnézet · ':''}${SETS[selectedSet].label} · `+(finished?`${study.stimuli.length} állás kész`:`${Math.floor(box.state.cursor/study.questions.length)+1}. állás / ${study.stimuli.length}`);
  if(finished)return;
  const {s,q}=c,v=value();
  $('question-count').textContent=`${box.state.cursor%study.questions.length+1}. kérdés / ${study.questions.length}`;
  $('question').textContent=q.q_name;
  $('instruction').textContent=q.mode==='scale'?'Válassz egy értéket a skálán.':q.mode==='pairs'?'Kattints két mezőre egy konfliktus megjelöléséhez. Minden két egymást követő kattintás egy pár. Ha nincs konfliktus, válaszd a „Nincs ilyen” gombot.':'Kattints a megfelelő mezőkre. Újabb kattintással törölheted a jelölést. Ha nincs ilyen mező, válaszd a „Nincs ilyen” gombot.';
  $('board-hint').textContent=q.mode==='scale'?'A táblán nem kell lépni.':'Kattints a mezőkre.';
  $('answer').replaceChildren();$('selection-summary').replaceChildren();
  if(q.mode==='scale') {
    const scale=document.createElement('div');scale.className='scale';scale.setAttribute('role','radiogroup');scale.setAttribute('aria-label',q.q_name);
    for(let n=q.min;n<=q.max;n++) {
      const b=document.createElement('button');b.textContent=n;b.setAttribute('role','radio');b.setAttribute('aria-checked',String(v===n));b.onclick=()=>{setValue(n);$('answer').querySelectorAll('button')[n-q.min].focus();};
      b.onkeydown=e=>{if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();const delta=['ArrowRight','ArrowDown'].includes(e.key)?1:-1;const target=Math.max(q.min,Math.min(q.max,n+delta));setValue(target);$('answer').querySelectorAll('button')[target-q.min].focus();}};
      scale.append(b);
    }
    $('answer').append(scale);
    const labels=document.createElement('div');labels.className='scale-labels';
    labels.innerHTML=q.q_id==='ch_material'?'<span>−3 · Sötét előnye</span><span>0 · Egyenlő</span><span>+3 · Világos előnye</span>':'<span>1 · Egyáltalán nem</span><span>7 · Teljes mértékben</span>';
    $('answer').append(labels);
  } else {
    const tools=document.createElement('div');tools.className='selection-tools';
    const none=document.createElement('button');none.textContent='Nincs ilyen';none.className=Array.isArray(v)&&v.length===0?'none-selected':'';none.onclick=()=>setValue([]);tools.append(none);
    const undo=document.createElement('button');undo.textContent='Utolsó jelölés visszavonása';undo.disabled=!v?.length;undo.onclick=()=>setValue(q.mode==='pairs'?toPairs(v.flat().slice(0,-1)):v.slice(0,-1));tools.append(undo);
    const clear=document.createElement('button');clear.textContent='Jelölések törlése';clear.disabled=v===null;clear.onclick=()=>setValue(null);tools.append(clear);$('answer').append(tools);
    if(q.mode==='pairs'&&v?.length) v.forEach((pair,i)=>{
      const row=document.createElement('div');row.className='pair-row';
      const dot=document.createElement('span');dot.className='pair-dot';dot.style.background=colors[i%colors.length];row.append(dot);
      row.append(document.createTextNode(`${i+1}. pár: ${pair.join(' ↔ ')}${pair.length===1?' → válassz második mezőt':''}`));
      const del=document.createElement('button');del.textContent='Törlés';del.setAttribute('aria-label',`${i+1}. pár törlése`);del.onclick=()=>setValue(v.filter((_,j)=>j!==i));row.append(del);$('selection-summary').append(row);
    });
    else $('selection-summary').textContent=v===null?'Még nincs válasz.':v.length===0?'Nincs ilyen mező.':`Kijelölt mezők: ${v.join(', ')}`;
  }
  renderBoard(s,q);
  $('back').disabled=box.state.cursor===0;
  $('next').disabled=!validAnswer(q,v)||!ready;
  $('next').textContent=box.state.cursor===total-1?'Mentés és befejezés ✓':'Mentés és tovább →';
}
async function request(method,body) {
  const response=await fetch(`${api}/state?set=${encodeURIComponent(selectedSet)}`,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  if(response.status===409){conflict=true;status();throw new Error('conflict');}
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function checkRemote(remote) {
  if(remote.state&&!validateState(study,remote.state))throw new Error('A szerver másik vagy érvénytelen adatsort tartalmaz.');
}
async function sync() {
  if(!api||syncing||conflict||!ready)return;
  syncing=true;status('Szinkronizálás…');
  try {
    const remote=await request('GET');checkRemote(remote);
    if(remote.revision!==box.revision) {
      if(remote.lastMutationId && remote.lastMutationId===box.lastMutationId) {box.revision=remote.revision;persist();}
      else if(!box.dirty){box.state=remote.state||emptyState(study);box.revision=remote.revision;persist();render();}
      else {conflict=true;status();return;}
    }
    if(box.dirty) {
      const edits=box.edits;
      const mutationId=crypto.randomUUID();box.lastMutationId=mutationId;persist();
      const result=await request('PUT',{state:structuredClone(box.state),baseRevision:box.revision,mutationId});
      box.revision=result.revision;
      if(box.edits===edits)box.dirty=false;
      persist();
    }
    status();
  } catch(e) { if(!conflict)status(`Ezen a böngészőn mentve. Az adatbázis nem elérhető (${e.message}). Újrapróbálás automatikusan.`); }
  finally{syncing=false;if(box.dirty&&!conflict){clearTimeout(timer);timer=setTimeout(sync,30000);}}
}
function download(filename,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backup() {download(`chessmst-${selectedSet}-backup-${Date.now()}.json`,JSON.stringify({format:'chessmst-backup-v1',state:box.state},null,2),'application/json');}
function navigate(cursor) {checkpointTiming();box.state.cursor=cursor;changed();render();startTiming();$('question').focus();}
async function start() {
  selectedSet=selectSet(location.search,STIMULUS_SET);
  const response=await fetch(`./data/${SETS[selectedSet].file}`);if(!response.ok)throw new Error('Stimulus data unavailable');study=await response.json();
  if(study.set!==selectedSet)throw new Error('Stimulus set does not match its data file');
  document.title=`Sakkállások értékelése · ${SETS[selectedSet].label}`;
  document.querySelectorAll('.outer-files').forEach(row=>{row.innerHTML=[...'abcdefgh'].map(f=>`<span>${f}</span>`).join('');});
  document.querySelectorAll('.outer-ranks').forEach(col=>{col.innerHTML=[8,7,6,5,4,3,2,1].map(r=>`<span>${r}</span>`).join('');});
  key=`chessmst:${study.studyVersion}:${preview?'preview':api||'local'}`;
  // Lock the study in this browser to prevent two tabs overwriting the same local store.
  if(navigator.locks) {
    let resolveLock;const acquired=new Promise(r=>resolveLock=r);
    navigator.locks.request(key,{ifAvailable:true},async held=>{resolveLock(Boolean(held));if(held)await new Promise(r=>lock=r);});
    if(!await acquired)throw new Error('Az értékelés már meg van nyitva egy másik böngészőablakban. Zárd be azt, majd töltsd újra ezt az oldalt.');
  }
  let saved;
  try {saved=localStorage.getItem(key);}catch{storageFailed=true;}
  if(saved) {
    try {box=JSON.parse(saved);if(!validateState(study,box.state)||!Number.isInteger(box.revision)||box.revision<0||!Number.isInteger(box.edits)||typeof box.dirty!=='boolean')throw new Error();}
    catch {throw new Error('A helyi mentés sérült. Az eredeti mentést nem írtuk felül. Állítsd vissza egy JSON biztonsági másolatból a böngésző tárhelyének javítása után.');}
  }else box={state:emptyState(study),revision:0,dirty:false,edits:0,lastMutationId:null};
  if(api) {
    try {
      const remote=await request('GET');checkRemote(remote);
      if(!box.dirty){box.state=remote.state||box.state;box.revision=remote.revision;}
      else if(remote.revision!==box.revision){
        if(remote.lastMutationId===box.lastMutationId&&box.lastMutationId)box.revision=remote.revision;
        else conflict=true;
      }
    }catch(e){if(!conflict)error(`Az adatbázis most nem elérhető: ${e.message}. Ezen a böngészőn folytathatod; új eszközön várj a szinkronizálásra.`);}
  }
  ready=true;persist();render();status();startTiming();
  $('next').onclick=()=>{
    const c=current();if(!validAnswer(c.q,value()))return;
    const started=timingStarted;
    checkpointTiming();
    if(box.state.records[c.key].timingVersion!==1){box.state.records[c.key].responseTimeMs=started===null?0:elapsed(0,started,performance.now());box.state.records[c.key].timingVersion=1;}
    box.state.records[c.key].submitted=true;box.state.records[c.key].updatedAt=new Date().toISOString();
    if(!changed()){render();return;}
    const total=study.stimuli.length*study.questions.length;
    const next=box.state.cursor+1;
    navigate(next===total&&completedCount(box.state)<total?firstIncomplete(study,box.state):next);
  };
  $('back').onclick=()=>navigate(Math.max(0,box.state.cursor-1));
  $('settings').onclick=()=>{status();$('data-dialog').showModal();};
  $('close-dialog').onclick=()=>$('data-dialog').close();
  $('storage-description').textContent=api?'A válaszok ezen a böngészőn és a csatlakoztatott adatbázisban kerülnek mentésre.':'A válaszok ezen a böngészőn kerülnek mentésre. Eszközváltáshoz használj JSON biztonsági másolatot, vagy csatlakoztass adatbázist.';
  $('sync').disabled=!api;$('sync').onclick=sync;
  $('download-json').onclick=backup;
  $('download-csv').onclick=()=>{
    const rows=exportRows(study,box.state),fields=Object.keys(rows[0]);
    const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
    download(`chessmst-${selectedSet}-responses-${Date.now()}.csv`,'\uFEFF'+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  };
  $('import').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      const incoming=JSON.parse(await file.text());if(incoming.format!=='chessmst-backup-v1'||!validateState(study,incoming.state))throw new Error('Nem ehhez az adatsorhoz tartozó vagy érvénytelen mentés.');
      if(syncing)throw new Error('Várd meg a szinkronizálás végét, majd próbáld újra.');
      if(!confirm('A biztonsági másolat felülírja az ezen a böngészőn lévő válaszokat. Folytatod?'))return;
      backup();box.state=incoming.state;changed();render();error('');
    }catch(e){error(e.message);}finally{e.target.value='';}
  };
  $('resume').onclick=()=>{navigate(firstIncomplete(study,box.state));$('data-dialog').close();};
  $('review').onclick=()=>navigate(0);
  $('load-cloud').onclick=async()=>{
    if(syncing)return;
    if(!confirm('Betöltöd a szerver válaszait? A helyi válaszokról automatikusan biztonsági másolat készül.'))return;
    try {backup();const remote=await request('GET');checkRemote(remote);box.state=remote.state||emptyState(study);box.revision=remote.revision;box.dirty=false;box.lastMutationId=null;conflict=false;persist();render();status();error('');}
    catch(e){error(`Betöltés sikertelen: ${e.message}`);}
  };
  addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(timedKey&&timingStarted!==null&&!record())box.state.records[timedKey]={value:null,submitted:false,updatedAt:new Date().toISOString(),responseTimeMs:0,timingVersion:1};
      checkpointTiming();timingStarted=null;if(record()&&!record().submitted)changed();
    }
    else{startTiming();sync();}
  });
  addEventListener('beforeunload',e=>{if(box.dirty&&api||storageFailed){e.preventDefault();e.returnValue='';}});
  setInterval(sync,30000);sync();
}
start().catch(e=>{error(e.message);$('save-status').textContent='Az értékelés nem indult el.';});

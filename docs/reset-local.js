const $=id=>document.getElementById(id);
const keys=()=>Object.keys(localStorage).filter(k=>k.startsWith('chessmst:'));
function show(){ $('count').textContent=`${keys().length} helyi ChessMST-mentés található.`; }
show();
$('backup').onclick=()=>{
  let i=0;
  for(const key of keys()){
    const saved=JSON.parse(localStorage.getItem(key));
    const data=JSON.stringify({format:'chessmst-backup-v1',state:saved.state},null,2);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');
    a.href=url;a.download=`chessmst-local-${++i}-${saved.state.studyVersion}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('clear').disabled=false;
  $('message').textContent='Ellenőrizd, hogy a mentések letöltődtek. A böngésző több fájl letöltéséhez engedélyt kérhet.';
};
$('clear').onclick=async()=>{
  if(navigator.locks){const active=await navigator.locks.query();if(active.held.some(l=>l.name.startsWith('chessmst:'))){$('message').textContent='Előbb zárd be az összes értékelőoldalt ebben a böngészőben.';return;}}
  if(prompt('A helyi ChessMST-mentések törléséhez írd be: TORLES')!=='TORLES')return;
  for(const key of keys())localStorage.removeItem(key);
  $('message').textContent='A helyi mentések törölve. Az adatbázis tartalmát ez nem módosította.';show();$('clear').disabled=true;
};

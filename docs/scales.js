export function scaleLabels(question) {
  if(question.q_id==='ch_material')return ['−3 · Sötét előnye','0 · Egyenlő','+3 · Világos előnye'];
  if(question.q_id==='ch_position_eval')return ['1 · Sötét áll jobban','4 · Egyenlő','7 · Világos áll jobban'];
  return ['1 · Egyáltalán nem','7 · Teljes mértékben'];
}

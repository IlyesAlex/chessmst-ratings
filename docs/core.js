export function parseFen(fen) {
  const ranks = fen.trim().split(/\s+/)[0].split('/');
  if (ranks.length !== 8) throw new Error('Invalid FEN rank count');
  const result = {};
  ranks.forEach((rank, r) => {
    let file = 0;
    for (const c of rank) {
      if (/^[1-8]$/.test(c)) file += Number(c);
      else if (/^[prnbqkPRNBQK]$/.test(c) && file < 8) result[`${'abcdefgh'[file++]}${8-r}`] = c;
      else throw new Error('Invalid FEN piece');
    }
    if (file !== 8) throw new Error('Invalid FEN width');
  });
  return result;
}
export const recordKey = (stimulus, question) => `${stimulus.id}:${question.q_id}`;
export function validAnswer(q, value) {
  if (q.mode === 'scale') return Number.isInteger(value) && value >= q.min && value <= q.max;
  if (!Array.isArray(value)) return false;
  const square = s => typeof s === 'string' && /^[a-h][1-8]$/.test(s);
  if (q.mode === 'pairs') return value.every(p => Array.isArray(p) && p.length === 2 && p.every(square) && p[0] !== p[1]);
  return value.every(square) && new Set(value).size === value.length;
}
export function clickPair(clicks, square) {
  if (clicks.length % 2 && clicks.at(-1) === square) return clicks.slice(0, -1);
  return [...clicks, square];
}
export const toPairs = clicks => Array.from({length: Math.ceil(clicks.length / 2)}, (_, i) => clicks.slice(i*2, i*2+2));
export function emptyState(study) {
  return {studyVersion: study.studyVersion, cursor: 0, records: {}, updatedAt: new Date().toISOString()};
}
export function validateState(study, state) {
  if (!state || state.studyVersion !== study.studyVersion || !Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor > study.stimuli.length * study.questions.length || !state.records || typeof state.records !== 'object' || Array.isArray(state.records)) return false;
  const known = new Map(study.stimuli.flatMap(s => study.questions.map(q => [recordKey(s,q), q])));
  return (state.cursor < study.stimuli.length * study.questions.length || completedCount(state) === study.stimuli.length * study.questions.length) && Object.entries(state.records).every(([key, r]) => {
    const q = known.get(key);
    if (!q || !r || typeof r.submitted !== 'boolean' || typeof r.updatedAt !== 'string') return false;
    if(r.responseTimeMs!==undefined&&(!Number.isInteger(r.responseTimeMs)||r.responseTimeMs<0))return false;
    if (r.submitted) return validAnswer(q, r.value);
    if (r.value === null) return true;
    // An unfinished pair is a valid draft, but never a submitted response.
    if (q.mode === 'pairs') return Array.isArray(r.value) && r.value.every((p,i) => Array.isArray(p) && p.length >= 1 && p.length <= 2 && (p.length === 2 || i === r.value.length-1) && p.every(s => /^[a-h][1-8]$/.test(s)) && (p.length === 1 || p[0] !== p[1]));
    return validAnswer(q, r.value);
  });
}
export function completedCount(state) { return Object.values(state.records).filter(r => r.submitted).length; }
export function firstIncomplete(study, state) {
  const n = study.questions.length;
  for (let i=0; i<study.stimuli.length*n; i++) {
    if (!state.records[recordKey(study.stimuli[Math.floor(i/n)], study.questions[i%n])]?.submitted) return i;
  }
  return study.stimuli.length*n;
}
export function exportRows(study, state) {
  return study.stimuli.flatMap(s => study.questions.map(q => {
    const r = state.records[recordKey(s,q)];
    return {stimulus_set:study.set, study_version: study.studyVersion, presentation_index:s.presentation_index, stimulus_id:s.id,
      source_trialno:s.trialno, pair_id:s.pair_id, stimtype:s.stimtype, source_order:s.order,
      position_fname:s.position_fname, fen:s.position_fen, q_id:q.q_id, q_type:q.mode,
      answer:r ? JSON.stringify(r.value) : '', submitted:r?.submitted ?? false, updated_at:r?.updatedAt ?? ''};
  }));
}

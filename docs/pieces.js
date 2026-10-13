// Original vector artwork. No network assets or external chess fonts required.
const shapes = {
  p: '<circle cx="50" cy="27" r="12"/><path d="M40 40 Q36 55 30 66 H70 Q64 55 60 40 Z"/><path d="M27 70 H73 L78 82 H22 Z"/>',
  r: '<path d="M25 16 H36 V28 H44 V16 H56 V28 H64 V16 H75 V38 L65 44 V68 H35 V44 L25 38 Z"/><path d="M30 69 H70 L77 83 H23 Z"/><path d="M35 45 H65 M35 62 H65"/>',
  n: '<path d="M29 69 Q35 54 57 43 L43 42 L31 48 L20 40 L29 28 L45 20 L47 10 L59 19 Q79 29 76 69 Z"/><path d="M27 70 H77 L82 83 H22 Z"/><circle cx="45" cy="30" r="2" fill="currentColor"/><path d="M28 38 L33 38 M62 27 Q74 41 61 57"/>',
  b: '<path d="M50 12 Q79 36 58 47 L62 63 H38 L42 47 Q21 36 50 12 Z"/><path d="M51 24 L43 36 M36 65 H64 L74 76 H26 Z M26 78 H74 V84 H26 Z"/><circle cx="50" cy="10" r="4"/>',
  q: '<path d="M24 29 L34 62 H66 L76 29 L61 45 L50 25 L39 45 Z"/><circle cx="22" cy="24" r="5"/><circle cx="50" cy="19" r="5"/><circle cx="78" cy="24" r="5"/><path d="M34 64 H66 L71 74 H29 Z M26 77 H74 L78 84 H22 Z"/>',
  k: '<path d="M50 8 V27 M41 17 H59" fill="none"/><path d="M50 30 Q37 22 30 34 Q23 44 38 58 H62 Q77 44 70 34 Q63 22 50 30 Z"/><path d="M38 59 H62 L69 72 H31 Z M27 76 H73 L78 84 H22 Z"/>'
};
export function pieceSvg(piece) {
  const white = piece === piece.toUpperCase();
  return `<svg aria-hidden="true" viewBox="0 0 100 100" class="piece ${white?'white-piece':'black-piece'}"><g fill="${white?'#fffaf0':'#262b2d'}" stroke="${white?'#262b2d':'#fffaf0'}" stroke-width="3.3" stroke-linejoin="round" stroke-linecap="round" color="${white?'#262b2d':'#fffaf0'}">${shapes[piece.toLowerCase()]}</g></svg>`;
}

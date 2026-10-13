// Exact piece artwork copied from the original stimulus SVG template.
const assets = {
  "P": "assets/pieces/white-pawn.svg",
  "N": "assets/pieces/white-knight.svg",
  "B": "assets/pieces/white-bishop.svg",
  "R": "assets/pieces/white-rook.svg",
  "Q": "assets/pieces/white-queen.svg",
  "K": "assets/pieces/white-king.svg",
  "p": "assets/pieces/black-pawn.svg",
  "n": "assets/pieces/black-knight.svg",
  "b": "assets/pieces/black-bishop.svg",
  "r": "assets/pieces/black-rook.svg",
  "q": "assets/pieces/black-queen.svg",
  "k": "assets/pieces/black-king.svg"
};
export function pieceSvg(piece) {
  if (!Object.hasOwn(assets, piece)) throw new Error('Unknown chess piece');
  return `<img aria-hidden="true" alt="" draggable="false" class="piece" src="${assets[piece]}">`;
}

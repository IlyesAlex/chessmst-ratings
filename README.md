# ChessMST position ratings

A static, Hungarian-language survey for a single chess GM rating all positions in the "chessMST" research project.. GitHub Pages serves the webpage; a Cloudflare Worker and D1 SQLite database save results. Everything needed for the frontend is in `docs/`, with no build or frontend dependencies.

## Included stimulus sets

| Set | Unique positions | Questions per position | Required responses | Composition |
| --- | ---: | ---: | ---: | --- |
| B | 216 | 12 | 2,592 | 88 BOTHLURE, 88 BLACKLURE, 40 REPEAT |
| demo | 40 | 12 | 480 | 28 BOTHLURE, 12 BLACKLURE |

**B:** The 40 rows with `stimtype=REPEAT` and `order=2` are excluded. The first presentation of each REPEAT remains, along with every original/lure variant. Every board appears once. Original trial numbers are preserved, so gaps in them are expected.

**Demo:** The workbook has 20 item rows, each containing `baseline_FEN` and `repeat_FEN`. These expand into two original/lure positions, giving 40 unique boards. Here `repeat_FEN` names the changed lure variant; it is not an exact duplicate REPEAT presentation. Both variants remain.

## Answering and interaction

- Twelve questions in source workbook order: four scales and eight square-selection questions. Material uses −3…3; other scales use 1…7. A scale needs an explicit selection; material zero is valid.
- Boards render directly from FEN piece placement, with White at the bottom. Missing FEN move metadata is not inferred. The app does not run an engine or move pieces.
- Piece paths, square colours and the external coordinate frame match the original stimulus template. Assets are bundled in `docs/assets/pieces/`; the styling change preserves dataset fingerprints and saved progress. Add `&preview=1` to a set URL for a separate local preview that never writes cloud responses.
- Click squares to highlight them; click again to remove a normal selection. Empty squares can also be selected.
- A square question with no matches requires **Nincs ilyen** (“None”); an untouched board is not treated as an answer.
- Conflict clicks are paired sequentially: clicks 1–2 form pair 1, clicks 3–4 pair 2. Colours, numbers and connecting lines indicate pairs. Squares can belong to multiple pairs. Clicking the pending square again cancels that pending click. Undo and each pair's Delete button correct selections. An unfinished pair cannot be submitted.
- Original Hungarian question wording, including existing typos, is preserved. Generic scale endpoint descriptions are added in the UI; check that they suit the intended rating protocol before collection.
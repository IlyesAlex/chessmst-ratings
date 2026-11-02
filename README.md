# ChessMST position ratings

A static, Hungarian-language survey for a single chess GM rating all positions in the "chessMST" research project. GitHub Pages serves the webpage; a Cloudflare Worker and D1 SQLite database save results. Everything needed for the frontend is in `docs/`, with no build or frontend dependencies.

## Start here

- [Setup, deployment and choosing B or demo](HOWTO.md). The current default is the **full B set (216 positions)**; change `STIMULUS_SET` in `docs/config.js` or use `?set=B` / `?set=demo` in the survey URL.
- [Backup, SQL/CSV/Excel export and database emptying](EXPORT_INSTRUCTIONS.md). Double-click `EXPORT_DATA.cmd` to fetch fresh data. `EMPTY_DATABASE.cmd` creates a backup and requires typed confirmations before deleting database responses.
- [Database checks and local-save cleanup (Hungarian)](DATABASE_GUIDE.md).
- Local preview: run `npm run preview`, then open http://127.0.0.1:8000/.
- Published survey: https://ilyesalex.github.io/chessmst-ratings/.

Cloudflare administration in this folder uses the separate `chessmst-new` login profile. Other project logins are unchanged. The 2026-11-02 account migration preserves existing responses/progress; see [migration details](HOWTO.md#account-migration-on-2026-11-02). Exports now derive their sheets locally from the full SQL backup, avoiding an additional D1 query.

## Project files

Cloud saves process only changed answers in history, avoiding a comparison of every saved answer against every previous answer. Local saves remain immediate; cloud edits are batched after 1.5 seconds. Unchanged visible pages check the cloud every five minutes; hidden pages do not poll unless they have unsynced edits. Quota errors wait 15 minutes before retrying. See [the D1 optimization upgrade](HOWTO.md#reduce-d1-read-usage) for the required history-trigger migration on existing databases. Dataset versions and saved progress are unchanged by this optimization.

| Location | Purpose |
| --- | --- |
| `docs/` | The complete webpage, board artwork and generated survey datasets. GitHub Pages publishes this folder. |
| `backend/` | Worker API, D1 schema, database configuration and administration SQL. |
| `tools/` | Preview server, stimulus generator, database checks, export and emptying scripts. |
| `tests/`, `.github/` | Validation and the GitHub Pages deployment workflow. |
| Three root `.xlsx` workbooks | Source positions and questions; required to regenerate and validate datasets. |
| `stimuli_order*.csv`, `order_validation*.json` | Reproducible presentation schedules and constraint reports. |
| `export/` | Private dated exports: full database SQL, processed SQL/CSV/XLSX and snapshot metadata. |
| `backups/` | Private database backups, including automatic backups before emptying. |

Saved results in `export/` and `backups/` are ignored by Git. Each future export creates a new dated folder. Temporary caches are recreated as needed; project ZIPs and old screenshots are unnecessary.

## Included stimulus sets

| Set | Unique positions | Questions per position | Required responses | Composition |
| --- | ---: | ---: | ---: | --- |
| B | 216 | 12 | 2,592 | 88 BOTHLURE, 88 BLACKLURE, 40 REPEAT |
| demo | 40 | 12 | 480 | 28 BOTHLURE, 12 BLACKLURE |

**B:** The 40 rows with `stimtype=REPEAT` and `order=2` are excluded. The first presentation of each REPEAT remains, along with every original/lure variant. Every board appears once. Original trial numbers are preserved, so gaps in them are expected.

**Demo:** The workbook has 20 item rows, each containing `baseline_FEN` and `repeat_FEN`. These expand into two original/lure positions, giving 40 unique boards. Here `repeat_FEN` names the changed lure variant; it is not an exact duplicate REPEAT presentation. Both variants remain.

## Answering and interaction

- Twelve questions in source workbook order: five scales and seven square-selection questions. Material uses −3…3; other scales use 1…7. Overall position evaluation uses 1 = Black stands better, 4 = equal, 7 = White stands better. A scale needs an explicit selection; material zero is valid.
- Boards render directly from FEN piece placement, with White at the bottom. Missing FEN move metadata is not inferred. The app does not run an engine or move pieces.
- Piece paths, square colours and the external coordinate frame match the original stimulus template. Assets are bundled in `docs/assets/pieces/`; the styling change preserves dataset fingerprints and saved progress. Add `&preview=1` to a set URL for a separate local preview that never writes cloud responses.
- Click squares to highlight them; click again to remove a normal selection. Empty squares can also be selected.
- A square question with no matches requires **Nincs ilyen** (“None”); an untouched board is not treated as an answer.
- Conflict clicks are paired sequentially: clicks 1–2 form pair 1, clicks 3–4 pair 2. Colours, numbers and connecting lines indicate pairs. Squares can belong to multiple pairs. Clicking the pending square again cancels that pending click. Undo and each pair's Delete button correct selections. An unfinished pair cannot be submitted.
- Hungarian question wording and order follow `stimuli_q.xlsx`. The former question 10 (“sakkszerűtlen” pieces) is now second; “védtelen” is replaced by “veszélyben levő”; strong pawns are omitted; “Ki áll jobban az állás alapján?” follows material advantage.

The 2026-10-17 questionnaire revision changes both dataset fingerprints while preserving position order. It starts separate B/demo progress; earlier answers remain under their earlier versions and in full SQL backups. Current-version processed exports use the revised questionnaire. No old responses are deleted or automatically mapped to changed questions.

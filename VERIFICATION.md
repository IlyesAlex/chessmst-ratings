# Local verification — 12 October 2026

- B: 216 unique positions, 88 original/lure pairs, 40 singleton REPEATs, 12 questions, 2,592 required responses. Exactly the 40 REPEAT rows with source order 2 were excluded.
- Demo: 20 source items expanded into 40 unique positions and 20 pairs, 12 questions, 480 required responses.
- Independent schedule validation for BOTH sets: minimum 15 intervening positions; maximum type run 3; each retained position occurs once.
- Independent XLSX reconciliation passed: all source fields for retained B rows match, both demo variants match their source FENs/filenames, and both question lists preserve the source workbook.
- Source question accents were verified in UTF-8; no replacement characters. Original wording retained.
- Node test suite: fourteen tests passed, including database-inspection draft/submission counts and explicit reset SQL scope, alongside the previous schedule, FEN, input, resume, export, set isolation and API checks.
- Actual SQLite schema test passed for initial insert, stale-revision rejection, changed-response history, cursor-only writes and the current-response view.
- Browser checks at desktop size and 390 × 844: FEN board rendered, squares toggled, numeric scale and material zero accepted, previous/next navigation worked, scale draft and square selection survived reload, conflict pairs survived reload, pending pair blocked submission, undo restored valid submission.
- Updated browser checks: B displays 216 positions / 2,592 responses; demo displays 40 / 480 and 64 rendered squares. Switching B → demo → B restores B's second question and selected draft. Returning to demo restores its own draft; reloading preserves it. Progress counts remain independent.
- Screenshots: `qa/demo-preview.png` for the current demo selector; `qa/survey-preview.png` for the earlier board/pair interaction check (excluded from deployment and release).
- Initial API checks used a local test database adapter. On 13 October 2026, the CORS origin case fix was deployed to the existing Cloudflare Worker (version `cb8699b9-79f4-42dc-be71-a54521f3346a`). Live GET from `https://ilyesalex.github.io` returned HTTP 200 with the matching Access-Control-Allow-Origin header; the PUT preflight returned HTTP 204 with allowed methods and Content-Type. These checks did not write participant responses. Cross-device restoration and end-to-end response saving still require the smoke test in README.md.

The static frontend was inspected in the Codex in-app browser. Any locally entered QA answers are restricted to its localhost browser storage, with no configured cloud endpoint. Production data starts on the separate GitHub Pages origin.

## Reference artwork and database administration update

- All twelve piece definitions were copied from the exact SVG template used by the original demo PNG generator. The reference PNG's sampled square colours match the webpage: light `(255,206,158)`, dark `(209,139,71)`, frame `(33,33,33)`.
- Desktop and 390 × 844 mobile browser checks passed: artwork loaded; labels appeared outside all four board edges; square highlights worked; conflict connection overlay remained aligned with the playing grid. Screenshot: `qa/reference-board-preview.png`.
- These UI checks used the new `preview=1` mode, which disables cloud writes and uses separate local progress.
- Read-only API and direct SQL inspection found B empty; demo revision 3 has 5 records (4 submitted, 1 draft) and 9 response-history entries. Both current sets passed response validation. Required tables, view and triggers are present.
- CSV/JSON snapshots and a full SQL backup were saved under the ignored `backups/` directory. The SQL backup was restored into an in-memory SQLite database and checked locally.
- The full reset SQL was tested only in an in-memory database: data removed, schema/triggers preserved, subsequent saves succeeded. No production response data was deleted.
- The reference-style frontend has been prepared locally; upload the updated `docs/` files to the GitHub Pages repository to publish it. No backend redeployment is needed for this artwork change.

# Local verification — 12 October 2026

- B: 216 unique positions, 88 original/lure pairs, 40 singleton REPEATs, 12 questions, 2,592 required responses. Exactly the 40 REPEAT rows with source order 2 were excluded.
- Demo: 20 source items expanded into 40 unique positions and 20 pairs, 12 questions, 480 required responses.
- Independent schedule validation for BOTH sets: minimum 15 intervening positions; maximum type run 3; each retained position occurs once.
- Independent XLSX reconciliation passed: all source fields for retained B rows match, both demo variants match their source FENs/filenames, and both question lists preserve the source workbook.
- Source question accents were verified in UTF-8; no replacement characters. Original wording retained.
- Node test suite: eleven tests passed, covering both schedules, FEN, input validation, pairs, resume/complete/export, configuration and URL selection, cross-set rejection and database isolation, Worker retries and API validation/preflight.
- Actual SQLite schema test passed for initial insert, stale-revision rejection, changed-response history, cursor-only writes and the current-response view.
- Browser checks at desktop size and 390 × 844: FEN board rendered, squares toggled, numeric scale and material zero accepted, previous/next navigation worked, scale draft and square selection survived reload, conflict pairs survived reload, pending pair blocked submission, undo restored valid submission.
- Updated browser checks: B displays 216 positions / 2,592 responses; demo displays 40 / 480 and 64 rendered squares. Switching B → demo → B restores B's second question and selected draft. Returning to demo restores its own draft; reloading preserves it. Progress counts remain independent.
- Screenshots: `qa/demo-preview.png` for the current demo selector; `qa/survey-preview.png` for the earlier board/pair interaction check (excluded from deployment and release).
- No GitHub or Cloudflare deployment was performed. API checks used a local test database adapter; live Cloudflare connectivity, cross-device cloud restoration and network retries still need the deployment smoke test in README.md.

The static frontend was inspected in the Codex in-app browser. Any locally entered QA answers are restricted to its localhost browser storage, with no configured cloud endpoint. Production data starts on the separate GitHub Pages origin.

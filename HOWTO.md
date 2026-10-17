# ChessMST position ratings

A static, Hungarian-language survey for one rater. GitHub Pages serves the webpage; a Cloudflare Worker and D1 SQLite database save results. There is no participant login. Everything needed for the frontend is in `docs/`, with no build or frontend dependencies.

## Choose B or demo

The current default is **demo**. Change this one line in `docs/config.js` to choose the default:

```javascript
export const STIMULUS_SET = 'demo'; // Change to 'B' for the full B set.
```

You can also choose through a URL without editing files or redeploying:

| Set | Local preview | GitHub Pages |
| --- | --- | --- |
| B | http://127.0.0.1:8000/?set=B | https://YOUR-USERNAME.github.io/chessmst-ratings/?set=B |
| demo | http://127.0.0.1:8000/?set=demo | https://YOUR-USERNAME.github.io/chessmst-ratings/?set=demo |

The URL takes precedence over the configured default. Names are case-sensitive: **B** and **demo**. Unknown names are rejected. The active set appears beside the position count and in the page title. Both sets use the same questions.

Each set has its own local progress, database state, exports and backups. Returning to a set resumes its saved question. Use the same explicit set URL on your computer and phone. The backend supports both sets automatically; switching does not require another database or backend deployment after initial setup.

## Included stimulus sets

| Set | Unique positions | Questions per position | Required responses | Composition |
| --- | ---: | ---: | ---: | --- |
| B | 216 | 12 | 2,592 | 88 BOTHLURE, 88 BLACKLURE, 40 REPEAT |
| demo | 40 | 12 | 480 | 28 BOTHLURE, 12 BLACKLURE |

**B:** The 40 rows with `stimtype=REPEAT` and `order=2` are excluded. The first presentation of each REPEAT remains, along with every original/lure variant. Every board appears once. Original trial numbers are preserved, so gaps in them are expected.

**Demo:** The workbook has 20 item rows, each containing `baseline_FEN` and `repeat_FEN`. These expand into two original/lure positions, giving 40 unique boards. Here `repeat_FEN` names the changed lure variant; it is not an exact duplicate REPEAT presentation. Both variants remain.

| Set | Ordered stimuli | Frontend data | Validation report |
| --- | --- | --- | --- |
| B | `stimuli_order.csv` | `docs/data/study_B.json` | `order_validation.json` |
| demo | `stimuli_order_demo.csv` | `docs/data/study_demo.json` | `order_validation_demo.json` |

The B CSV retains all source columns for retained rows. The demo CSV preserves original item fields alongside common per-position fields. Validation reports include unique-board counts, pair gaps and excluded B trial numbers. Source workbooks are unchanged.

The default seed is **20261012** for both sets. Every original/lure pair has **at least 15 intervening positions** (index distance ≥16). No stimulus type occurs more than **three times consecutively**. B has 88 pairs and 40 singleton REPEAT positions; demo has 20 pairs. B pair IDs use stimulus type plus filename number; demo pair IDs use stimulus type plus item number. Unrelated positions sharing a number are not paired.

Variants are freely shuffled: source version 1 is not required to precede version 2. Original B `delay` and `order` remain metadata, not survey timing controls. The generator uses a seeded shuffle and swap optimisation until both constraints pass, never relaxing them. This is reproducible pseudorandom ordering, not uniform sampling among all valid schedules.

A content fingerprint identifies each exact set, order and question list. Keep the generated data stable during collection.

## Answering and interaction

- Twelve questions in source workbook order: five scales and seven square-selection questions. Material uses −3…3; other scales use 1…7. Overall position evaluation uses 1 = Black stands better, 4 = equal, 7 = White stands better. A scale needs an explicit selection; material zero is valid.
- Boards render directly from FEN piece placement, with White at the bottom. Missing FEN move metadata is not inferred. The app does not run an engine or move pieces.
- Piece paths, square colours and the external coordinate frame match the original stimulus template. Assets are bundled in `docs/assets/pieces/`; the styling change preserves dataset fingerprints and saved progress. Add `&preview=1` to a set URL for a separate local preview that never writes cloud responses.
- Click squares to highlight them; click again to remove a normal selection. Empty squares can also be selected.
- A square question with no matches requires **Nincs ilyen** (“None”); an untouched board is not treated as an answer.
- Conflict clicks are paired sequentially: clicks 1–2 form pair 1, clicks 3–4 pair 2. Colours, numbers and connecting lines indicate pairs. Squares can belong to multiple pairs. Clicking the pending square again cancels that pending click. Undo and each pair's Delete button correct selections. An unfinished pair cannot be submitted.
- Hungarian question wording and order follow `stimuli_q.xlsx`. As of 2026-10-17, the former “sakkszerűtlen” question is second, “veszélyben levő” replaces “védtelen”, the strong-pawn question is removed, and “Ki áll jobban az állás alapján?” follows material advantage. The revised fingerprints start separate progress; earlier responses are retained under their old versions. Position order is unchanged.

## Try locally

Requires Node.js 22 or newer. From this folder:

```powershell
npm run preview
```

Open either local URL in the table above. Stop the server with Ctrl+C. Do not open `index.html` as a `file://` URL; the app loads JSON and JavaScript modules.

Before a database is connected, answers save to this browser's local storage. **Mentés és adatok** (“Saving and data”) exports CSV responses and a restorable JSON backup. Localhost and GitHub Pages have separate browser storage.

## Deployment pipeline

### 1. Create the results database and API

Requires a Cloudflare account and Node.js. The rater does not need an account.

```powershell
cd backend
npx.cmd --prefer-online wrangler@latest login
npx.cmd --prefer-online wrangler@latest d1 create chessmst-ratings
```

Copy the returned database UUID into `database_id` in `backend/wrangler.toml`. Keep the binding name **DB**. Set `ALLOWED_ORIGINS` to your exact GitHub Pages origin:

```toml
ALLOWED_ORIGINS = "https://YOUR-USERNAME.github.io,http://localhost:8000,http://127.0.0.1:8000"
```

The origin excludes the repository path and trailing slash. Initialise the database and deploy:

This address can be configured before the GitHub Pages site exists. If your GitHub username is `IlyesAlex`, its browser origin is `https://ilyesalex.github.io`. The Worker normalises configured origins to handle hostname letter case correctly. If you do not yet have a GitHub account, start with only the two local origins and add your GitHub Pages origin before collecting there.

```powershell
npx.cmd --prefer-online wrangler@latest d1 execute chessmst-ratings --remote --file=./schema.sql
npx.cmd --prefer-online wrangler@latest deploy
cd ..
```

Wrangler prints a Worker URL. Put its base URL in `docs/config.js`, without `/state` or a query string:

```javascript
export const API_URL = 'https://chessmst-ratings-api.YOUR-SUBDOMAIN.workers.dev';
export const STIMULUS_SET = 'B';
```

Before collection, `/state?set=B` and `/state?set=demo` each return `{"revision":0,"state":null,"lastMutationId":null}`. The unqualified `/state` defaults to B. [Cloudflare's D1 guide](https://developers.cloudflare.com/d1/get-started/) documents database creation, bindings and deployment.

The API bundles both datasets and validates answers against the selected one. Cross-set payloads are rejected. Deploy frontend and backend from the same source version.

`STUDY_ID = "chessmst-single-rater"` is a collection namespace. The API automatically appends the set and fingerprint; you do not need to change it when choosing B or demo. No schema migration is required to switch sets.

### 2. Publish on GitHub Pages

Create an empty GitHub repository, for example **chessmst-ratings**. Put the project files at its root, including the hidden `.github/` directory. Avoid an extra nested project folder.

For a new local repository, replace the URL and run:

```powershell
git init
git add .
git commit -m "Add ChessMST ratings survey"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/chessmst-ratings.git
git push -u origin main
```

If already tracked by Git, use the existing repository workflow rather than reinitialising it.

In GitHub, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included workflow checks the project and publishes only `docs/`. If necessary, start **Actions → Deploy survey to GitHub Pages → Run workflow** after enabling Pages.

Your page will be at **https://YOUR-USERNAME.github.io/chessmst-ratings/**. All frontend paths are relative. See [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Alternative: select **Deploy from a branch**, `main`, `/docs`. This publishes the same app without automatically running tests.

To change the default later, edit `STIMULUS_SET`, commit and push. Explicit `?set=B` and `?set=demo` links keep working regardless of the default.

### 3. Verify before collection

Check both set URLs. Counts should be **216 / 2,592** for B and **40 / 480** for demo. Answer one question in each and switch back: each should restore its own progress.

With the API connected, wait for **Adatbázisba mentve** (“Saved to database”). Submit a scale, a square selection and a conflict pair; reload and check restoration. Open the same set on another device and check cloud restoration. Disconnect the network after loading, make an edit, reconnect and use **Szinkronizálás most** (“Sync now”).

For smoke tests, temporarily set `STUDY_ID = "chessmst-smoke-test"` and deploy. Afterwards, return to `chessmst-single-rater` and redeploy. Use a fresh browser profile or clear only this app's test storage before starting real collection. Do not change this namespace during real collection.

## Stopping, resuming and backups

If the page says **Failed to fetch**, check the actual Worker URL in `docs/config.js` and the webpage origin in `backend/wrangler.toml`. The origin has no repository path, query string or trailing slash. Redeploy the Worker after changing `ALLOWED_ORIGINS`; changing only the local file does not update the running API. Keep locally saved answers and use “Sync now” after the connection is fixed.

Every selection and navigation action saves locally immediately. Cloud writes follow after a short debounce and retry automatically if the connection fails. Status distinguishes local saving, pending sync and database saving. Drafts include unfinished conflict pairs. Only **Mentés és tovább** (“Save and continue”) submits a response.

Database emptying advances a persistent reset marker. Opening/reloading, reconnecting, returning to the tab and periodic sync all fetch the server before writing. A changed marker replaces active local progress with the current server state, keeping a separate local recovery copy downloadable through `reset-local.html`. Legacy local progress is also cleared when the server is empty. The API checks the marker and revision atomically, so a reset during a save rejects the old write. Older webpages without reset protection cannot save until reloaded. Ordinary offline edits still sync when their marker matches; explicit backup imports are deliberate restores and can write again. Apply `schema.sql` and deploy the new Worker before publishing this frontend update; this upgrade preserves existing records.

Reopening restores the cursor and answers for the chosen set. **Ugrás az első hiányzó válaszhoz** jumps to its earliest unsubmitted question. **Előző** returns to earlier answers. Completion requires every position/question response, including explicit empty selections.

Before changing devices, wait for **Adatbázisba mentve**, close the old session and open the same set URL on the new device. Work in one device/tab per set. Supported browsers prevent simultaneous same-set tabs; server revisions prevent silent cross-device overwrites.

If two devices edit independently, sync stops and exposes conflict recovery. Download the local backup before loading server data; the server-loading button also downloads one automatically. Competing answers are not silently merged or discarded.

Browser storage is specific to browser, profile, origin, API URL and dataset fingerprint. Switching sets preserves both. Private browsing, clearing storage or storage limits may remove local data. The database is durable once synced. A fresh page visit needs a network connection; an already loaded page can collect during an outage.

Take periodic JSON backups. CSV is for analysis; JSON restores progress and drafts. Backups can only be imported into the matching set and fingerprint. If moving from local-only collection to a configured API, export JSON first, open the configured page for that set and import it.

### Earlier 256-position B version

The former B version included duplicate REPEAT presentations and has a different fingerprint. Its browser data and database rows are not overwritten, but its backups cannot be imported directly into this revised 216-position schedule. Keep any earlier exports separately. This update starts a new B dataset version; demo likewise has its own version.

If upgrading an existing deployment, redeploy the Worker and the GitHub Pages site together. The SQL schema is unchanged. Older database rows remain available for export; the new API reads the namespaced set/fingerprint rows.

## Database and analysis exports

See [EXPORT_INSTRUCTIONS.md](EXPORT_INSTRUCTIONS.md) for double-click SQL/CSV/Excel export and database emptying, and [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for Hungarian instructions on checking and clearing test data before sharing. `tools/database.js` supports read-only inspection, CSV/JSON export and targeted reset preparation. `EMPTY_DATABASE.cmd` creates a full SQL backup and requires typed confirmations before running the reset SQL. Browser-local saves also need clearing after deleting server test data; the `reset-local.html` utility provides a separate confirmation and backup step.

- `study_state`: one state per collection namespace, set and fingerprint, with revision, cursor, drafts, submissions and mutation ID. IDs look like `chessmst-single-rater:B:chessmst-b-<fingerprint>` or `chessmst-single-rater:demo:chessmst-demo-<fingerprint>`.
- `responses`: current answered/drafted rows. Unanswered questions are absent; webpage CSV includes every expected row and marks missing answers.
- `response_history`: changed response records, including drafts and corrections, with revision and server time. Cursor-only saves add no duplicate answer history. It is not a full cursor-event log.

Inspect B results:

```powershell
cd backend
npx.cmd --prefer-online wrangler@latest d1 execute chessmst-ratings --remote --command="SELECT study_id, response_key, answer, submitted, updated_at FROM responses WHERE study_id LIKE 'chessmst-single-rater:B:%' ORDER BY study_id, response_key;"
```

Use `:demo:` instead of `:B:` for demo results. This query includes matching fingerprints; use an exact study ID to isolate one version.

Export a complete SQL backup to a private location outside a public repository:

```powershell
npx.cmd --prefer-online wrangler@latest d1 export chessmst-ratings --remote --output="C:\YOUR-PRIVATE-BACKUPS\chessmst-ratings.sql"
```

The webpage CSV includes stimulus set, study version, original/synthetic trial number, presentation index, stimulus/pair IDs, type, variant, filename, FEN, question ID, answer, submission status and edit timestamp. Scale values are numeric. Square values are JSON arrays such as `["e4","f5"]`; conflicts are nested arrays such as `[["e4","d5"],["g2","g7"]]`.

When combining exports, use `stimulus_set`, `study_version` and `stimulus_id` together. Demo IDs encode source item and variant, for example `demo-item-001-v1`. Synthetic demo trial numbers are `(itemno - 1) * 2 + variant`.

## No-login access model

One rater uses separate shared states for B and demo. Anyone knowing the API URL can read or write them. The origin allowlist restricts browser access but is not authentication and does not stop direct HTTP requests. Use this model for nonsensitive ratings, keeping the link among intended users. No GitHub or Cloudflare account credentials are shipped to the browser.

## Regenerate orders and run checks

The generator uses Python's standard library. Keep all three source workbooks beside this README: `ChessMST_stimuli_B.xlsx`, `ChessMST_stimuli_demo.xlsx`, and `stimuli_q.xlsx`.

```powershell
# Generate BOTH sets (the default).
python tools/prepare_stimuli.py --seed 20261012

# Or generate just one.
python tools/prepare_stimuli.py --set B --seed 20261012
python tools/prepare_stimuli.py --set demo --seed 20261012

npm test
python tests/source_test.py
python tests/database_test.py
```

The same inputs and seed produce the same order/fingerprint. The source test independently reconciles generated positions and questions with the original workbooks. Tests cover uniqueness, retained trial IDs, spacing, type runs, FENs, input bounds, paired clicks, drafts, completion, exports, set selection, cross-set isolation, API retries/revisions and actual SQLite triggers.

A changed source, seed or question creates a new fingerprint and separate results. Keep generated data unchanged once collecting. To intentionally start another collection of the same datasets, choose a new `STUDY_ID` namespace and a fresh browser profile, and retain earlier exports.

Cloudflare and GitHub deployment still require the account configuration above. These files do not provision either service.



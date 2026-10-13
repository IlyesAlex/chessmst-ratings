# Export: easiest steps on this computer

## First-time setup

1. Extract the updated project ZIP into a folder. Keep `tools`, `docs` and `backend` together.
2. Install Node.js LTS if needed. On your present computer it is already installed.
3. Open PowerShell in the extracted project folder. Log in to the Cloudflare account that owns your database:

```powershell
cd backend
npx.cmd --prefer-online wrangler@4.150.0 login
cd ..
```

4. Check `backend/wrangler.toml`: it should contain `database_name = "chessmst-ratings"`, your database UUID, and the correct `STUDY_ID` collection namespace. The provided files already have your current settings.

The Excel exporter uses the spreadsheet runtime supplied by Codex on this computer. The script finds and links it automatically. You do not need to install pandas, openpyxl or Excel. On another computer, the same Codex workspace dependency runtime must be available; the script will explain if it is missing.

## Every time you want fresh files

1. In the survey, wait for **Adatbázisba mentve**. Pause answering while exporting. Unsynchronised browser data cannot be retrieved from the database.
2. Double-click **EXPORT_DATA.cmd** in the project folder.
3. Wait for **DONE**. Open the newly created, dated folder inside **export**.

Or run from PowerShell in the project folder:

```powershell
node tools/export-all.mjs
```

The command creates these files:

| File | Content |
| --- | --- |
| `database-backup.sql` | Full database backup: all stored versions, states, history and schema. |
| `responses.xlsx` | Preprocessed, filterable Excel sheet with current B/demo responses. |
| `responses.csv` | Exactly the same rows, in UTF-8 CSV format. |
| `responses.sql` | The preprocessed rows as a separate SQLite table named `exported_responses`. |
| `query.sql` | The exact read-only query used to retrieve the current data. |
| `database-snapshot.json` | The database rows that generated all three response files. |
| `manifest.json` | Export time, dataset versions/revisions and response counts. |

Each run uses a new folder, so previous exports remain. The script does not delete or reset responses. The `export/` folder is ignored by Git; do not upload participant data to the public GitHub repository.

For one set only:

```powershell
node tools/export-all.mjs --set B
node tools/export-all.mjs --set demo
```

For submitted answers only:

```powershell
node tools/export-all.mjs --submitted-only
```

The full SQL backup still includes the entire database. These options filter only the preprocessed response files.

## Meaning of the spreadsheet columns

- `trialno`: presentation order in this survey. `source_trialno` separately preserves the source/synthetic trial number.
- `itemnumber`: condition and variant included, for example `1_BOTHLURE_DEMO_1`.
- `question_type`: specific question identifier, for example `ch_material`; `question_format` separately identifies scale/squares/pairs.
- `response`: numeric rating or JSON square/pair array. `[]` is an explicit “None”; blank can be an unselected draft.
- `response_date`, `response_time`: last response update/submit timestamp in **Europe/Budapest**. Milliseconds are retained. The original UTC timestamp is also included.
- `response_time_seconds`: visible time spent answering, accumulated across visits to that question under the new timing-enabled webpage. Hidden-tab time is excluded. This includes reading time before choosing and visible time before submitting. It is not wall-clock time across breaks and is not a claim of uninterrupted cognitive reaction time.
- `submitted`: true for a submitted answer, false for a draft.
- The remaining columns identify the set, source item, condition, variant, exact dataset version and collection.

Only the latest saved record per trial/question is exported; earlier edits are not duplicated. The preprocessed sheet contains the current configured collection's B/demo dataset versions. The full SQL backup contains older versions too.

**Elapsed time was not collected before this update.** Older responses have a blank `response_time_seconds` value. Do not interpret blank as zero or calculate reaction time from gaps between timestamps. Publish the updated frontend to start collecting durations; existing records remain compatible.

The full database backup and the response snapshot are read sequentially. Pause collection until DONE to keep both consistent. The CSV, XLSX and preprocessed SQL all use the same single response snapshot.

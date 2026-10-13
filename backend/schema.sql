CREATE TABLE IF NOT EXISTS study_state (
  id TEXT PRIMARY KEY,
  study_version TEXT NOT NULL,
  revision INTEGER NOT NULL,
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  last_mutation_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS response_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id TEXT NOT NULL,
  study_version TEXT NOT NULL,
  revision INTEGER NOT NULL,
  response_key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
-- Record changed answers, including drafts and edits; cursor-only saves add no history rows.
CREATE TRIGGER IF NOT EXISTS history_insert AFTER INSERT ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(NEW.state_json,'$.records') AS j;
END;
CREATE TRIGGER IF NOT EXISTS history_update AFTER UPDATE ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(NEW.state_json,'$.records') AS j
  LEFT JOIN json_each(OLD.state_json,'$.records') AS o ON o.key=j.key
  WHERE o.value IS NULL OR j.value!=o.value;
END;
CREATE VIEW IF NOT EXISTS responses AS
  SELECT s.id AS study_id,s.study_version,j.key AS response_key,
    json_extract(j.value,'$.value') AS answer,
    json_extract(j.value,'$.submitted') AS submitted,
    json_extract(j.value,'$.updatedAt') AS updated_at
  FROM study_state AS s,json_each(s.state_json,'$.records') AS j;
CREATE INDEX IF NOT EXISTS history_key ON response_history(study_id,response_key,revision);

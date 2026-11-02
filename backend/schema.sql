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
-- The Worker supplies _historyChanges; only changed records are expanded in SQL.
-- A linear fallback supports older Workers or manual SQL writers without that field.
CREATE TRIGGER IF NOT EXISTS history_insert AFTER INSERT ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(NEW.state_json,'$.records') AS j;
END;
CREATE TRIGGER IF NOT EXISTS history_update AFTER UPDATE ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(CASE WHEN json_extract(NEW.state_json,'$._historyRevision')=NEW.revision AND NEW.revision=OLD.revision+1
    THEN json_extract(NEW.state_json,'$._historyChanges') ELSE json_extract(NEW.state_json,'$.records') END) AS j
  WHERE (json_extract(NEW.state_json,'$._historyRevision')=NEW.revision AND NEW.revision=OLD.revision+1)
     OR json_extract(OLD.state_json,'$.records.' || json_quote(j.key)) IS NOT j.value;
END;
CREATE VIEW IF NOT EXISTS responses AS
  SELECT s.id AS study_id,s.study_version,j.key AS response_key,
    json_extract(j.value,'$.value') AS answer,
    json_extract(j.value,'$.submitted') AS submitted,
    json_extract(j.value,'$.updatedAt') AS updated_at
  FROM study_state AS s,json_each(s.state_json,'$.records') AS j;
CREATE INDEX IF NOT EXISTS history_key ON response_history(study_id,response_key,revision);
-- This row must survive emptying. Even manual state deletion invalidates old sessions.
CREATE TABLE IF NOT EXISTS collection_control (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL CHECK(generation>=0)
);
INSERT OR IGNORE INTO collection_control(id,generation) VALUES(1,0);
CREATE TRIGGER IF NOT EXISTS reset_generation AFTER DELETE ON study_state BEGIN
  UPDATE collection_control SET generation=generation+1 WHERE id=1;
END;

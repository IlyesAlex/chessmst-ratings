-- Idempotent optimization. No responses, revisions, history or reset markers are deleted.
-- Deploy the updated Worker first, then execute this file once on the remote DB.
DROP TRIGGER IF EXISTS history_insert;
DROP TRIGGER IF EXISTS history_update;
CREATE TRIGGER history_insert AFTER INSERT ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(NEW.state_json,'$.records') AS j;
END;
CREATE TRIGGER history_update AFTER UPDATE ON study_state BEGIN
  INSERT INTO response_history(study_id,study_version,revision,response_key,response_json,saved_at)
  SELECT NEW.id,NEW.study_version,NEW.revision,j.key,j.value,NEW.updated_at
  FROM json_each(CASE WHEN json_extract(NEW.state_json,'$._historyRevision')=NEW.revision AND NEW.revision=OLD.revision+1
    THEN json_extract(NEW.state_json,'$._historyChanges') ELSE json_extract(NEW.state_json,'$.records') END) AS j
  WHERE (json_extract(NEW.state_json,'$._historyRevision')=NEW.revision AND NEW.revision=OLD.revision+1)
     OR json_extract(OLD.state_json,'$.records.' || json_quote(j.key)) IS NOT j.value;
END;

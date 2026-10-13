-- Read-only: list ALL stored study versions, including older test versions.
SELECT id AS study_id, study_version, revision, updated_at,
  json_extract(state_json, '$.cursor') AS cursor,
  (SELECT COUNT(*) FROM json_each(state_json, '$.records')) AS stored_responses,
  (SELECT COUNT(*) FROM json_each(state_json, '$.records') WHERE json_extract(value, '$.submitted')=1) AS submitted_responses
FROM study_state ORDER BY id;
SELECT study_id, COUNT(*) AS history_records FROM response_history GROUP BY study_id ORDER BY study_id;
SELECT response_key, answer, submitted, updated_at FROM responses ORDER BY updated_at DESC LIMIT 12;
SELECT generation AS reset_generation FROM collection_control WHERE id=1;
SELECT name, type FROM sqlite_master WHERE name IN ('study_state','response_history','responses','history_insert','history_update','collection_control','reset_generation') ORDER BY name;

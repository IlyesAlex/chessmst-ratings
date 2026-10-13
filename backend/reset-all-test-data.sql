-- MANUAL ONLY. Removes ALL answers/drafts and ALL response history, including old versions.
-- Before running: export the entire database and close every survey tab/device.
-- The generation invalidates old browser sessions, even if no state rows exist.
-- Tables, indexes, views and triggers are retained.
UPDATE collection_control SET generation=generation+1 WHERE id=1;
DELETE FROM study_state;
DELETE FROM response_history;
SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states,
       (SELECT COUNT(*) FROM response_history) AS remaining_history;

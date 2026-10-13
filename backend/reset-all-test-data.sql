-- MANUAL ONLY. Removes ALL answers/drafts and ALL response history, including old versions.
-- Before running: export the entire database and close every survey tab/device.
-- Afterwards: clear the local ChessMST saves on every browser used for testing.
-- Tables, indexes, views and triggers are retained.
DELETE FROM response_history;
DELETE FROM study_state;
SELECT (SELECT COUNT(*) FROM study_state) AS remaining_states,
       (SELECT COUNT(*) FROM response_history) AS remaining_history;

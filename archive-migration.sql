-- Archiving: hide a league from every member's list without deleting anything.
--
-- archived_at is null for a live league and holds the archive time otherwise.
-- Unarchiving is just setting it back to null - all rounds, songs, votes and
-- comments stay exactly where they were.
--
-- Run this BEFORE deploying the code that selects the column: the league list
-- query names archived_at explicitly, so against a database without it the
-- select errors and every member sees an empty list.

ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Restore one by hand if you ever need to:
--   update leagues set archived_at = null where name = 'league name';

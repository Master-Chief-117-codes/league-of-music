-- ─── Ranked voting migration ───
-- Run in Supabase SQL Editor after league-migrations.sql

-- 1. Add rank column to song_votes (1 = first pick, 2 = second, 3 = third)
ALTER TABLE song_votes ADD COLUMN IF NOT EXISTS rank int;

-- 2. Add unique constraint: one song per rank per voter per week
--    Partial index so NULLs (old votes without rank) are excluded
DROP INDEX IF EXISTS unique_rank_per_voter;
CREATE UNIQUE INDEX unique_rank_per_voter
  ON song_votes (week_id, voter_id, rank)
  WHERE rank IS NOT NULL;

-- ─── Season theme migration ───
-- Run in Supabase SQL Editor after resubmission-migration.sql

-- The current season's theme for a league. Prompt authors are expected to write
-- a prompt that fits it. NULL means the league has no theme, and the UI hides
-- the banner entirely — so every existing league is unaffected until its host
-- sets one.
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season_theme text;

-- Archive the theme next to the standings when a season ends. season_snapshots
-- is already the per-season record, so past seasons keep their theme without a
-- separate history table.
ALTER TABLE season_snapshots ADD COLUMN IF NOT EXISTS season_theme text;

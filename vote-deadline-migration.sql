-- Add vote_deadline to weeks for 48hr voting countdown after reveal
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS vote_deadline timestamptz;

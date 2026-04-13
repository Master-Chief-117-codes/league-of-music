-- ─── Multi-league support migration ───
-- Run this entire file in Supabase SQL Editor after migrations.sql

-- 1. League requests (pending admin approval)
CREATE TABLE IF NOT EXISTS league_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  requested_by uuid NOT NULL,
  approval_token text UNIQUE DEFAULT gen_random_uuid()::text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 2. Leagues
CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. League members (per-league stats, no FK to profiles so users can be added before profile creation)
CREATE TABLE IF NOT EXISTS league_members (
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  wins int DEFAULT 0,
  points int DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

-- 4. Add league_id to weeks
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id);

-- 5. Add league_id to invite_tokens
ALTER TABLE invite_tokens ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id);

-- 6. Enable RLS
ALTER TABLE league_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- league_requests: users can read their own; all writes go through API (service role)
DROP POLICY IF EXISTS "league_requests_select" ON league_requests;
CREATE POLICY "league_requests_select" ON league_requests FOR SELECT USING (auth.uid() = requested_by);

-- leagues: anyone can read; writes go through API (service role)
DROP POLICY IF EXISTS "leagues_select" ON leagues;
CREATE POLICY "leagues_select" ON leagues FOR SELECT USING (true);

-- league_members: anyone can read; writes go through API (service role)
DROP POLICY IF EXISTS "league_members_select" ON league_members;
CREATE POLICY "league_members_select" ON league_members FOR SELECT USING (true);

-- 7. Per-league scoring functions
CREATE OR REPLACE FUNCTION add_league_points(league_id_input uuid, user_id_input uuid, points_to_add int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE league_members
  SET points = COALESCE(points, 0) + points_to_add
  WHERE league_id = league_id_input AND user_id = user_id_input;
$$;
GRANT EXECUTE ON FUNCTION add_league_points TO authenticated;

CREATE OR REPLACE FUNCTION increment_league_wins(league_id_input uuid, user_id_input uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE league_members
  SET wins = COALESCE(wins, 0) + 1
  WHERE league_id = league_id_input AND user_id = user_id_input;
$$;
GRANT EXECUTE ON FUNCTION increment_league_wins TO authenticated;

-- 8. Realtime for new tables
ALTER publication supabase_realtime ADD TABLE leagues;
ALTER publication supabase_realtime ADD TABLE league_members;

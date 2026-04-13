-- ─── Run this entire file in Supabase SQL Editor ───

-- 1. Weeks: add missing columns
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS revealed boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS prompt_author_id uuid REFERENCES profiles(id);
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS prompt_deadline timestamptz;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- 2. Profiles: add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_host boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wins int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points int DEFAULT 0;

-- 3. Song reactions
CREATE TABLE IF NOT EXISTS song_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (submission_id, user_id, emoji)
);

-- 4. Song comments
CREATE TABLE IF NOT EXISTS song_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Comment likes
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid REFERENCES song_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

-- 6. Invite tokens
CREATE TABLE IF NOT EXISTS invite_tokens (
  token text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 7. Unique vote constraint
ALTER TABLE song_votes
  DROP CONSTRAINT IF EXISTS unique_vote_per_user;
ALTER TABLE song_votes
  ADD CONSTRAINT unique_vote_per_user UNIQUE (week_id, voter_id, submission_id);

-- 8. Functions
CREATE OR REPLACE FUNCTION add_points(user_id_input uuid, points_to_add int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET points = COALESCE(points, 0) + points_to_add WHERE id = user_id_input;
$$;
GRANT EXECUTE ON FUNCTION add_points TO authenticated;

CREATE OR REPLACE FUNCTION increment_wins(user_id_input uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE profiles SET wins = COALESCE(wins, 0) + 1 WHERE id = user_id_input;
$$;
GRANT EXECUTE ON FUNCTION increment_wins TO authenticated;

-- 9. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- 10. RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "weeks_select" ON weeks;
CREATE POLICY "weeks_select" ON weeks FOR SELECT USING (true);

DROP POLICY IF EXISTS "submissions_select" ON song_submissions;
DROP POLICY IF EXISTS "submissions_insert" ON song_submissions;
CREATE POLICY "submissions_select" ON song_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON song_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_select" ON song_votes;
DROP POLICY IF EXISTS "votes_insert" ON song_votes;
CREATE POLICY "votes_select" ON song_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON song_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "reactions_select" ON song_reactions;
DROP POLICY IF EXISTS "reactions_insert" ON song_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON song_reactions;
CREATE POLICY "reactions_select" ON song_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON song_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON song_reactions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_select" ON song_comments;
DROP POLICY IF EXISTS "comments_insert" ON song_comments;
CREATE POLICY "comments_select" ON song_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON song_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_likes_select" ON comment_likes;
DROP POLICY IF EXISTS "comment_likes_insert" ON comment_likes;
DROP POLICY IF EXISTS "comment_likes_delete" ON comment_likes;
CREATE POLICY "comment_likes_select" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "comment_likes_insert" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_likes_delete" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invite_read" ON invite_tokens;
DROP POLICY IF EXISTS "invite_insert" ON invite_tokens;
CREATE POLICY "invite_read" ON invite_tokens FOR SELECT USING (true);
CREATE POLICY "invite_insert" ON invite_tokens FOR INSERT WITH CHECK (true);

-- 11. Realtime
ALTER publication supabase_realtime ADD TABLE song_submissions;
ALTER publication supabase_realtime ADD TABLE song_votes;
ALTER publication supabase_realtime ADD TABLE song_reactions;
ALTER publication supabase_realtime ADD TABLE song_comments;
ALTER publication supabase_realtime ADD TABLE comment_likes;

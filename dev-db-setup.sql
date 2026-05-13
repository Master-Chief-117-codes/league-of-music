-- League of Music — Dev Database Setup
-- Run this in full in your new Supabase project's SQL editor.
-- Auth (users/sessions) is handled by Supabase automatically — no setup needed.

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       text,
  name        text,
  top_artists text,
  on_repeat   text,
  wins        integer DEFAULT 0,
  points      integer DEFAULT 0,
  is_host     boolean DEFAULT false,
  avatar_url  text
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── leagues ───────────────────────────────────────────────────────────────────
CREATE TABLE leagues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ── league_members ────────────────────────────────────────────────────────────
CREATE TABLE league_members (
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  wins      integer DEFAULT 0,
  points    integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

-- ── league_requests ───────────────────────────────────────────────────────────
CREATE TABLE league_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text,
  requested_by   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  approval_token text DEFAULT gen_random_uuid()::text,
  status         text DEFAULT 'pending',
  created_at     timestamptz DEFAULT now()
);

-- ── invite_tokens ─────────────────────────────────────────────────────────────
CREATE TABLE invite_tokens (
  token      text PRIMARY KEY,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  league_id  uuid REFERENCES leagues(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ── weeks ─────────────────────────────────────────────────────────────────────
CREATE TABLE weeks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          uuid REFERENCES leagues(id) ON DELETE CASCADE,
  idx                integer,
  prompt             text,
  status             text DEFAULT 'pending_prompt',
  prompt_author_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  prompt_deadline    timestamptz,
  prompt_submitted_at timestamptz,
  deadline           timestamptz,
  locked             boolean DEFAULT false,
  revealed           boolean DEFAULT false,
  submissions_locked boolean DEFAULT false,
  reveal_identities  boolean,
  all_submitted_at   timestamptz,
  vote_deadline      timestamptz,
  playlist_url       text,
  host_note          text,
  sms_2_sent         boolean DEFAULT false,
  sms_4_sent         boolean DEFAULT false,
  sms_5_sent         boolean DEFAULT false,
  sms_6_sent         boolean DEFAULT false,
  sms_7_sent         boolean DEFAULT false,
  created_at         timestamp DEFAULT now()
);

-- ── song_submissions ──────────────────────────────────────────────────────────
CREATE TABLE song_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id             uuid REFERENCES weeks(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES profiles(id) ON DELETE CASCADE,
  spotify_url         text,
  resolved_spotify_id text,
  track_name          text,
  artist_name         text,
  album_art_url       text,
  created_at          timestamp DEFAULT now()
);

-- ── song_votes ────────────────────────────────────────────────────────────────
CREATE TABLE song_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid REFERENCES weeks(id) ON DELETE CASCADE,
  voter_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  rank          integer
);

-- ── vote_locks ────────────────────────────────────────────────────────────────
CREATE TABLE vote_locks (
  week_id   uuid REFERENCES weeks(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  locked_at timestamptz DEFAULT now(),
  PRIMARY KEY (week_id, user_id)
);

-- ── song_reactions ────────────────────────────────────────────────────────────
CREATE TABLE song_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid,
  submission_id uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji         text
);

-- ── song_comments ─────────────────────────────────────────────────────────────
CREATE TABLE song_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid,
  submission_id uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  text          text,
  media_url     text,
  created_at    timestamptz DEFAULT now()
);

-- ── comment_likes ─────────────────────────────────────────────────────────────
CREATE TABLE comment_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES song_comments(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  week_id    uuid REFERENCES weeks(id) ON DELETE CASCADE
);

-- ── comment_laughs ────────────────────────────────────────────────────────────
CREATE TABLE comment_laughs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES song_comments(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  week_id    uuid REFERENCES weeks(id) ON DELETE CASCADE
);

-- ── song_guesses ──────────────────────────────────────────────────────────────
CREATE TABLE song_guesses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id        uuid REFERENCES weeks(id) ON DELETE CASCADE,
  submission_id  uuid REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES profiles(id) ON DELETE CASCADE,
  guessed_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE
);

-- ── round_ready ───────────────────────────────────────────────────────────────
CREATE TABLE round_ready (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id    uuid REFERENCES weeks(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ── RPCs (stored functions) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_wins(user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET wins = wins + 1 WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_league_wins(p_user_id uuid, p_league_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE league_members SET wins = wins + 1
  WHERE user_id = p_user_id AND league_id = p_league_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_points(user_id uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET points = points + amount WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION add_league_points(p_user_id uuid, p_league_id uuid, amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE league_members SET points = points + amount
  WHERE user_id = p_user_id AND league_id = p_league_id;
END;
$$;

-- ── Disable RLS (dev only — no sensitive data) ───────────────────────────────
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE weeks DISABLE ROW LEVEL SECURITY;
ALTER TABLE song_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE song_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE vote_locks DISABLE ROW LEVEL SECURITY;
ALTER TABLE song_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE song_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comment_laughs DISABLE ROW LEVEL SECURITY;
ALTER TABLE song_guesses DISABLE ROW LEVEL SECURITY;
ALTER TABLE round_ready DISABLE ROW LEVEL SECURITY;

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime for all tables the app subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE weeks;
ALTER PUBLICATION supabase_realtime ADD TABLE song_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE song_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE song_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE song_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_laughs;
ALTER PUBLICATION supabase_realtime ADD TABLE vote_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE round_ready;

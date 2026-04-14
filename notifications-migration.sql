-- ─── Notifications + vote locks migration ───
-- Run after sms-migration.sql

-- 1. Vote locks (persistent lock-in, per user per week)
CREATE TABLE IF NOT EXISTS vote_locks (
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  locked_at timestamptz DEFAULT now(),
  PRIMARY KEY (week_id, user_id)
);
ALTER TABLE vote_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vote_locks_select" ON vote_locks;
DROP POLICY IF EXISTS "vote_locks_insert" ON vote_locks;
CREATE POLICY "vote_locks_select" ON vote_locks FOR SELECT USING (true);
CREATE POLICY "vote_locks_insert" ON vote_locks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Timing anchors on weeks (for computing deferred notification windows)
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS prompt_submitted_at timestamptz;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS all_submitted_at timestamptz; -- set when #5 fires

-- 3. Per-notification dedup flags
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS sms_2_sent boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS sms_4_sent boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS sms_5_sent boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS sms_6_sent boolean DEFAULT false;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS sms_7_sent boolean DEFAULT false;

-- 4. Realtime for vote_locks
ALTER PUBLICATION supabase_realtime ADD TABLE vote_locks;

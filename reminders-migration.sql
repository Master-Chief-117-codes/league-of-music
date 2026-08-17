-- ─── Automated reminders migration ───
-- Run in Supabase SQL Editor after notifications-migration.sql
--
-- Supersedes the unapplied parts of sms-migration.sql. That file's
-- `profiles.phone` column was never actually applied to the database, and its
-- `weeks.submission_reminder_sent_at` / `prompt_reminder_sent_at` columns are
-- replaced by the finer-grained `reminder_log` table below (we now nudge
-- individual people at multiple offsets, so a single timestamp per week is too
-- coarse to dedup against).

-- 1. Phone + documented SMS opt-in on profiles.
--    phone is E.164 (e.g. +12125551234). sms_consent_at is the compliance
--    record for A2P 10DLC — never send to a number without it.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_opted_out_at timestamptz;

-- Enforce E.164 so a malformed number can never reach Twilio.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164;
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_e164
  CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{7,14}$');

-- 2. Per-send dedup log. One row per (week, user, kind) — the unique index is
--    what guarantees we never nudge the same person for the same thing twice,
--    even if the cron double-fires or overlaps with itself.
CREATE TABLE IF NOT EXISTS reminder_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id    uuid REFERENCES weeks(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = group broadcast
  kind       text NOT NULL,        -- e.g. 'prompt_t12', 'submit_t2', 'vote_group', 'auto_close'
  channel    text,                -- 'sms' | 'email' | 'none'
  detail     text,                -- error text or recipient count, for debugging
  created_at timestamptz DEFAULT now()
);

-- user_id is nullable, and NULLs are never equal in a unique index, so group
-- broadcasts need their own partial index with a sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_user_unique
  ON reminder_log (week_id, user_id, kind) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_group_unique
  ON reminder_log (week_id, kind) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS reminder_log_week_idx ON reminder_log (week_id);

ALTER TABLE reminder_log ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. Nothing client-side reads this.

-- 3. Per-league automation switches. Defaults are ON for nudges but the host
--    can turn off auto-advance per league if a group prefers to wait for
--    stragglers.
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS reminders_enabled boolean DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS auto_advance_enabled boolean DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles';

-- 4. Marker so an auto-advanced round is distinguishable from a host-driven one
--    (useful when debugging "why did voting open at 3am").
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS auto_closed_at timestamptz;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS auto_revealed_at timestamptz;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS prompt_reassigned_at timestamptz;

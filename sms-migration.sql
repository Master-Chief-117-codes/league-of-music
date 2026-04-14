-- ─── SMS / timed reminder migration ───
-- Run in Supabase SQL Editor after voting-migration.sql

-- 1. Phone number on profiles (E.164 format, e.g. +12125551234)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. Dedup guards on weeks so we never send the same reminder twice
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS submission_reminder_sent_at timestamptz;
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS prompt_reminder_sent_at timestamptz;

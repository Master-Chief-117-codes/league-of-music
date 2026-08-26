-- Resubmission: one song per user per week, enforced by the database.
--
-- submit-song now replaces an existing row instead of rejecting the request, so
-- the application-level "already submitted" check is gone. That check was the
-- only thing preventing duplicates; a double-tap or a second tab could race past
-- it. Production already carries one user with two rows in a single week.
--
-- NOTE: this fails if any (week_id, user_id) pair already has more than one row.
-- Resolve those first:
--   select week_id, user_id, count(*) from song_submissions group by 1,2 having count(*) > 1;

ALTER TABLE public.song_submissions
  ADD CONSTRAINT song_submissions_week_user_unique UNIQUE (week_id, user_id);

-- Resubmission: one song per user per week, enforced by the database.
--
-- submit-song now replaces an existing row instead of rejecting the request, so
-- the application-level "already submitted" check is gone. That check was the
-- only thing preventing duplicates; a double-tap or a second tab could race past
-- it. The guarantee moves into the database.
--
-- A table-wide UNIQUE (week_id, user_id) is the clean form, and that is what the
-- dev project uses. Production could not take it: week 05a226ae (March, long
-- finished) carries one user with two rows, and Postgres refuses the constraint
-- while any violating row exists anywhere in the table. Deleting one of them
-- would have cascaded away real votes from a completed round, so production got
-- a partial index that excludes that single dead week instead.
--
-- Check before choosing which form to apply:
--   select week_id, user_id, count(*) from song_submissions group by 1,2 having count(*) > 1;

-- Clean databases (dev, and any new environment):
-- ALTER TABLE public.song_submissions
--   ADD CONSTRAINT song_submissions_week_user_unique UNIQUE (week_id, user_id);

-- Production, carrying one legacy duplicate:
CREATE UNIQUE INDEX song_submissions_week_user_unique
  ON public.song_submissions (week_id, user_id)
  WHERE week_id <> '05a226ae-a142-49a7-ac35-250c8dd968ae';

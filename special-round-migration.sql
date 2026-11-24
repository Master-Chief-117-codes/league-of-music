-- Special rounds: a one-off round (a holiday edition, say) that takes over a league
-- while the regular round freezes, then hands back to it.
--
--   is_special  marks the one-off round. It is unscored and sits outside the prompt
--               rotation and the no-repeats rule.
--   paused_at   set on the regular round that was in progress when a special round
--               started. Resuming shifts that round's deadlines by the time spent
--               paused and clears this.
--   no_voting   a share-only special round: songs, reactions and comments, no ranking.
--
-- A special round that has been wrapped up gets status = 'done' (alongside the existing
-- 'active' and 'pending_prompt'), which takes it out of the running for "current round".
--
-- Run this BEFORE deploying the code: the round lookup filters on paused_at, so against
-- a database without it that query errors and no league can open its round.

ALTER TABLE public.weeks
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at  timestamptz,
  ADD COLUMN IF NOT EXISTS no_voting  boolean NOT NULL DEFAULT false;

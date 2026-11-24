const DEADLINE_FIELDS = ["deadline", "vote_deadline", "prompt_deadline"] as const;
type DeadlineField = (typeof DEADLINE_FIELDS)[number];

/**
 * Deadlines are absolute timestamps, so they keep running while a round is paused.
 * On resume, push each one forward by the time spent paused: the round gets back exactly
 * the time it had left when it froze. A deadline that had already passed stays passed,
 * since it moves by the same amount the clock did.
 */
export function shiftDeadlines(
  week: Partial<Record<DeadlineField, string | null>>,
  pausedAt: string,
  resumedAt: Date
): Partial<Record<DeadlineField, string>> {
  const out: Partial<Record<DeadlineField, string>> = {};
  const pausedMs = resumedAt.getTime() - new Date(pausedAt).getTime();
  if (!Number.isFinite(pausedMs) || pausedMs <= 0) return out;
  for (const field of DEADLINE_FIELDS) {
    const value = week[field];
    if (!value) continue;
    const at = new Date(value).getTime();
    if (Number.isFinite(at)) out[field] = new Date(at + pausedMs).toISOString();
  }
  return out;
}

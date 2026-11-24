import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUBMISSION_WINDOW_HOURS = 48;
const MAX_PROMPT_LENGTH = 2000;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId, prompt, noVoting } = await req.json();
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!leagueId || !text) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (text.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: "That prompt is too long" }, { status: 400 });

  const { data: league } = await admin.from("leagues").select("created_by").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  // The round the league is on right now: newest one that is neither paused nor wrapped up.
  const { data: current } = await admin
    .from("weeks")
    .select("id, revealed, is_special")
    .eq("league_id", leagueId)
    .is("paused_at", null)
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current?.is_special) {
    return NextResponse.json({ error: "A special round is already running." }, { status: 409 });
  }

  const now = new Date();
  const { data: special, error } = await admin
    .from("weeks")
    .insert({
      league_id: leagueId,
      prompt: text,
      status: "active",
      is_special: true,
      no_voting: noVoting === true,
      prompt_author_id: user.id,
      prompt_submitted_at: now.toISOString(),
      deadline: new Date(now.getTime() + SUBMISSION_WINDOW_HOURS * 3600000).toISOString(),
      locked: false,
      revealed: false,
    })
    .select("id")
    .single();
  if (error || !special) {
    return NextResponse.json({ error: error?.message ?? "Failed to start the special round" }, { status: 500 });
  }

  // A round still in progress freezes until the special round is over. One that already
  // finished has nothing to resume, so the special round simply follows it.
  const pausing = current && !current.revealed ? current.id : null;
  if (pausing) {
    const { error: pauseError } = await admin.from("weeks").update({ paused_at: now.toISOString() }).eq("id", pausing);
    if (pauseError) {
      // Don't leave a special round running over a round that never froze.
      await admin.from("weeks").delete().eq("id", special.id);
      return NextResponse.json({ error: pauseError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, weekId: special.id, pausedWeekId: pausing });
}

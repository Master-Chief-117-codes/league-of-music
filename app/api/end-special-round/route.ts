import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { shiftDeadlines } from "../../lib/round-pause";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leagueId } = await req.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  const { data: league } = await admin.from("leagues").select("created_by").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  // Bring the paused round back first, then close out the special one. Doing it in this
  // order means a failure part-way leaves the special round still current, so the host
  // can simply try again.
  const now = new Date();
  const { data: paused } = await admin
    .from("weeks")
    .select("id, paused_at, deadline, vote_deadline, prompt_deadline")
    .eq("league_id", leagueId)
    .not("paused_at", "is", null);

  for (const week of paused ?? []) {
    const { error } = await admin
      .from("weeks")
      .update({ ...shiftDeadlines(week, week.paused_at, now), paused_at: null })
      .eq("id", week.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: doneError } = await admin
    .from("weeks")
    .update({ status: "done" })
    .eq("league_id", leagueId)
    .eq("is_special", true)
    .neq("status", "done");
  if (doneError) return NextResponse.json({ error: doneError.message }, { status: 500 });

  return NextResponse.json({ ok: true, resumed: (paused ?? []).length });
}

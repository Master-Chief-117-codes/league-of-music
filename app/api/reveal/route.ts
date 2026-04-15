import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RANK_PTS: Record<number, number> = { 1: 2, 2: 1.5, 3: 1 };

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekId, leagueId } = await req.json();
  if (!weekId || !leagueId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify caller is the league host
  const { data: league } = await admin.from("leagues").select("created_by, name").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  // Mark week revealed
  const { error } = await admin
    .from("weeks")
    .update({ revealed: true, locked: true })
    .eq("id", weekId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute scores from votes
  const [{ data: submissions }, { data: votes }] = await Promise.all([
    admin.from("song_submissions").select("id, user_id").eq("week_id", weekId),
    admin.from("song_votes").select("submission_id, rank").eq("week_id", weekId),
  ]);

  const scores: Record<string, number> = {};
  votes?.forEach((v: any) => {
    if (v.rank) scores[v.submission_id] = (scores[v.submission_id] || 0) + (RANK_PTS[v.rank] || 0);
  });

  const ranked = (submissions || [])
    .map((s: any) => ({ ...s, score: scores[s.id] || 0 }))
    .filter((s: any) => s.score > 0)
    .sort((a: any, b: any) => b.score - a.score);

  // Award league points: 3/2/1 to top 3 distinct score tiers
  const LEAGUE_PTS = [3, 2, 1];
  let tier = 0;
  let prevScore = -1;
  for (const s of ranked) {
    if (s.score !== prevScore) { tier++; prevScore = s.score; }
    if (tier > 3) break;
    await admin.rpc("add_league_points", {
      league_id_input: leagueId,
      user_id_input: s.user_id,
      points_to_add: LEAGUE_PTS[tier - 1],
    });
  }

  // Award win to top scorer(s)
  const topScore = ranked.length ? ranked[0].score : 0;
  if (topScore > 0) {
    for (const s of ranked.filter((s: any) => s.score === topScore)) {
      await admin.rpc("increment_league_wins", { league_id_input: leagueId, user_id_input: s.user_id });
    }
  }

  return NextResponse.json({ ok: true });
}

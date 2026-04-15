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

  // Email everyone that results are revealed
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { data: members } = await admin.from("league_members").select("user_id").eq("league_id", leagueId);
  const memberIds = (members || []).map((m: any) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("email").in("id", memberIds)
    : { data: [] };

  const emailAddrs = (profiles || []).map((p: any) => p.email).filter(Boolean);
  if (emailAddrs.length) {
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: emailAddrs,
        subject: `🎉 Votes revealed — see who won! (${league.name})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
            <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎉</div>
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">Votes are revealed!</h2>
            <p style="margin:0 0 24px;color:#aaa;font-size:15px">The results for <strong style="color:#fff">${league.name}</strong> are in. See who won!</p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">See the results →</a>
          </div>
        `,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const { data: league } = await admin.from("leagues").select("created_by, current_season").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: members } = await admin.from("league_members").select("user_id, wins, points").eq("league_id", leagueId);
  const { data: profiles } = await admin.from("profiles").select("id, name, avatar_url").in("id", (members || []).map((m: any) => m.user_id));

  const results = (members || []).map((m: any) => {
    const p = (profiles || []).find((pr: any) => pr.id === m.user_id);
    return { user_id: m.user_id, name: p?.name ?? "Unknown", avatar_url: p?.avatar_url ?? null, wins: m.wins ?? 0, points: m.points ?? 0 };
  });

  await admin.from("season_snapshots").insert({ league_id: leagueId, season_number: league.current_season ?? 1, results });
  await admin.from("leagues").update({ season_over: true }).eq("id", leagueId);

  return NextResponse.json({ ok: true });
}

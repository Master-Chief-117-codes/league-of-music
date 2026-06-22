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

  const nextSeason = (league.current_season ?? 1) + 1;

  await admin.from("league_members").update({ wins: 0, points: 0 }).eq("league_id", leagueId);
  await admin.from("leagues").update({ season_over: false, current_season: nextSeason }).eq("id", leagueId);

  return NextResponse.json({ ok: true, season: nextSeason });
}

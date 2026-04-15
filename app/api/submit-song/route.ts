import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getTrackId = (url: string) =>
  url.match(/open\.spotify\.com(?:\/intl-[\w-]+)?\/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekId, leagueId, spotifyUrl } = await req.json();
  if (!weekId || !leagueId || !spotifyUrl?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!getTrackId(spotifyUrl.trim())) {
    return NextResponse.json({ error: "Invalid Spotify URL" }, { status: 400 });
  }

  // Verify week is active and accepting submissions
  const { data: week } = await admin
    .from("weeks")
    .select("id, status, locked, prompt, leagues(name, created_by), sms_5_sent")
    .eq("id", weekId)
    .single();

  if (!week || week.status !== "active" || week.locked) {
    return NextResponse.json({ error: "Submissions are closed" }, { status: 400 });
  }

  // Prevent double submission
  const { data: existing } = await admin
    .from("song_submissions")
    .select("id")
    .eq("week_id", weekId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already submitted" }, { status: 400 });

  const { error } = await admin.from("song_submissions").insert({
    week_id: weekId,
    user_id: user.id,
    spotify_url: spotifyUrl.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if all league members have now submitted (#5)
  if (!(week as any).sms_5_sent) {
    const [{ data: members }, { data: submissions }] = await Promise.all([
      admin.from("league_members").select("user_id").eq("league_id", leagueId),
      admin.from("song_submissions").select("user_id").eq("week_id", weekId),
    ]);
    const memberIds = new Set((members || []).map((m: any) => m.user_id));
    const submittedIds = new Set((submissions || []).map((s: any) => s.user_id));
    const allSubmitted = [...memberIds].every((id) => submittedIds.has(id));

    if (allSubmitted && memberIds.size > 0) {
      await fireAllSubmitted(weekId, leagueId, week);
    }
  }

  return NextResponse.json({ ok: true });
}

async function fireAllSubmitted(weekId: string, leagueId: string, week: any) {
  const now = new Date().toISOString();
  await admin.from("weeks").update({ sms_5_sent: true, all_submitted_at: now }).eq("id", weekId);
}

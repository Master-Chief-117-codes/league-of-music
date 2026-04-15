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

  const leagueName = week.leagues?.name ?? "League of Music";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: members } = await admin.from("league_members").select("user_id").eq("league_id", leagueId);
  const memberIds = (members || []).map((m: any) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("email, name").in("id", memberIds)
    : { data: [] };

  const emailAddrs = (profiles || []).map((p: any) => p.email).filter(Boolean);
  if (emailAddrs.length) {
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: emailAddrs,
        subject: `🎵 All songs are in — time to vote! (${leagueName})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
            <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">All songs are in!</h2>
            <p style="margin:0 0 24px;color:#aaa;font-size:15px">Submissions are closed for <strong style="color:#fff">${leagueName}</strong>. Listen, comment, and lock in your votes — 48 hours!</p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Open League of Music →</a>
          </div>
        `,
      }),
    }).catch(() => {});
  }
}

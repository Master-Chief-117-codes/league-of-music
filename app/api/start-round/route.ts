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

  // Verify caller is the host of this league
  const { data: league } = await admin
    .from("leagues")
    .select("created_by, name")
    .eq("id", leagueId)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  const [{ data: leagueMembers }, { data: pastWeeks }] = await Promise.all([
    admin.from("league_members").select("user_id").eq("league_id", leagueId),
    admin.from("weeks").select("prompt_author_id").eq("league_id", leagueId).not("prompt_author_id", "is", null),
  ]);

  if (!leagueMembers?.length) {
    return NextResponse.json({ error: "No players in this league yet" }, { status: 400 });
  }

  // Round-robin: pick from those with minimum prompt-author count
  const authorCounts: Record<string, number> = {};
  leagueMembers.forEach((m: any) => { authorCounts[m.user_id] = 0; });
  pastWeeks?.forEach((w: any) => {
    if (w.prompt_author_id && authorCounts[w.prompt_author_id] !== undefined) {
      authorCounts[w.prompt_author_id]++;
    }
  });
  const minCount = Math.min(...Object.values(authorCounts));
  const eligible = Object.entries(authorCounts)
    .filter(([, count]) => count === minCount)
    .map(([id]) => id);
  const authorId = eligible[Math.floor(Math.random() * eligible.length)];
  const promptDeadline = new Date(Date.now() + 24 * 3600000).toISOString();

  const { error } = await admin.from("weeks").insert({
    status: "pending_prompt",
    prompt_author_id: authorId,
    prompt_deadline: promptDeadline,
    locked: false,
    revealed: false,
    league_id: leagueId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the selected author (#1) — fire and forget
  const { data: authorProfile } = await admin
    .from("profiles")
    .select("email, name, phone")
    .eq("id", authorId)
    .single();

  if (authorProfile) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const deadlineStr = new Date(promptDeadline).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: authorProfile.email,
        subject: `🎵 It's your turn to pick this week's prompt! (${league.name})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
            <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
            <h2 style="margin:0 0 6px;font-size:20px;font-weight:700">Your turn, ${authorProfile.name}!</h2>
            <p style="margin:0 0 8px;color:#aaa;font-size:15px">You've been selected to submit this week's prompt for <strong style="color:#fff">${league.name}</strong>.</p>
            <p style="margin:0 0 24px;color:#666;font-size:13px">Submit by: <strong style="color:#fff">${deadlineStr}</strong></p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Submit Your Prompt →</a>
            <p style="margin:24px 0 0;color:#555;font-size:12px">If you don't submit in time, the host will submit a prompt on your behalf.</p>
          </div>
        `,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

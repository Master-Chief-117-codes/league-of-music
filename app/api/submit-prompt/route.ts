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

  const { weekId, prompt } = await req.json();
  if (!weekId || !prompt?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Get week + verify authorization
  const { data: week } = await admin
    .from("weeks")
    .select("prompt_author_id, league_id, leagues(created_by, name)")
    .eq("id", weekId)
    .single();

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const leagueHost = (week as any).leagues?.created_by;
  const isAuthor = week.prompt_author_id === user.id;
  const isHost = leagueHost === user.id;

  if (!isAuthor && !isHost) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const deadline = new Date(Date.now() + 48 * 3600000).toISOString();
  const { error } = await admin
    .from("weeks")
    .update({ status: "active", prompt: prompt.trim(), deadline })
    .eq("id", weekId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email only members of this league (fire and forget)
  if (week.league_id) {
    const { data: members } = await admin
      .from("league_members")
      .select("user_id")
      .eq("league_id", week.league_id);

    const memberIds = (members || []).map((m: any) => m.user_id);
    const { data: profiles } = memberIds.length
      ? await admin.from("profiles").select("email").in("id", memberIds)
      : { data: [] };

    const emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
    const leagueName = (week as any).leagues?.name ?? "League of Music";

    if (emails.length) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: emails,
          subject: `🎵 New round in ${leagueName}: ${prompt.trim()}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
              <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
              <h2 style="margin:0 0 6px;font-size:20px;font-weight:700">New Round — ${leagueName}</h2>
              <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#22c55e">${prompt.trim()}</p>
              <p style="margin:0 0 24px;color:#888;font-size:14px">Submit your song — submissions close in 48 hours.</p>
              <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Open League of Music →</a>
            </div>
          `,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

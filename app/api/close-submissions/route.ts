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

  const { weekId, leagueId } = await req.json();
  if (!weekId || !leagueId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: league } = await admin.from("leagues").select("created_by, name").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("weeks")
    .update({ locked: true, sms_5_sent: true, all_submitted_at: now })
    .eq("id", weekId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email all members
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
        subject: `🎵 All songs are in — time to vote! (${league.name})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
            <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">All songs are in!</h2>
            <p style="margin:0 0 24px;color:#aaa;font-size:15px">Submissions are closed for <strong style="color:#fff">${league.name}</strong>. Listen, comment, and lock in your votes — 48 hours!</p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Open League of Music →</a>
          </div>
        `,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

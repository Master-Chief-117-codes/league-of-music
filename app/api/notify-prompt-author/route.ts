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

  const { authorId, deadline } = await req.json();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", authorId)
    .single();

  if (!profile?.email) return NextResponse.json({ ok: true });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: profile.email,
      subject: `🎵 It's your turn to pick this week's prompt!`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:20px">🎵</div>
          <h2 style="margin:0 0 6px;font-size:20px;font-weight:700">Your turn, ${profile.name}!</h2>
          <p style="margin:0 0 20px;color:#aaa;font-size:15px">You've been selected to submit this week's prompt for League of Music.</p>
          ${deadlineStr ? `<p style="margin:0 0 24px;color:#666;font-size:13px">Submit by: <strong style="color:#fff">${deadlineStr}</strong></p>` : ""}
          <a href="${appUrl}"
             style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">
            Submit Your Prompt →
          </a>
          <p style="margin:24px 0 0;color:#555;font-size:12px">If you don't submit within 48 hours, the host will submit a prompt on your behalf.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

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

  const { prompt } = await req.json();

  const { data: profiles } = await admin.from("profiles").select("email, name");
  const emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
  if (!emails.length) return NextResponse.json({ ok: true });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: emails,
      subject: `🎵 New round: ${prompt}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:20px">🎵</div>
          <h2 style="margin:0 0 6px;font-size:20px;font-weight:700">New Round Started</h2>
          <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#22c55e">${prompt}</p>
          <p style="margin:0 0 24px;color:#888;font-size:14px">Submit your song now before submissions close.</p>
          <a href="${appUrl}"
             style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">
            Open League of Music →
          </a>
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

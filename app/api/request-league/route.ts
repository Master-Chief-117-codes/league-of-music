import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "343fluffy@gmail.com";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Missing league name" }, { status: 400 });

  const { data: profile } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .single();

  const { data: request, error: reqError } = await admin
    .from("league_requests")
    .insert({ name: name.trim(), requested_by: user.id })
    .select("approval_token")
    .single();

  if (reqError || !request) {
    return NextResponse.json({ error: reqError?.message ?? "Failed to create request" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const approveUrl = `${appUrl}/api/approve-league?token=${request.approval_token}`;
  const requesterName = profile?.name ?? "Someone";
  const requesterEmail = profile?.email ?? user.email ?? "unknown";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `League creation request: ${name.trim()}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">New League Request</h2>
          <p style="margin:0 0 4px;color:#aaa;font-size:15px">
            <strong style="color:#fff">${requesterName}</strong> (${requesterEmail}) wants to create:
          </p>
          <p style="margin:16px 0 24px;font-size:24px;font-weight:700;color:#22c55e">${name.trim()}</p>
          <a href="${approveUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">
            Approve League →
          </a>
          <p style="margin:24px 0 0;color:#555;font-size:12px">
            Clicking approve will create the league and email ${requesterEmail}.
          </p>
        </div>
      `,
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const { data: week } = await admin
    .from("weeks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!week) return NextResponse.json({ ok: true, skipped: "no_week" });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Pending prompt — remind only the author if deadline is within 24h
  if (week.status === "pending_prompt") {
    if (!week.prompt_deadline) return NextResponse.json({ ok: true, skipped: "no_deadline" });
    const hoursLeft = (new Date(week.prompt_deadline).getTime() - Date.now()) / 3600000;
    if (hoursLeft > 24) return NextResponse.json({ ok: true, skipped: "not_urgent" });

    const { data: author } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", week.prompt_author_id)
      .single();
    if (!author?.email) return NextResponse.json({ ok: true });

    await sendEmail(
      [author.email],
      `⏰ Reminder: submit your League of Music prompt!`,
      `<p>Hey ${author.name}, you have less than 24 hours to submit this week's prompt.</p>`,
      appUrl
    );
    return NextResponse.json({ ok: true });
  }

  const { data: profiles } = await admin.from("profiles").select("email, name");
  const emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
  if (!emails.length) return NextResponse.json({ ok: true });

  // Active, submissions open
  if (week.status === "active" && !week.locked) {
    await sendEmail(
      emails,
      `🎵 Reminder: submit your song for "${week.prompt}"`,
      `<p>Submissions are still open for this week's round: <strong>${week.prompt}</strong>. Don't forget to drop your track!</p>`,
      appUrl
    );
    return NextResponse.json({ ok: true });
  }

  // Locked, voting open
  if (week.locked && !week.revealed) {
    await sendEmail(
      emails,
      `🗳️ Voting is open — cast your votes for "${week.prompt}"`,
      `<p>Submissions are locked for <strong>${week.prompt}</strong>. Head over and vote for your favorites!</p>`,
      appUrl
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, skipped: "round_complete" });
}

async function sendEmail(to: string[], subject: string, bodyHtml: string, appUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;display:flex;align-items:center;justify-content:center">🎵</div>
          ${bodyHtml}
          <div style="margin-top:24px">
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">
              Open League of Music →
            </a>
          </div>
        </div>
      `,
    }),
  });
  if (!res.ok) console.error("Resend cron error:", await res.text());
}

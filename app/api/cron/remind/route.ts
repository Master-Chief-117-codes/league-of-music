import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/twilio";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // Verify Vercel cron secret (set CRON_SECRET in env vars)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  const in75min = new Date(now.getTime() + 75 * 60_000);

  const results: string[] = [];

  // ── 1. Submission deadline reminders ────────────────────────────────────
  // Find active weeks whose deadline is within the next 75 minutes and
  // haven't been reminded yet.
  const { data: submissionWeeks } = await admin
    .from("weeks")
    .select("id, prompt, league_id, leagues(name)")
    .eq("status", "active")
    .eq("revealed", false)
    .is("submission_reminder_sent_at", null)
    .lte("deadline", in75min.toISOString())
    .gt("deadline", now.toISOString());

  for (const week of submissionWeeks || []) {
    const leagueName = (week as any).leagues?.name ?? "League of Music";

    // Get members of this league who haven't submitted yet
    const { data: members } = await admin
      .from("league_members")
      .select("user_id")
      .eq("league_id", week.league_id);

    const { data: submitted } = await admin
      .from("song_submissions")
      .select("user_id")
      .eq("week_id", week.id);

    const submittedIds = new Set((submitted || []).map((s: any) => s.user_id));
    const pendingIds = (members || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => !submittedIds.has(id));

    if (!pendingIds.length) {
      await admin.from("weeks").update({ submission_reminder_sent_at: now.toISOString() }).eq("id", week.id);
      results.push(`week ${week.id}: all submitted, skipped`);
      continue;
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, phone, email")
      .in("id", pendingIds);

    const msg = `🎵 ~1 hour left to submit your song for "${week.prompt}" in ${leagueName}! ${appUrl}`;

    for (const p of profiles || []) {
      if (p.phone) {
        await sendSms(p.phone, msg);
        results.push(`SMS → ${p.name} (submission)`);
      } else if (p.email) {
        await sendReminderEmail(
          p.email,
          `⏰ ~1 hour left to submit your song — ${leagueName}`,
          `<p>Hey ${p.name}! You have about an hour to submit your track for <strong>${week.prompt}</strong> in ${leagueName}.</p>`,
          appUrl
        );
        results.push(`Email → ${p.name} (submission)`);
      }
    }

    await admin.from("weeks").update({ submission_reminder_sent_at: now.toISOString() }).eq("id", week.id);
  }

  // ── 2. Prompt deadline reminders ─────────────────────────────────────────
  // Find pending_prompt weeks whose prompt_deadline is within 75 minutes
  // and haven't been reminded yet.
  const { data: promptWeeks } = await admin
    .from("weeks")
    .select("id, prompt_author_id, league_id, leagues(name)")
    .eq("status", "pending_prompt")
    .is("prompt_reminder_sent_at", null)
    .lte("prompt_deadline", in75min.toISOString())
    .gt("prompt_deadline", now.toISOString());

  for (const week of promptWeeks || []) {
    const leagueName = (week as any).leagues?.name ?? "League of Music";

    const { data: author } = await admin
      .from("profiles")
      .select("name, phone, email")
      .eq("id", week.prompt_author_id)
      .single();

    if (author?.phone) {
      await sendSms(
        author.phone,
        `🎵 ~1 hour left to submit this week's prompt for ${leagueName}! ${appUrl}`
      );
      results.push(`SMS → ${author.name} (prompt)`);
    } else if (author?.email) {
      await sendReminderEmail(
        author.email,
        `⏰ ~1 hour left to submit your prompt — ${leagueName}`,
        `<p>Hey ${author.name}! You have about an hour to submit this week's prompt for <strong>${leagueName}</strong>.</p>`,
        appUrl
      );
      results.push(`Email → ${author.name} (prompt)`);
    }

    await admin.from("weeks").update({ prompt_reminder_sent_at: now.toISOString() }).eq("id", week.id);
  }

  return NextResponse.json({ ok: true, results });
}

async function sendReminderEmail(to: string, subject: string, bodyHtml: string, appUrl: string) {
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
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
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
  if (!res.ok) console.error("Resend error:", await res.text());
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/twilio";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  const results: string[] = [];

  // Helper: cutoff = X hours ago
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

  // ── #2: Prompt reminder — 23h after round started, prompt not yet submitted ──
  {
    const { data: weeks } = await admin
      .from("weeks")
      .select("id, prompt_author_id, leagues(name)")
      .eq("status", "pending_prompt")
      .eq("sms_2_sent", false)
      .lte("created_at", hoursAgo(23));

    for (const week of weeks || []) {
      const { data: author } = await admin
        .from("profiles").select("phone, email, name").eq("id", week.prompt_author_id).single();
      const leagueName = (week as any).leagues?.name ?? "League of Music";

      if (author?.phone) {
        await sendSms(author.phone, `⏰ 1 hour left to create a prompt for ${leagueName}! ${appUrl}`);
        results.push(`#2 SMS → ${author.name}`);
      } else if (author?.email) {
        await sendEmail(author.email, `⏰ 1 hour left to submit your prompt — ${leagueName}`,
          `<p>Hey ${author.name}, you have about 1 hour left to submit this week's prompt for <strong>${leagueName}</strong>.</p>`, appUrl);
        results.push(`#2 email → ${author.name}`);
      }
      await admin.from("weeks").update({ sms_2_sent: true }).eq("id", week.id);
    }
  }

  // ── #4: Song submission reminder — 23h after prompt submitted (1h before 24h deadline) ──
  {
    const { data: weeks } = await admin
      .from("weeks")
      .select("id, prompt, league_id, leagues(name)")
      .eq("status", "active")
      .eq("sms_4_sent", false)
      .not("prompt_submitted_at", "is", null)
      .lte("prompt_submitted_at", hoursAgo(23));

    for (const week of weeks || []) {
      const leagueName = (week as any).leagues?.name ?? "League of Music";

      // Only notify members who haven't submitted
      const [{ data: members }, { data: submitted }] = await Promise.all([
        admin.from("league_members").select("user_id").eq("league_id", week.league_id),
        admin.from("song_submissions").select("user_id").eq("week_id", week.id),
      ]);
      const submittedIds = new Set((submitted || []).map((s: any) => s.user_id));
      const pendingIds = (members || []).map((m: any) => m.user_id).filter((id: string) => !submittedIds.has(id));

      if (pendingIds.length) {
        const { data: profiles } = await admin.from("profiles").select("phone, email, name").in("id", pendingIds);
        for (const p of profiles || []) {
          if (p.phone) {
            await sendSms(p.phone, `⏰ 1 hour left to submit your song for "${week.prompt}" — ${leagueName}! ${appUrl}`);
            results.push(`#4 SMS → ${p.name}`);
          } else if (p.email) {
            await sendEmail(p.email, `⏰ 1 hour left to submit — ${leagueName}`,
              `<p>Hey ${p.name}! 1 hour left to submit your song for <strong>${week.prompt}</strong> in ${leagueName}.</p>`, appUrl);
            results.push(`#4 email → ${p.name}`);
          }
        }
      }
      await admin.from("weeks").update({ sms_4_sent: true }).eq("id", week.id);
    }
  }

  // ── #5 fallback: 24h after prompt submitted, fire "songs in" notification regardless ──
  {
    const { data: weeks } = await admin
      .from("weeks")
      .select("id, league_id, leagues(name)")
      .eq("status", "active")
      .eq("sms_5_sent", false)
      .not("prompt_submitted_at", "is", null)
      .lte("prompt_submitted_at", hoursAgo(24));

    for (const week of weeks || []) {
      const leagueName = (week as any).leagues?.name ?? "League of Music";
      const nowStr = now.toISOString();

      await admin.from("weeks").update({ sms_5_sent: true, all_submitted_at: nowStr }).eq("id", week.id);

      const { data: members } = await admin.from("league_members").select("user_id").eq("league_id", week.league_id);
      const memberIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = memberIds.length
        ? await admin.from("profiles").select("phone, email, name").in("id", memberIds)
        : { data: [] };

      for (const p of profiles || []) {
        if (p.phone) {
          await sendSms(p.phone, `🎵 Songs are in for ${leagueName}! 48 hours to comment and vote. ${appUrl}`);
          results.push(`#5 fallback SMS → ${p.name}`);
        } else if (p.email) {
          await sendEmail(p.email, `🎵 Submissions closed — time to vote! (${leagueName})`,
            `<p>Submissions are closed for <strong>${leagueName}</strong>. Head over to comment and vote — 48 hours!</p>`, appUrl);
          results.push(`#5 fallback email → ${p.name}`);
        }
      }
    }
  }

  // ── #6: Vote reminder — 47h after all_submitted_at (1h before 48h voting window closes) ──
  {
    const { data: weeks } = await admin
      .from("weeks")
      .select("id, league_id, leagues(name)")
      .eq("sms_5_sent", true)
      .eq("sms_6_sent", false)
      .eq("revealed", false)
      .not("all_submitted_at", "is", null)
      .lte("all_submitted_at", hoursAgo(47));

    for (const week of weeks || []) {
      const leagueName = (week as any).leagues?.name ?? "League of Music";

      // Only notify members who haven't locked in votes
      const [{ data: members }, { data: locks }] = await Promise.all([
        admin.from("league_members").select("user_id").eq("league_id", week.league_id),
        admin.from("vote_locks").select("user_id").eq("week_id", week.id),
      ]);
      const lockedIds = new Set((locks || []).map((l: any) => l.user_id));
      const pendingIds = (members || []).map((m: any) => m.user_id).filter((id: string) => !lockedIds.has(id));

      if (pendingIds.length) {
        const { data: profiles } = await admin.from("profiles").select("phone, email, name").in("id", pendingIds);
        for (const p of profiles || []) {
          if (p.phone) {
            await sendSms(p.phone, `⏰ 1 hour left to lock in your votes for ${leagueName}! ${appUrl}`);
            results.push(`#6 SMS → ${p.name}`);
          } else if (p.email) {
            await sendEmail(p.email, `⏰ 1 hour left to vote — ${leagueName}`,
              `<p>Hey ${p.name}! 1 hour left to lock in your votes for <strong>${leagueName}</strong>.</p>`, appUrl);
            results.push(`#6 email → ${p.name}`);
          }
        }
      }
      await admin.from("weeks").update({ sms_6_sent: true }).eq("id", week.id);
    }
  }

  // ── #7 fallback: 48h after all_submitted_at — notify host regardless ──
  {
    const { data: weeks } = await admin
      .from("weeks")
      .select("id, league_id, leagues(name, created_by)")
      .eq("sms_5_sent", true)
      .eq("sms_7_sent", false)
      .eq("revealed", false)
      .not("all_submitted_at", "is", null)
      .lte("all_submitted_at", hoursAgo(48));

    for (const week of weeks || []) {
      const leagueName = (week as any).leagues?.name ?? "League of Music";
      const hostId = (week as any).leagues?.created_by;

      await admin.from("weeks").update({ sms_7_sent: true }).eq("id", week.id);

      if (hostId) {
        const { data: host } = await admin.from("profiles").select("phone, email, name").eq("id", hostId).single();
        if (host?.phone) {
          await sendSms(host.phone, `🔒 Voting window closed for ${leagueName}! Ready to reveal? ${appUrl}`);
          results.push(`#7 fallback SMS → ${host.name}`);
        } else if (host?.email) {
          await sendEmail(host.email, `🔒 Voting closed — time to reveal! (${leagueName})`,
            `<p>The 48-hour voting window for <strong>${leagueName}</strong> has passed. Head over to reveal the results!</p>`, appUrl);
          results.push(`#7 fallback email → ${host.name}`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}

async function sendEmail(to: string, subject: string, bodyHtml: string, appUrl: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
          <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
          ${bodyHtml}
          <div style="margin-top:24px">
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Open League of Music →</a>
          </div>
        </div>
      `,
    }),
  }).catch(() => {});
}

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function page(body: string) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>League of Music</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{max-width:420px;width:100%;text-align:center}.icon{width:52px;height:52px;border-radius:14px;margin:0 auto 20px;font-size:26px;line-height:52px}h2{font-size:22px;font-weight:700;margin-bottom:8px}p{color:#aaa;font-size:15px;line-height:1.5}a{display:inline-block;margin-top:24px;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none}</style></head><body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return page(`<div class="icon" style="background:#ef4444">❌</div><h2>Invalid link</h2><p>This approval link is missing a token.</p>`);
  }

  const { data: request } = await admin
    .from("league_requests")
    .select("*")
    .eq("approval_token", token)
    .eq("status", "pending")
    .single();

  if (!request) {
    return page(`<div class="icon" style="background:#f59e0b">⚠️</div><h2>Already processed</h2><p>This league request has already been approved, or the link is invalid.</p>`);
  }

  // Create the league
  const { data: league, error: leagueError } = await admin
    .from("leagues")
    .insert({ name: request.name, created_by: request.requested_by })
    .select("id")
    .single();

  if (leagueError || !league) {
    return page(`<div class="icon" style="background:#ef4444">❌</div><h2>Error</h2><p>${leagueError?.message ?? "Failed to create league. Try again."}</p>`);
  }

  // Add creator as first member
  await admin.from("league_members").insert({
    league_id: league.id,
    user_id: request.requested_by,
  });

  // Mark request as approved
  await admin
    .from("league_requests")
    .update({ status: "approved" })
    .eq("approval_token", token);

  // Email the requester
  const { data: profile } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", request.requested_by)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (profile?.email) {
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: profile.email,
        subject: `🎵 Your league "${request.name}" is live!`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#000;color:#fff;border-radius:16px">
            <div style="width:40px;height:40px;background:#22c55e;border-radius:10px;margin-bottom:20px;font-size:20px;line-height:40px;text-align:center">🎵</div>
            <h2 style="margin:0 0 6px;font-size:20px;font-weight:700">Your league is live, ${profile.name}!</h2>
            <p style="margin:0 0 20px;color:#aaa;font-size:15px">
              <strong style="color:#fff">${request.name}</strong> has been approved. You're the host — invite your friends and start a round!
            </p>
            <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#22c55e;color:#000;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">
              Open League of Music →
            </a>
          </div>
        `,
      }),
    }).catch(() => {});
  }

  return page(
    `<div class="icon" style="background:#22c55e">🎵</div><h2 style="color:#22c55e">League approved!</h2><p><strong style="color:#fff">${request.name}</strong> is now live. ${profile?.name ?? "The requester"} has been notified.</p><a href="${appUrl}">Open App →</a>`
  );
}

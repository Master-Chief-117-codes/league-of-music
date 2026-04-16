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

  const now = new Date();
  const voteDeadline = new Date(now.getTime() + 48 * 3600000).toISOString();
  const { error } = await admin.from("weeks")
    .update({ locked: true, sms_5_sent: true, all_submitted_at: now.toISOString(), vote_deadline: voteDeadline })
    .eq("id", weekId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

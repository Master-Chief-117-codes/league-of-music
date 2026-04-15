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

  const { data: week } = await admin
    .from("weeks")
    .select("prompt_author_id, league_id, leagues(created_by, name)")
    .eq("id", weekId)
    .single();

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  const leagueHost = (week as any).leagues?.created_by;
  const isAuthor = week.prompt_author_id === user.id;
  const isHost = leagueHost === user.id;
  if (!isAuthor && !isHost) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const now = new Date();
  // Submission window: 24 hours
  const deadline = new Date(now.getTime() + 24 * 3600000).toISOString();

  const { error } = await admin
    .from("weeks")
    .update({
      status: "active",
      prompt: prompt.trim(),
      deadline,
      prompt_submitted_at: now.toISOString(),
    })
    .eq("id", weekId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

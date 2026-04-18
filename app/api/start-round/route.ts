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

  const { leagueId, overrideAuthorId } = await req.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  // Verify caller is the host of this league
  const { data: league } = await admin
    .from("leagues")
    .select("created_by, name")
    .eq("id", leagueId)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  const [{ data: leagueMembers }, { data: pastWeeks }] = await Promise.all([
    admin.from("league_members").select("user_id").eq("league_id", leagueId),
    admin.from("weeks").select("prompt_author_id").eq("league_id", leagueId).not("prompt_author_id", "is", null),
  ]);

  if (!leagueMembers?.length) {
    return NextResponse.json({ error: "No players in this league yet" }, { status: 400 });
  }

  // Use override if host manually picked someone, otherwise round-robin
  let authorId: string;
  if (overrideAuthorId && leagueMembers.some((m: any) => m.user_id === overrideAuthorId)) {
    authorId = overrideAuthorId;
  } else {
    const authorCounts: Record<string, number> = {};
    leagueMembers.forEach((m: any) => { authorCounts[m.user_id] = 0; });
    pastWeeks?.forEach((w: any) => {
      if (w.prompt_author_id && authorCounts[w.prompt_author_id] !== undefined) {
        authorCounts[w.prompt_author_id]++;
      }
    });
    const minCount = Math.min(...Object.values(authorCounts));
    const eligible = Object.entries(authorCounts)
      .filter(([, count]) => count === minCount)
      .map(([id]) => id);
    authorId = eligible[Math.floor(Math.random() * eligible.length)];
  }
  const promptDeadline = new Date(Date.now() + 24 * 3600000).toISOString();

  const { error } = await admin.from("weeks").insert({
    status: "pending_prompt",
    prompt_author_id: authorId,
    prompt_deadline: promptDeadline,
    locked: false,
    revealed: false,
    league_id: leagueId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, promptAuthorId: authorId });
}

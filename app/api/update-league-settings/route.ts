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

  const { leagueId, votingRequirements, seasonTheme } = await req.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  const { data: league } = await admin.from("leagues").select("created_by").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Build the patch from whatever the caller actually sent. Writing every column
  // unconditionally would let a theme-only save blank out voting_requirements.
  const updates: Record<string, unknown> = {};
  if (votingRequirements !== undefined) updates.voting_requirements = votingRequirements;
  if (seasonTheme !== undefined) {
    const trimmed = typeof seasonTheme === "string" ? seasonTheme.trim() : "";
    updates.season_theme = trimmed ? trimmed.slice(0, 80) : null;  // empty clears it
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin.from("leagues").update(updates).eq("id", leagueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

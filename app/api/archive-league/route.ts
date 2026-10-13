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

  const { leagueId, archived } = await req.json();
  if (!leagueId || typeof archived !== "boolean") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: league } = await admin.from("leagues").select("created_by").eq("id", leagueId).single();
  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  // Archiving only hides the league; nothing is deleted, so clearing the stamp restores it.
  const { error } = await admin
    .from("leagues")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", leagueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

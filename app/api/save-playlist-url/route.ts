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

  const { weekId, playlistUrl } = await req.json();
  if (!weekId) return NextResponse.json({ error: "Missing weekId" }, { status: 400 });

  // Verify user is the host of the league this week belongs to
  const { data: week } = await admin
    .from("weeks")
    .select("id, league_id, leagues(created_by)")
    .eq("id", weekId)
    .single();

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });
  if ((week.leagues as any)?.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("weeks")
    .update({ playlist_url: playlistUrl ?? null })
    .eq("id", weekId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

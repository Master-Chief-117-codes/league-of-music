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

  const { leagueId, memberId } = await req.json();
  if (!leagueId || !memberId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify caller is the host
  const { data: league } = await admin
    .from("leagues")
    .select("created_by")
    .eq("id", leagueId)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  // Host cannot remove themselves
  if (memberId === user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const { error } = await admin
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

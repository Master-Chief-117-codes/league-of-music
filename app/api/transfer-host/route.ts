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

  const { leagueId, newHostId } = await req.json();
  if (!leagueId || !newHostId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify caller is current host
  const { data: league } = await admin
    .from("leagues")
    .select("created_by")
    .eq("id", leagueId)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  if (newHostId === user.id) {
    return NextResponse.json({ error: "You are already the host" }, { status: 400 });
  }

  // Verify new host is actually a member
  const { data: member } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", newHostId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "New host must be a league member" }, { status: 400 });
  }

  const { error } = await admin
    .from("leagues")
    .update({ created_by: newHostId })
    .eq("id", leagueId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

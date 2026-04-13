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

  const { leagueId } = await req.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  // Verify caller is the host of this league
  const { data: league } = await admin
    .from("leagues")
    .select("created_by")
    .eq("id", leagueId)
    .single();

  if (!league || league.created_by !== user.id) {
    return NextResponse.json({ error: "Not the host" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("invite_tokens")
    .insert({ created_by: user.id, league_id: leagueId })
    .select("token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data.token });
}

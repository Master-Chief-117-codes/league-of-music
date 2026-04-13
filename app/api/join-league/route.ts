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

  const { inviteToken } = await req.json();
  if (!inviteToken) return NextResponse.json({ error: "Missing invite token" }, { status: 400 });

  const { data: invite } = await admin
    .from("invite_tokens")
    .select("league_id")
    .eq("token", inviteToken)
    .single();

  if (!invite?.league_id) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 400 });
  }

  // Upsert — safe to call if already a member
  const { error } = await admin
    .from("league_members")
    .upsert(
      { league_id: invite.league_id, user_id: user.id },
      { onConflict: "league_id,user_id", ignoreDuplicates: true }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, leagueId: invite.league_id });
}

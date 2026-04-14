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

  const { data: week } = await admin
    .from("weeks")
    .select("id, revealed, leagues(name, created_by), sms_7_sent")
    .eq("id", weekId)
    .single();

  if (!week || week.revealed) return NextResponse.json({ error: "Round already revealed" }, { status: 400 });

  // Upsert lock-in (idempotent)
  const { error } = await admin.from("vote_locks").upsert(
    { week_id: weekId, user_id: user.id },
    { onConflict: "week_id,user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if all league members have now locked in (#7)
  if (!(week as any).sms_7_sent) {
    const [{ data: members }, { data: locks }] = await Promise.all([
      admin.from("league_members").select("user_id").eq("league_id", leagueId),
      admin.from("vote_locks").select("user_id").eq("week_id", weekId),
    ]);
    const memberIds = new Set((members || []).map((m: any) => m.user_id));
    const lockedIds = new Set((locks || []).map((l: any) => l.user_id));
    const allLocked = [...memberIds].every((id) => lockedIds.has(id));

    if (allLocked && memberIds.size > 0) {
      await admin.from("weeks").update({ sms_7_sent: true }).eq("id", weekId);
      // Host sees the updated UI via realtime; no additional notification needed
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getSpotifyTrackId = (url: string) =>
  url.match(/open\.spotify\.com(?:\/intl-[\w-]+)?\/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;

// Matches album URLs (most common) and direct song URLs
const isAppleMusicUrl = (url: string) =>
  /music\.apple\.com\/.+\/(album|song)\/.+/.test(url);

const isValidMusicUrl = (url: string) =>
  getSpotifyTrackId(url) !== null || isAppleMusicUrl(url);

async function getSpotifyClientToken(): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()).access_token ?? null;
}

async function fetchTrackMeta(trackId: string, accessToken: string): Promise<{ track_name: string; artist_name: string; album_art_url: string } | null> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
  if (!res?.ok) return null;
  const t = await res.json();
  return {
    track_name: t.name ?? "",
    artist_name: t.artists?.[0]?.name ?? "",
    album_art_url: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? "",
  };
}

async function resolveAppleMusicToSpotify(appleMusicUrl: string): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  console.log("[Apple→Spotify] Resolving:", appleMusicUrl);

  // Fetch Apple Music page to extract title/artist from JSON-LD or og tags
  const pageRes = await fetch(appleMusicUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  }).catch(() => null);
  if (!pageRes?.ok) {
    console.log("[Apple→Spotify] Page fetch failed:", pageRes?.status);
    return null;
  }
  const html = await pageRes.text();

  // Try JSON-LD first (most reliable)
  let title = "";
  let artist = "";
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      const record = Array.isArray(ld) ? ld.find((x: any) => x["@type"] === "MusicRecording") : ld;
      title = record?.name ?? "";
      artist = record?.byArtist?.name ?? record?.byArtist?.[0]?.name ?? "";
      console.log("[Apple→Spotify] JSON-LD:", { title, artist });
    } catch (e) {
      console.log("[Apple→Spotify] JSON-LD parse error:", e);
    }
  }

  // Fall back to og tags
  if (!title) {
    title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
    console.log("[Apple→Spotify] og:title fallback:", title);
  }
  if (!artist) {
    // Page <title> is often "Song · Artist · Album · Year · Genre"
    const pageTitle = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    const parts = pageTitle.split("·").map((s) => s.trim());
    if (parts.length >= 2) { title = title || parts[0]; artist = parts[1]; }
    console.log("[Apple→Spotify] title-tag fallback:", { title, artist, pageTitle });
  }

  // Strip " - Single" / " - EP" suffixes that confuse Spotify search
  title = title.replace(/\s*-\s*(Single|EP|Album)$/i, "").trim();

  if (!title) {
    console.log("[Apple→Spotify] Could not extract title — giving up");
    return null;
  }

  const access_token = await getSpotifyClientToken();
  if (!access_token) {
    console.log("[Apple→Spotify] Spotify token fetch failed");
    return null;
  }

  const titleWords = new Set(title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2));
  const titleMatches = (resultTitle: string) => {
    const resultWords = new Set(resultTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2));
    return [...titleWords].some((w) => resultWords.has(w));
  };

  // Try strict query first, then fall back to title-only
  const queries = artist
    ? [`track:${title} artist:${artist}`, title]
    : [title];

  for (const q of queries) {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    ).catch(() => null);
    if (!searchRes?.ok) continue;
    const { tracks } = await searchRes.json();
    const match = (tracks?.items ?? []).find((t: any) => titleMatches(t.name));
    console.log("[Apple→Spotify] Search q:", q, "→", match?.id ?? "no match");
    if (match) return match.id;
  }
  return null;
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekId, leagueId, spotifyUrl } = await req.json();
  if (!weekId || !leagueId || !spotifyUrl?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!isValidMusicUrl(spotifyUrl.trim())) {
    return NextResponse.json({ error: "Invalid Spotify or Apple Music URL" }, { status: 400 });
  }

  // Strip Spotify ?si= tracking param (identifies the sharer's account) but preserve Apple Music ?i= track param
  const cleanUrl = (() => { try { const u = new URL(spotifyUrl.trim()); u.searchParams.delete("si"); return u.toString(); } catch { return spotifyUrl.trim(); } })();

  // Verify week is active and accepting submissions
  const { data: week } = await admin
    .from("weeks")
    .select("id, status, locked, prompt, leagues(name, created_by), sms_5_sent")
    .eq("id", weekId)
    .single();

  if (!week || week.status !== "active" || week.locked) {
    return NextResponse.json({ error: "Submissions are closed" }, { status: 400 });
  }

  // Prevent double submission
  const { data: existing } = await admin
    .from("song_submissions")
    .select("id")
    .eq("week_id", weekId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Already submitted" }, { status: 400 });

  const isApple = isAppleMusicUrl(cleanUrl);
  const resolvedSpotifyId = isApple
    ? await resolveAppleMusicToSpotify(cleanUrl).catch(() => null)
    : null;

  const finalTrackId = resolvedSpotifyId ?? (!isApple ? getSpotifyTrackId(cleanUrl) : null);
  let meta: { track_name: string; artist_name: string; album_art_url: string } | null = null;
  if (finalTrackId) {
    const token = await getSpotifyClientToken().catch(() => null);
    if (token) meta = await fetchTrackMeta(finalTrackId, token).catch(() => null);
  }

  const { error } = await admin.from("song_submissions").insert({
    week_id: weekId,
    user_id: user.id,
    spotify_url: cleanUrl,
    ...(resolvedSpotifyId ? { resolved_spotify_id: resolvedSpotifyId } : {}),
    ...(meta ?? {}),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if all league members have now submitted (#5)
  if (!(week as any).sms_5_sent) {
    const [{ data: members }, { data: submissions }] = await Promise.all([
      admin.from("league_members").select("user_id").eq("league_id", leagueId),
      admin.from("song_submissions").select("user_id").eq("week_id", weekId),
    ]);
    const memberIds = new Set((members || []).map((m: any) => m.user_id));
    const submittedIds = new Set((submissions || []).map((s: any) => s.user_id));
    const allSubmitted = [...memberIds].every((id) => submittedIds.has(id));

    if (allSubmitted && memberIds.size > 0) {
      await fireAllSubmitted(weekId, leagueId, week);
    }
  }

  return NextResponse.json({ ok: true });
}

async function fireAllSubmitted(weekId: string, leagueId: string, week: any) {
  const now = new Date();
  const voteDeadline = new Date(now.getTime() + 48 * 3600000).toISOString();
  await admin.from("weeks").update({ sms_5_sent: true, locked: true, all_submitted_at: now.toISOString(), vote_deadline: voteDeadline }).eq("id", weekId);
}

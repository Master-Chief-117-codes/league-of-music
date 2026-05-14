import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function resolveAppleMusicToSpotify(appleMusicUrl: string): Promise<string | null> {
  const pageRes = await fetch(appleMusicUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  }).catch(() => null);
  if (!pageRes?.ok) return null;
  const html = await pageRes.text();

  let title = "";
  let artist = "";
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      const record = Array.isArray(ld) ? ld.find((x: any) => x["@type"] === "MusicRecording") : ld;
      title = record?.name ?? "";
      artist = record?.byArtist?.name ?? record?.byArtist?.[0]?.name ?? "";
    } catch { /* ignore */ }
  }
  if (!title) {
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
    const ogMatch = ogTitle.match(/^(.+?)\s+by\s+(.+?)\s+on\s+Apple\s+Music$/i);
    if (ogMatch) {
      title = title || ogMatch[1].trim();
      artist = artist || ogMatch[2].trim();
    } else {
      title = title || ogTitle;
    }
  }
  if (!artist) {
    const pageTitle = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    const parts = pageTitle.split("·").map((s: string) => s.trim());
    if (parts.length >= 2) { title = title || parts[0]; artist = parts[1]; }
  }
  title = title.replace(/\s+on\s+Apple\s+Music$/i, "").replace(/\s*-\s*(Single|EP|Album)$/i, "").trim();
  if (!title) return null;

  const access_token = await getSpotifyClientToken();
  if (!access_token) return null;

  const titleWords = new Set(title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2));
  const titleMatches = (resultTitle: string) => {
    const resultWords = new Set(resultTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2));
    return [...titleWords].some((w) => resultWords.has(w));
  };

  const queries = artist ? [`track:${title} artist:${artist}`, title] : [title];
  for (const q of queries) {
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=3`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    ).catch(() => null);
    if (!searchRes?.ok) continue;
    const { tracks } = await searchRes.json();
    const match = (tracks?.items ?? []).find((t: any) => titleMatches(t.name));
    if (match) return match.id;
  }
  return null;
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, submissionId } = await req.json();
  if (!url || !submissionId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const spotifyId = await resolveAppleMusicToSpotify(url).catch(() => null);

  // Persist the resolved ID so future exports don't need to re-resolve
  if (spotifyId) {
    await admin.from("song_submissions").update({ resolved_spotify_id: spotifyId }).eq("id", submissionId);
  }

  return NextResponse.json({ spotifyId: spotifyId ?? null });
}

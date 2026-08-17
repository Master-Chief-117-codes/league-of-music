// Run with: node backfill-song-meta.mjs
// Requires NEXT_PUBLIC_SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local

import { readFileSync } from "fs";

// Load .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SPOTIFY_CLIENT_ID = env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase env vars"); process.exit(1); }
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("Missing NEXT_PUBLIC_SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const sb = (path, opts) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...opts,
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(opts?.headers ?? {}) },
});

async function getSpotifyToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: SPOTIFY_CLIENT_ID, client_secret: SPOTIFY_CLIENT_SECRET }),
  });
  const d = await res.json();
  return d.access_token ?? null;
}

async function fetchTrackMeta(trackId, token) {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const t = await res.json();
  return {
    track_name: t.name ?? "",
    artist_name: t.artists?.[0]?.name ?? "",
    album_art_url: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? "",
  };
}

function getSpotifyTrackId(url) {
  return url.match(/open\.spotify\.com(?:\/intl-[\w-]+)?\/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;
}

// Fetch all submissions missing track_name
const res = await sb("song_submissions?select=id,spotify_url,resolved_spotify_id&track_name=is.null");
const rows = await res.json();
console.log(`Found ${rows.length} submissions to backfill`);
if (!rows.length) process.exit(0);

const token = await getSpotifyToken();
if (!token) { console.error("Could not get Spotify token"); process.exit(1); }

let ok = 0, skipped = 0;
for (const row of rows) {
  const trackId = row.resolved_spotify_id ?? getSpotifyTrackId(row.spotify_url ?? "");
  if (!trackId) { skipped++; continue; }

  const meta = await fetchTrackMeta(trackId, token);
  if (!meta) { skipped++; continue; }

  await sb(`song_submissions?id=eq.${row.id}`, {
    method: "PATCH",
    body: JSON.stringify(meta),
  });
  console.log(`  ✓ ${meta.track_name} — ${meta.artist_name}`);
  ok++;

  // Respect Spotify rate limits
  await new Promise((r) => setTimeout(r, 100));
}

console.log(`\nDone. ${ok} updated, ${skipped} skipped (Apple Music without resolved ID).`);

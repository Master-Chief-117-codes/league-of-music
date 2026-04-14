# League of Music

A social music game where players submit songs each round, vote for their favorites, and compete across friend groups.

## How It Works

1. The host starts a new round — a player is chosen round-robin to submit this week's prompt
2. The prompt author submits a theme (e.g. "best driving song")
3. All players submit a Spotify track that fits the prompt
4. Players listen, leave comments, then rank their top 3 picks
5. The host reveals identities — scores are tallied and the leaderboard updates

**Scoring:** #1 pick = 2 pts · #2 = 1.5 pts · #3 = 1 pt

## Features

- **Multi-league support** — run separate leagues for different friend groups; each league is fully isolated
- **League approval flow** — new league requests require admin approval via email link
- **Invite links** — reusable invite links per league; joining via link auto-adds you to that league
- **Ranked voting** — rank your top 3 songs per round; weighted point system
- **Comment gate** — must leave a comment on a song before ranking it
- **Combined lock + reveal** — host clicks Reveal to lock submissions and reveal identities atomically
- **Spotify integration** — paste a Spotify track URL to submit; export the round's playlist to Spotify; stays logged in via refresh token
- **Realtime updates** — submissions, votes, comments, and reactions update live
- **Round-robin prompts** — the app tracks who has authored prompts and rotates fairly
- **Per-league leaderboards** — wins and points tracked separately per league

## Tech Stack

- **Next.js** (App Router)
- **Supabase** (Postgres, Auth, RLS, Realtime)
- **Resend** (transactional email)
- **Spotify Web API** (track embeds + playlist export)
- **Vercel** (deployment)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL          # e.g. https://your-app.vercel.app
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_SPOTIFY_CLIENT_ID
```

## Database Setup

Run these SQL files in order in the Supabase SQL Editor:

1. `migrations.sql` — base schema (weeks, profiles, submissions, votes, comments, reactions, invite tokens)
2. `league-migrations.sql` — multi-league support (leagues, league_members, league_requests, per-league scoring functions)
3. `voting-migration.sql` — ranked voting (adds `rank` column to `song_votes`, unique index)

## API Routes

| Route | Description |
|---|---|
| `POST /api/request-league` | Submit a new league request (emails admin for approval) |
| `GET /api/approve-league` | Admin clicks to approve a league request |
| `POST /api/invite` | Generate an invite link for a league (host only) |
| `POST /api/join-league` | Join a league via invite token |
| `POST /api/start-round` | Start a new round in a league (host only) |
| `POST /api/submit-prompt` | Submit the week's prompt (prompt author or host) |
| `POST /api/transfer-host` | Transfer host ownership to another member |
| `POST /api/remove-member` | Remove a member from a league (host only) |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

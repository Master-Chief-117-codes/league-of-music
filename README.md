# League of Music

A social music game where players submit songs each round, vote for their favorites, and compete across friend groups.

## How It Works

1. The host starts a new round — a player is chosen round-robin to submit this week's prompt
2. The prompt author submits a theme (e.g. "best driving song")
3. All players submit a Spotify track that fits the prompt
4. Players listen, leave comments, guess who submitted what, then rank their top 3 picks
5. The host reveals identities — scores are tallied and the leaderboard updates

**Scoring:** #1 pick = 2 pts · #2 = 1.5 pts · #3 = 1 pt

## Features

- **Multi-league support** — run separate leagues for different friend groups; each league is fully isolated
- **League approval flow** — new league requests require admin approval via email link
- **Invite links** — reusable invite links per league; joining via link auto-adds you to that league
- **Profile photos** — upload an avatar (resized client-side to 200×200 JPEG); falls back to initials
- **Ranked voting** — rank your top 3 songs per round; weighted point system
- **Comment + guess gate** — must leave a comment on a song before you can guess who submitted it or rank it
- **Host controls** — organized into Round / Notify / League sections; rename league, close submissions early, reveal results, transfer host, remove members
- **Close submissions** — host can lock submissions and trigger the voting phase manually
- **Spotify integration** — paste a Spotify track URL to submit; export the round's playlist to Spotify; stays logged in via refresh token
- **Realtime updates** — submissions, votes, comments, and reactions update live
- **Round-robin prompts** — the app tracks who has authored prompts and rotates fairly
- **Per-league leaderboards** — wins and points tracked separately per league

## Notifications

- **Email** (automatic via Resend) — sent on key events: prompt submitted, all songs in, results revealed, league approvals, invites
- **Manual SMS** (host-triggered) — host panel has `sms:` buttons that open the native messaging app with a prefilled message for nudging the prompt author, announcing songs are in, or announcing results

No Twilio, no cron jobs — all notifications are either event-triggered emails or one-tap native SMS links.

## Tech Stack

- **Next.js** (App Router)
- **Supabase** (Postgres, Auth, RLS, Realtime, Storage)
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
4. `notifications-migration.sql` — tracking flags for event-triggered emails
5. `avatar-migration.sql` — `avatar_url` column + `avatars` storage bucket + RLS policies

## API Routes

| Route | Description |
|---|---|
| `POST /api/request-league` | Submit a new league request (emails admin for approval) |
| `GET /api/approve-league` | Admin clicks to approve a league request |
| `POST /api/invite` | Generate an invite link for a league (host only) |
| `POST /api/join-league` | Join a league via invite token |
| `POST /api/start-round` | Start a new round in a league (host only) |
| `POST /api/submit-prompt` | Submit the week's prompt (prompt author or host) |
| `POST /api/submit-song` | Submit a Spotify track for the current week |
| `POST /api/close-submissions` | Host closes submissions early and triggers voting phase |
| `POST /api/lock-votes` | Lock votes at the end of the voting window |
| `POST /api/reveal` | Host reveals identities, tallies scores, updates leaderboard |
| `POST /api/notify-round` | Email league members that a new round started |
| `POST /api/notify-prompt-author` | Nudge the prompt author via email |
| `POST /api/transfer-host` | Transfer host ownership to another member |
| `POST /api/remove-member` | Remove a member from a league (host only) |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Invite Text

Informal message to send friends:

> yo! making a lil music sharing game for us — each week someone picks a prompt (like "songs that go hard at 3am"), everyone submits a song, we listen + toast/roast each other + rank them, and guess who submitted what. winner gets bragging rights but it’s more about music sharing than winning. Please join! [link]

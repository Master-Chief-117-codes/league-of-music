# Changelog

## 2026-05-13

### New
- **Host note** — prompt setter can leave a secret message during the prompt phase, revealed to everyone after voting
- **Prompt setter's #1 pick** — after reveal, the song the prompt setter ranked #1 is highlighted with a purple tag
- **song.link** — "Listen ↗" now links to a neutral song.link page where everyone can open the song in their preferred platform (Spotify, Apple Music, YouTube Music, etc.)
- **Voting instructions panel** — new bold, emphatic panel during voting phase showing exact requirements

### Changes
- **Comment requirement** — must now comment on at least half of all submitted songs (rounded up) to unlock voting, e.g. 4 comments required for 7–8 songs
- **Platform pills hidden during voting** — song cards no longer show Spotify/Apple Music labels until after reveal to prevent identity leaks
- **After reveal** — platform pills show clearly as "Spotify ↗" and/or "Apple Music ↗"

### Fixes
- **Apple Music → Spotify resolution** — bad matches (e.g. wrong song entirely) are now rejected using title word overlap validation
- **Spotify metadata retry** — if track name/album art fails to load at submission time, it now retries once automatically, reducing "Unknown track" occurrences
- **Playlist export** — Apple Music submissions that failed Spotify resolution at submission time are now re-attempted at export time
- **Spotify ?si= tracking param** — stripped from submitted URLs to prevent identity leaks via Spotify DMs
- **Playlist shuffle** — exported Spotify playlists are now shuffled so song order doesn't reveal submission order

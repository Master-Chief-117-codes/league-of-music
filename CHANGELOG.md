# Changelog

## 2026-05-13

### New
- **Host note** — prompt setter can leave a secret message during the prompt phase, revealed to everyone after voting
- **Prompt setter's #1 pick** — after reveal, the song the prompt setter ranked #1 is highlighted with a purple tag
- **song.link** — "Listen ↗" now links to a neutral song.link page where everyone can open the song in their preferred platform (Spotify, Apple Music, YouTube Music, etc.)
- **Voting instructions panel** — new bold, emphatic panel during voting phase showing exact requirements

### Changes
- **Comment requirement raised** — must now comment on at least half of all submitted songs (rounded up) to unlock voting, e.g. 4 comments required for 7–8 songs. Previously only 1 comment was required.
- **Platform pills hidden during voting** — song cards no longer show Spotify/Apple Music labels until after reveal to prevent identity leaks
- **After reveal** — platform pills show clearly as "Spotify ↗" and/or "Apple Music ↗"

### Fixes
- **Apple Music → Spotify resolution** — bad matches (e.g. wrong song entirely) are now rejected using title word overlap validation
- **Spotify metadata retry** — if track name/album art fails to load at submission time, it now retries once automatically, reducing "Unknown track" occurrences
- **Playlist export** — Apple Music submissions that failed Spotify resolution at submission time are now re-attempted at export time
- **Spotify ?si= tracking param** — stripped from submitted URLs to prevent identity leaks via Spotify DMs
- **Playlist shuffle** — exported Spotify playlists are now shuffled so song order doesn't reveal submission order

---

## 2026-04-27

### New
- **Voting penalty** — didn't vote? Your song loses 1 point off its score
- **Export playlist for everyone** — any member can now export the round's songs to their own Spotify; connect your account and save the playlist
- **Ready for next round?** — after the reveal, tap 👍 to signal you're ready to go again; shows a progress bar so everyone can see who's in
- **Total points on your profile** — see your cumulative points across all rounds on your profile (visible only to you)

### Changes
- **Voting requirements** — you no longer have to comment on every song to vote; react with an emoji to each song and leave at least 1 comment to unlock voting. Emoji options expanded. *(Note: comment minimum was later raised in the 5/13 update)*
- **Apple Music submissions** — reliability improvements for Apple Music link resolution

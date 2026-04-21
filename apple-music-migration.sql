-- Store resolved Spotify track ID for Apple Music submissions
ALTER TABLE song_submissions ADD COLUMN IF NOT EXISTS resolved_spotify_id text;

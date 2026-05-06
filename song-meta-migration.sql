ALTER TABLE song_submissions ADD COLUMN IF NOT EXISTS track_name text;
ALTER TABLE song_submissions ADD COLUMN IF NOT EXISTS artist_name text;
ALTER TABLE song_submissions ADD COLUMN IF NOT EXISTS album_art_url text;

-- Add media_url to song_comments for image/gif attachments
ALTER TABLE song_comments ADD COLUMN IF NOT EXISTS media_url text;

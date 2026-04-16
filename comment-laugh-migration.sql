-- Add comment_laughs table for 😂 reactions on comments
CREATE TABLE IF NOT EXISTS comment_laughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES song_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  UNIQUE (comment_id, user_id)
);

ALTER TABLE comment_laughs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment laughs are publicly readable" ON comment_laughs FOR SELECT USING (true);
CREATE POLICY "Users can manage their own comment laughs" ON comment_laughs FOR ALL USING (auth.uid() = user_id);

-- Persist "who do you think submitted this?" guesses
CREATE TABLE IF NOT EXISTS song_guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES song_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guessed_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (submission_id, user_id)
);

ALTER TABLE song_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guesses are publicly readable" ON song_guesses FOR SELECT USING (true);
CREATE POLICY "Users can manage their own guesses" ON song_guesses FOR ALL USING (auth.uid() = user_id);

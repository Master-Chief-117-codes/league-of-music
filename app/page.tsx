"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default function LeagueOfMusicApp() {
  const [session, setSession] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [votesLeft, setVotesLeft] = useState<number>(2);

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  /* ================= LOAD CURRENT WEEK ================= */

  useEffect(() => {
    if (!session) return;

    const loadWeek = async () => {
      const { data: weekData } = await supabase
        .from("weeks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!weekData) return;

      setWeek(weekData);

      const { data: songs } = await supabase
        .from("song_submissions")
        .select("*")
        .eq("week_id", weekData.id);

      setSubmissions(songs || []);

      const { count } = await supabase
        .from("song_votes")
        .select("*", { count: "exact", head: true })
        .eq("week_id", weekData.id)
        .eq("voter_id", session.user.id);

      setVotesLeft(2 - (count || 0));
    };

    loadWeek();
  }, [session]);

  /* ================= SUBMIT SONG ================= */

  const submitSong = async () => {
    if (!spotifyUrl || !week || !session) return;

    await supabase.from("song_submissions").insert({
      week_id: week.id,
      user_id: session.user.id,
      spotify_url: spotifyUrl,
    });

    window.location.reload();
  };

  /* ================= VOTE ================= */

  const voteForSong = async (submissionId: string) => {
    if (!week || !session || votesLeft <= 0) return;

    const { error } = await supabase.from("song_votes").insert({
      week_id: week.id,
      voter_id: session.user.id,
      submission_id: submissionId,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setVotesLeft((prev) => prev - 1);
  };

  /* ================= UI ================= */

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <button
          onClick={login}
          className="px-4 py-2 bg-white text-black rounded"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">League of Music 🎵</h1>
          <button onClick={logout} className="px-3 py-1 border rounded">
            Logout
          </button>
        </div>

        {week && (
          <div className="bg-zinc-900 border-zinc-800 rounded-2xl border">
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-400">Prompt</p>
              <p className="text-lg">{week.prompt}</p>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border-zinc-800 rounded-2xl border">
          <div className="p-6 space-y-4">
            <input
              className="w-full p-2 text-black rounded"
              placeholder="Paste Spotify link"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
            />

            <button
              onClick={submitSong}
              className="px-4 py-2 bg-white text-black rounded"
            >
              Submit Song
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-purple-400">
            Votes Remaining: {votesLeft}
          </p>

          {submissions.map((song) => {
            const trackId =
              song.spotify_url?.split("track/")[1]?.split("?")[0] || "";

            return (
              <div
                key={song.id}
                className="bg-zinc-900 border-zinc-800 rounded-2xl border"
              >
                <div className="p-4 space-y-3">
                  {trackId && (
                    <iframe
                      src={`https://open.spotify.com/embed/track/${trackId}`}
                      width="100%"
                      height="80"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      style={{ borderRadius: "12px" }}
                    ></iframe>
                  )}

                  <button
                    disabled={votesLeft <= 0}
                    onClick={() => voteForSong(song.id)}
                    className="px-3 py-1 bg-white text-black rounded disabled:opacity-50"
                  >
                    Vote
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

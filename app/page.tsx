"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export default function LeagueOfMusicApp() {

  const startNewRound = async () => {
    const promptText = window.prompt("Enter new prompt for the next round:");
    if (!promptText) return;

    const { error } = await supabase.from("weeks").insert({
      prompt: promptText,
    });

    if (error) {
      alert(error.message);
      return;
    }

    // reset local state + reload
    setSubmissionsLocked(false);
    window.location.reload();
  };
  const [session, setSession] = useState<any>(null);
  const [week, setWeek] = useState<any>(null);
  const [submissionsLocked, setSubmissionsLocked] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // IMPORTANT: static setter name (previous build error came from a corrupted setter name)
  const [votesLeft, setVotesLeft] = useState<number>(2);

  // spotify metadata
  const [trackMeta, setTrackMeta] = useState<Record<string, any>>({});

  // vote counts per song
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

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

      const submissionsData = songs || [];
      setSubmissions(submissionsData);

      // check if current user already submitted
      const already = submissionsData.some((s:any) => s.user_id === session.user.id);
      setHasSubmitted(already);

      // load votes
      const { data: votes } = await supabase
        .from("song_votes")
        .select("submission_id")
        .eq("week_id", weekData.id);

      const counts: Record<string, number> = {};

      votes?.forEach((v: any) => {
        counts[v.submission_id] = (counts[v.submission_id] || 0) + 1;
      });

      setVoteCounts(counts);

      const { count } = await supabase
        .from("song_votes")
        .select("*", { count: "exact", head: true })
        .eq("week_id", weekData.id)
        .eq("voter_id", session.user.id);

      setVotesLeft(2 - (count || 0));
    };

    loadWeek();

    // refresh automatically so friends see updates
    const interval = setInterval(loadWeek, 5000);
    return () => clearInterval(interval);
  }, [session]);

  /* ================= LOAD SPOTIFY METADATA ================= */

  useEffect(() => {
    const loadMeta = async () => {
      const meta: Record<string, any> = {};

      for (const song of submissions) {
        const trackId = song.spotify_url?.split("track/")[1]?.split("?")[0];
        if (!trackId) continue;

        try {
          const res = await fetch(
            `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`
          );

          const data = await res.json();
          meta[song.id] = data;
        } catch (e) {
          console.error("metadata fetch failed", e);
        }
      }

      setTrackMeta(meta);
    };

    if (submissions.length) loadMeta();
  }, [submissions]);

  /* ================= SUBMIT SONG ================= */

  const submitSong = async () => {
    if (submissionsLocked) {
      alert("Submissions are closed.");
      return;
    }
    if (!spotifyUrl || !week || !session) return;

    // prevent multiple submissions per user per week
    const { data: existing } = await supabase
      .from("song_submissions")
      .select("id")
      .eq("week_id", week.id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (existing) {
      alert("You already submitted a song this week.");
      setHasSubmitted(true);
      return;
    }

    const { error } = await supabase.from("song_submissions").insert({
      week_id: week.id,
      user_id: session.user.id,
      spotify_url: spotifyUrl,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSpotifyUrl("");
    setHasSubmitted(true);

    const { data: songs } = await supabase
      .from("song_submissions")
      .select("*")
      .eq("week_id", week.id);

    setSubmissions(songs || []);
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

    setVoteCounts((prev) => ({
      ...prev,
      [submissionId]: (prev[submissionId] || 0) + 1,
    }));
  };

  /* ================= LOGIN SCREEN ================= */

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold">League of Music</h1>
          <p className="text-zinc-400">Pick the best song. Vote. Crown a winner.</p>

          <button
            onClick={login}
            className="px-8 py-4 bg-green-500 hover:bg-green-600 rounded-full font-semibold"
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN APP ================= */

  return (
    <div className="min-h-screen bg-black text-white">
      {/* TOP BAR */}
      <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">League of Music</h1>
          <button
            onClick={startNewRound}
            className="text-xs px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-full"
          >
            New Round
          </button>
        </div>

        <button
          onClick={logout}
          className="text-sm px-4 py-2 border border-zinc-700 rounded-full hover:bg-zinc-800"
        >
          Logout
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* PROMPT */}
        {week && (
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-zinc-500 text-sm">THIS WEEK'S PROMPT</p>
              <h2 className="text-3xl font-semibold leading-snug">
                {week.prompt}
              </h2>
            </div>

            {/* HOST CONTROL (temporary) */}
            <button
              onClick={() => setSubmissionsLocked((prev) => !prev)}
              className="text-xs px-3 py-2 bg-zinc-800 rounded-full hover:bg-zinc-700"
            >
              {submissionsLocked ? "Open Submissions" : "Lock Submissions"}
            </button>
          </div>
        )}

        {/* SUBMIT */}
        <div className="flex gap-3">
          <input
            className="flex-1 bg-zinc-900 rounded-full px-5 py-3 outline-none disabled:opacity-40"
            placeholder="Paste Spotify track link"
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
          />

          <button
            onClick={submitSong}
            disabled={hasSubmitted}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-full font-semibold disabled:opacity-40"
          >
            {hasSubmitted ? "Submitted" : "Submit"}
          </button>
        </div>

        {/* VOTE STATUS */}
        <div className="text-sm text-zinc-400">
          Votes remaining: <span className="text-white">{votesLeft}</span>
        </div>

        {/* PLAYLIST SONG LIST */}
        <div className="space-y-2">
          {[...submissions]
            .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
            .map((song, index) => {
              const meta = trackMeta[song.id];
              const votes = voteCounts[song.id] || 0;

              const maxVotes = Math.max(0, ...Object.values(voteCounts));
              // highlight all songs tied for highest votes
              const isLeader = votes === maxVotes && maxVotes > -1;

              const isOwnSong = song.user_id === session.user.id;

              return (
                <div
                  key={song.id}
                  className={`flex items-center gap-4 transition rounded-xl px-4 py-3 ${
                    isLeader
                      ? "bg-yellow-500/20 border border-yellow-400"
                      : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  {/* NUMBER */}
                  <div className="text-zinc-400 w-6 text-right">
                    {index + 1}
                  </div>

                  {/* ALBUM ART */}
                  {meta?.thumbnail_url && (
                    <img src={meta.thumbnail_url} className="w-14 h-14 rounded" />
                  )}

                  {/* SONG INFO */}
                  <div className="flex-1">
                    <div className="font-semibold">{meta?.title || "Loading..."}</div>
                    <div className="text-sm text-zinc-400">{meta?.author_name || ""}</div>

                    <div className="text-xs text-zinc-500">
                      submitted by {song.user_id === session.user.id ? "you" : "player"}
                      {isOwnSong && " (you)"}
                    </div>
                  </div>

                  {/* VOTES */}
                  <div className="text-sm text-zinc-400 w-16 text-center">
                    {votes} votes
                  </div>

                  {/* PLAY */}
                  <a
                    href={song.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-full"
                  >
                    ▶ Play
                  </a>

                  {/* VOTE BUTTON */}
                  <button
                    disabled={votesLeft <= 0 || isOwnSong}
                    onClick={() => voteForSong(song.id)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-full text-sm font-semibold disabled:opacity-40"
                  >
                    {isOwnSong ? "Your Song" : "Vote"}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

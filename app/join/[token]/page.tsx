"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

type Status = "loading" | "valid" | "invalid" | "joining";

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [status, setStatus] = useState<Status>("loading");
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");

  // Step 1: validate the invite token and get league info
  useEffect(() => {
    supabase
      .from("invite_tokens")
      .select("token, league_id, leagues(name)")
      .eq("token", token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.league_id) { setStatus("invalid"); return; }
        setLeagueId(data.league_id);
        setLeagueName((data as any).leagues?.name ?? "League of Music");
        setStatus("valid");
      });
  }, [token]);

  // Step 2: once we know the token is valid, check if the user is already authenticated
  // (they land here after the Google OAuth redirect)
  useEffect(() => {
    if (status !== "valid" || !leagueId) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return; // not logged in — show the button
      setStatus("joining");
      const res = await fetch("/api/join-league", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ inviteToken: token }),
      });
      if (res.ok) {
        // Store for profile-creation flow (user may not have a profile yet)
        localStorage.setItem("pending_league_id", leagueId);
        localStorage.setItem("last_league", leagueId);
        window.location.href = `/?league=${leagueId}`;
      } else {
        setStatus("valid"); // fall back to showing the login button
      }
    });
  }, [status, leagueId, token]);

  const login = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      // redirect back to this page so we can call join-league after auth
      options: { redirectTo: `${window.location.origin}/join/${token}` },
    });

  if (status === "loading" || status === "joining") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-2xl font-bold">Invalid invite link</p>
        <p className="text-zinc-500 text-sm">This link may have expired or doesn't exist.</p>
        <a href="/" className="text-green-400 text-sm underline underline-offset-4">Go to League of Music</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center shadow-lg shadow-green-500/20 text-4xl">
          🎵
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">You're invited!</h1>
          <p className="text-zinc-400 text-sm mt-1.5">
            Join <span className="text-white font-semibold">{leagueName}</span>
          </p>
          <p className="text-zinc-600 text-xs mt-2 max-w-xs">
            Submit songs, vote for your favorites, and compete with friends.
          </p>
        </div>
      </div>
      <button
        onClick={login}
        className="flex items-center gap-3 px-6 py-3.5 bg-white text-black rounded-2xl font-semibold text-sm shadow-lg active:scale-95 transition-transform"
      >
        <GoogleLogo />
        Continue with Google
      </button>
    </div>
  );
}

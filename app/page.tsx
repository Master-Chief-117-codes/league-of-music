"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);


const EMOJIS = ["🔥", "❤️", "😂"] as const;
const RANK_PTS: Record<number, number> = { 1: 2, 2: 1.5, 3: 1, 4: 0.5 };

/* ─── Helpers ─── */
const getSpotifyTrackId = (url: string) =>
  url.match(/open\.spotify\.com(?:\/intl-[\w-]+)?\/track\/([a-zA-Z0-9]+)/)?.[1] ?? null;

// Keep as alias used by export logic
const getTrackId = getSpotifyTrackId;

const isAppleMusicUrl = (url: string) =>
  /music\.apple\.com\/.+\/album\/.+/.test(url);

const getAppleMusicEmbedUrl = (url: string) =>
  url.replace("music.apple.com", "embed.music.apple.com");

const isMusicUrl = (url: string) =>
  getSpotifyTrackId(url.trim()) !== null || isAppleMusicUrl(url.trim());

const isSpotifyUrl = (url: string) => getSpotifyTrackId(url.trim()) !== null;

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const fmtMs = (ms: number) => {
  if (ms <= 0) return "0:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const fmtScore = (n: number) =>
  n === 0 ? "0" : Number.isInteger(n) ? String(n) : n.toFixed(1);

/* ─── Types ─── */
type ToastKind = "success" | "error" | "info";
interface Toast { id: string; msg: string; kind: ToastKind }

/* ─── Icons ─── */
function IMusic() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" /></svg>;
}
function ILogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
function IChevLeft() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ICheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IShare() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>;
}
function IClock() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function IComment() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function IEdit() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
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

/* ─── Spotify PKCE helpers ─── */
function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/* ─── Image helpers ─── */
async function resizeImage(file: File, size = 200): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
    };
    img.src = url;
  });
}

/* ─── Sub-components ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Avatar({ name, url, size = "md", onClick }: { name: string; url?: string | null; size?: "sm" | "md" | "lg"; onClick?: () => void }) {
  const sz = { sm: "w-5 h-5 text-[9px]", md: "w-9 h-9 text-xs", lg: "w-16 h-16 text-xl" }[size];
  const cls = `${sz} rounded-full flex-shrink-0 ${onClick ? "cursor-pointer hover:opacity-75 transition-opacity" : ""}`;
  if (url) return <img src={url} alt={name} onClick={onClick} className={`${cls} object-cover`} />;
  return (
    <div onClick={onClick} className={`${cls} bg-green-500/15 border border-green-500/25 flex items-center justify-center font-bold text-green-400`}>
      {initials(name)}
    </div>
  );
}

function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  const tabs = [{ key: "current", label: "Round" }, { key: "leaderboard", label: "Members" }, { key: "history", label: "History" }];
  return (
    <div className="flex border-b border-zinc-900 bg-black sticky top-14 z-10">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            active === t.key ? "text-white border-b-2 border-green-500" : "text-zinc-600 hover:text-zinc-400"
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── App ─── */
export default function App() {
  /* ── Auth ── */
  const [session, setSession] = useState<any>(null);

  /* ── Leagues ── */
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [requestingLeague, setRequestingLeague] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [leagueRequested, setLeagueRequested] = useState(false);
  const [wentBack, setWentBack] = useState(false); // prevents auto-reselect after user taps back

  /* ── Round ── */
  const [week, setWeek] = useState<any>(null);
  const [submissionsLocked, setSubmissionsLocked] = useState(false);
  const [identitiesRevealed, setIdentitiesRevealed] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [voteCountdown, setVoteCountdown] = useState("");
  const [promptInput, setPromptInput] = useState("");

  /* ── Submissions ── */
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Profiles ── */
  const [profile, setProfile] = useState<any>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [needsProfile, setNeedsProfile] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  /* ── Profile editing ── */
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editArtist1, setEditArtist1] = useState("");
  const [editArtist2, setEditArtist2] = useState("");
  const [editOnRepeat, setEditOnRepeat] = useState("");
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  /* ── Onboarding form ── */
  const [name, setName] = useState("");
  const [artist1, setArtist1] = useState("");
  const [artist2, setArtist2] = useState("");
  const [onRepeat, setOnRepeat] = useState("");

  /* ── Ranked voting ── */
  const [myRanks, setMyRanks] = useState<Record<string, number>>({});      // submissionId -> rank (1/2/3)
  const [voteScores, setVoteScores] = useState<Record<string, number>>({});  // submissionId -> weighted score

  /* ── Reactions ── */
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>({});

  /* ── Comments ── */
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [mentionState, setMentionState] = useState<Record<string, { query: string; atIndex: number } | null>>({});
  const [commentMedia, setCommentMedia] = useState<Record<string, { url: string; uploading: boolean } | null>>({});

  /* ── Comment likes ── */
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [myCommentLikes, setMyCommentLikes] = useState<Set<string>>(new Set());
  const [commentLaughs, setCommentLaughs] = useState<Record<string, number>>({});
  const [myCommentLaughs, setMyCommentLaughs] = useState<Set<string>>(new Set());

  /* ── Guesses ── */
  const [guesses, setGuesses] = useState<Record<string, string>>({});

  /* ── Navigation ── */
  const [activeTab, setActiveTab] = useState("current");

  /* ── History ── */
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  /* ── Toasts ── */
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ── Magic link ── */
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  /* ── Spotify ── */
  const [spotifyToken, setSpotifyToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("spotify_token") : null
  );
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("spotify_refresh_token") : null
  );
  const [exportingPlaylist, setExportingPlaylist] = useState(false);
  const [voteLocks, setVoteLocks] = useState<Set<string>>(new Set());

  /* ── Reveal animation ── */
  const [justRevealed, setJustRevealed] = useState(false);

  /* ── Host controls ── */
  const [transferring, setTransferring] = useState(false);
  const [expandedHistoryComments, setExpandedHistoryComments] = useState<Set<string>>(new Set());
  const [newRoundPick, setNewRoundPick] = useState<string | null>(null); // null = not expanded, "random" or userId
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [renamingLeague, setRenamingLeague] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const userIdRef = useRef("");
  useEffect(() => { if (session?.user?.id) userIdRef.current = session.user.id; }, [session]);

  /* ── Toast helper ── */
  const toast = useCallback((msg: string, kind: ToastKind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, msg, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => l?.subscription?.unsubscribe();
  }, []);

  const login = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();

  /* ── Spotify PKCE callback ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const saved = localStorage.getItem("spotify_state");
    if (code && state && state === saved && state.startsWith("league_spotify_")) {
      const verifier = localStorage.getItem("spotify_verifier") ?? "";
      window.history.replaceState({}, "", window.location.pathname);
      localStorage.removeItem("spotify_verifier");
      localStorage.removeItem("spotify_state");
      fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: window.location.origin,
          client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "",
          code_verifier: verifier,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.access_token) {
            console.log("Spotify token granted scopes:", d.scope);
            setSpotifyToken(d.access_token);
            localStorage.setItem("spotify_token", d.access_token);
          } else {
            console.error("Spotify token exchange failed:", d);
            toast(`Spotify auth failed: ${d.error_description ?? d.error ?? "unknown"}`, "error");
          }
          if (d.refresh_token) {
            setSpotifyRefreshToken(d.refresh_token);
            localStorage.setItem("spotify_refresh_token", d.refresh_token);
          }
        });
    }
  }, []);

  /* ── Read league from URL or localStorage (runs once on mount) ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLeague = params.get("league");
    if (urlLeague) {
      localStorage.setItem("last_league", urlLeague);
      setSelectedLeagueId(urlLeague);
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      const last = localStorage.getItem("last_league");
      if (last) setSelectedLeagueId(last);
    }
  }, []);

  /* ── Profile load ── */
  useEffect(() => {
    if (!session) return;
    supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (!data) setNeedsProfile(true);
      else setProfile(data);
    });
  }, [session]);

  /* ── Load leagues and pending requests ── */
  useEffect(() => {
    if (!session || needsProfile) return;
    Promise.all([
      supabase.from("league_members").select("league_id, leagues(id, name, created_by)").eq("user_id", session.user.id),
      supabase.from("league_requests").select("id, name, status, created_at").eq("requested_by", session.user.id).eq("status", "pending"),
    ]).then(([{ data: memberData }, { data: reqData }]) => {
      setMyLeagues((memberData || []).map((m: any) => m.leagues).filter(Boolean));
      setPendingRequests(reqData || []);
    });
  }, [session, needsProfile]);

  /* ── Auto-select if exactly one league (skip if user explicitly went back) ── */
  useEffect(() => {
    if (selectedLeagueId || wentBack || myLeagues.length !== 1) return;
    const id = myLeagues[0].id;
    setSelectedLeagueId(id);
    localStorage.setItem("last_league", id);
  }, [myLeagues, selectedLeagueId, wentBack]);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!session) return null;
    const blob = await resizeImage(file);
    const path = `${session.user.id}/avatar.jpg`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) { toast("Failed to upload photo", "error"); return null; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // Bust cache with timestamp
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const uploadCommentMedia = async (songId: string, file: File) => {
    if (!session) return;
    if (file.size > 8 * 1024 * 1024) { toast("File too large (max 8 MB)", "error"); return; }
    setCommentMedia((p) => ({ ...p, [songId]: { url: "", uploading: true } }));
    const ext = file.type === "image/gif" ? "gif" : file.type === "image/png" ? "png" : "jpg";
    const path = `${session.user.id}/comment-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (error) { setCommentMedia((p) => ({ ...p, [songId]: null })); toast("Failed to upload image", "error"); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setCommentMedia((p) => ({ ...p, [songId]: { url: data.publicUrl, uploading: false } }));
  };

  const createProfile = async () => {
    if (!session || !name.trim()) return;
    const { error } = await supabase.from("profiles").insert({
      id: session.user.id,
      email: session.user.email,
      name: name.trim(),
      top_artists: [artist1, artist2].filter(Boolean).join(", "),
      on_repeat: onRepeat,
      wins: 0,
    });
    if (error) return alert(error.message);
    const pendingLeagueId = localStorage.getItem("pending_league_id");
    if (pendingLeagueId) {
      localStorage.removeItem("pending_league_id");
      localStorage.setItem("last_league", pendingLeagueId);
    }
    window.location.reload();
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    const existingParts = (profile?.top_artists || "").split(", ");
    const a1 = editArtist1.trim() || existingParts[0] || "";
    const a2 = editArtist2.trim() || existingParts[1] || "";
    const top_artists = [a1, a2].filter(Boolean).join(", ");
    const on_repeat = editOnRepeat.trim() || profile?.on_repeat || "";
    const avatar_url = editAvatarPreview ?? profile?.avatar_url ?? null;
    const { error } = await supabase.from("profiles").update({ name: editName.trim(), top_artists, on_repeat, avatar_url }).eq("id", session.user.id);
    if (error) { toast("Failed to save", "error"); return; }
    const updated = { ...profile, name: editName.trim(), top_artists, on_repeat, avatar_url };
    setProfile(updated);
    setProfilesMap((p) => ({ ...p, [session.user.id]: updated }));
    setEditAvatarPreview(null);
    setEditingProfile(false);
    toast("Profile updated!", "success");
  };

  /* ── Data loader for a week ── */
  const loadAllForWeek = useCallback(async (weekId: string) => {
    const userId = userIdRef.current;

    const { data: vl } = await supabase.from("vote_locks").select("user_id").eq("week_id", weekId);
    setVoteLocks(new Set((vl || []).map((l: any) => l.user_id)));

    const { data: songs } = await supabase.from("song_submissions").select("*").eq("week_id", weekId);
    const list = songs || [];
    setSubmissions(list);
    setHasSubmitted(list.some((s: any) => s.user_id === userId));

    // Ranked votes
    const { data: allVotes } = await supabase.from("song_votes").select("submission_id, voter_id, rank").eq("week_id", weekId);
    const scores: Record<string, number> = {};
    const myRanksMap: Record<string, number> = {};
    allVotes?.forEach((v: any) => {
      if (v.rank) {
        scores[v.submission_id] = (scores[v.submission_id] || 0) + (RANK_PTS[v.rank] || 0);
        if (v.voter_id === userId) myRanksMap[v.submission_id] = v.rank;
      }
    });
    setVoteScores(scores);
    setMyRanks(myRanksMap);

    const subIds = list.map((s: any) => s.id as string);
    if (!subIds.length) return;

    const [{ data: reactionData }, { data: commentData }, { data: guessData }] = await Promise.all([
      supabase.from("song_reactions").select("*").in("submission_id", subIds),
      supabase.from("song_comments").select("*").in("submission_id", subIds).order("created_at", { ascending: true }),
      supabase.from("song_guesses").select("submission_id, guessed_user_id").eq("user_id", userId).in("submission_id", subIds),
    ]);

    const myGuessMap: Record<string, string> = {};
    guessData?.forEach((g: any) => { myGuessMap[g.submission_id] = g.guessed_user_id; });
    setGuesses(myGuessMap);

    const rxBySub: Record<string, Record<string, number>> = {};
    const myRx: Record<string, Set<string>> = {};
    reactionData?.forEach((r: any) => {
      if (!rxBySub[r.submission_id]) rxBySub[r.submission_id] = {};
      rxBySub[r.submission_id][r.emoji] = (rxBySub[r.submission_id][r.emoji] || 0) + 1;
      if (r.user_id === userId) {
        if (!myRx[r.submission_id]) myRx[r.submission_id] = new Set();
        myRx[r.submission_id].add(r.emoji);
      }
    });
    setReactions(rxBySub);
    setMyReactions(myRx);

    const cmtBySub: Record<string, any[]> = {};
    commentData?.forEach((c: any) => {
      if (!cmtBySub[c.submission_id]) cmtBySub[c.submission_id] = [];
      cmtBySub[c.submission_id].push(c);
    });
    setComments(cmtBySub);

    const commentIds = (commentData || []).map((c: any) => c.id as string);
    if (commentIds.length) {
      const [{ data: clData }, { data: laughData }] = await Promise.all([
        supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds),
        supabase.from("comment_laughs").select("comment_id, user_id").in("comment_id", commentIds),
      ]);
      const clCounts: Record<string, number> = {};
      const myCl = new Set<string>();
      clData?.forEach((cl: any) => {
        clCounts[cl.comment_id] = (clCounts[cl.comment_id] || 0) + 1;
        if (cl.user_id === userId) myCl.add(cl.comment_id);
      });
      setCommentLikes(clCounts);
      setMyCommentLikes(myCl);
      const laughCounts: Record<string, number> = {};
      const myLaughs = new Set<string>();
      laughData?.forEach((l: any) => {
        laughCounts[l.comment_id] = (laughCounts[l.comment_id] || 0) + 1;
        if (l.user_id === userId) myLaughs.add(l.comment_id);
      });
      setCommentLaughs(laughCounts);
      setMyCommentLaughs(myLaughs);
    }
  }, []);

  /* ── Initial load (scoped to selected league) ── */
  useEffect(() => {
    if (!session || !selectedLeagueId) return;
    const init = async () => {
      setWeek(null);
      setSubmissions([]);
      setSubmissionsLocked(false);
      setIdentitiesRevealed(false);
      setVoteLocks(new Set());

      const { data: members } = await supabase.from("league_members").select("user_id, wins, points").eq("league_id", selectedLeagueId);
      const memberIds = (members || []).map((m: any) => m.user_id);
      const { data: allProfiles } = memberIds.length
        ? await supabase.from("profiles").select("*").in("id", memberIds)
        : { data: [] };
      const map: Record<string, any> = {};
      (members || []).forEach((m: any) => {
        const p = (allProfiles || []).find((pr: any) => pr.id === m.user_id);
        if (p) map[m.user_id] = { ...p, wins: m.wins || 0, points: m.points || 0 };
      });
      setProfilesMap(map);

      const { data: weekData } = await supabase
        .from("weeks").select("*").eq("league_id", selectedLeagueId)
        .order("created_at", { ascending: false }).limit(1).single();
      if (!weekData) return;
      setWeek(weekData);
      setSubmissionsLocked(weekData.locked || false);
      setIdentitiesRevealed(weekData.revealed || false);
      await loadAllForWeek(weekData.id);
    };
    init();
  }, [session, selectedLeagueId, loadAllForWeek]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!week?.id) return;
    const wid = week.id;
    const ch = supabase
      .channel(`week-${wid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "weeks", filter: `id=eq.${wid}` }, (payload) => {
        setWeek((prev: any) => ({ ...prev, ...payload.new }));
        setSubmissionsLocked(payload.new.locked || false);
        setIdentitiesRevealed(payload.new.revealed || false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "song_submissions", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "song_votes", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "song_reactions", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "song_comments", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_likes", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_laughs", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_locks", filter: `week_id=eq.${wid}` }, () => loadAllForWeek(wid))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [week?.id, loadAllForWeek]);

  /* ── Countdown ── */
  useEffect(() => {
    const targetDeadline = week?.status === "pending_prompt" ? week?.prompt_deadline : week?.deadline;
    if (!targetDeadline) return;
    const tick = () => {
      const ms = new Date(targetDeadline).getTime() - Date.now();
      if (ms <= 0) { setCountdown("Time's up!"); if (week?.status !== "pending_prompt" && week?.locked !== false) setSubmissionsLocked(true); return; }
      setCountdown(fmtMs(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [week?.deadline, week?.prompt_deadline, week?.status]);

  /* ── Vote countdown ── */
  useEffect(() => {
    if (!week?.vote_deadline) return;
    const tick = () => {
      const ms = new Date(week.vote_deadline).getTime() - Date.now();
      setVoteCountdown(ms <= 0 ? "Time's up!" : fmtMs(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [week?.vote_deadline]);

  /* ── History ── */
  const loadHistory = useCallback(async () => {
    if (!selectedLeagueId) return;
    setLoadingHistory(true);
    const [{ data: weeks }, { data: songs }, { data: votes }, { data: rxData }, { data: cmtData }] = await Promise.all([
      supabase.from("weeks").select("*").eq("league_id", selectedLeagueId).order("created_at", { ascending: false }),
      supabase.from("song_submissions").select("*"),
      supabase.from("song_votes").select("submission_id, rank"),
      supabase.from("song_reactions").select("submission_id, emoji"),
      supabase.from("song_comments").select("submission_id, user_id, text, media_url").order("created_at", { ascending: true }),
    ]);

    // Weighted scores for history
    const vm: Record<string, number> = {};
    votes?.forEach((v: any) => { if (v.rank) vm[v.submission_id] = (vm[v.submission_id] || 0) + (RANK_PTS[v.rank] || 0); });

    const rxBySub: Record<string, Record<string, number>> = {};
    rxData?.forEach((r: any) => {
      if (!rxBySub[r.submission_id]) rxBySub[r.submission_id] = {};
      rxBySub[r.submission_id][r.emoji] = (rxBySub[r.submission_id][r.emoji] || 0) + 1;
    });

    const cmtBySub: Record<string, any[]> = {};
    cmtData?.forEach((c: any) => {
      if (!cmtBySub[c.submission_id]) cmtBySub[c.submission_id] = [];
      cmtBySub[c.submission_id].push(c);
    });

    const sbw: Record<string, any[]> = {};
    songs?.forEach((s: any) => {
      if (!sbw[s.week_id]) sbw[s.week_id] = [];
      const songComments = cmtBySub[s.id] || [];
      sbw[s.week_id].push({ ...s, score: vm[s.id] || 0, reactions: rxBySub[s.id] || {}, commentCount: songComments.length, comments: songComments });
    });

    setHistory((weeks || []).map((w: any) => {
      const ws = (sbw[w.id] || []).sort((a: any, b: any) => b.score - a.score);
      const maxS = ws.length ? Math.max(...ws.map((s: any) => s.score)) : 0;
      return { ...w, songs: ws, winners: maxS > 0 ? ws.filter((s: any) => s.score === maxS) : [] };
    }));
    setLoadingHistory(false);
  }, [selectedLeagueId]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  /* ─── Actions ─── */

  const submitSong = async () => {
    const trimmed = spotifyUrl.trim();
    if (!isMusicUrl(trimmed)) { setUrlError("Paste a valid Spotify or Apple Music track link."); return; }
    if (submissionsLocked || !week || !session || isSubmitting) return;
    setIsSubmitting(true);
    setUrlError("");
    const res = await fetch("/api/submit-song", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekId: week.id, leagueId: selectedLeagueId, spotifyUrl: trimmed }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setUrlError(b.error || "Failed to submit");
    } else {
      await loadAllForWeek(week.id);
      setHasSubmitted(true);
      setSpotifyUrl("");
      toast("Song submitted!", "success");
    }
    setIsSubmitting(false);
  };

  // Assigns a rank (1/2/3/4) to a submission, handling conflicts
  const setVoteRank = async (submissionId: string, newRank: 1 | 2 | 3 | 4) => {
    if (!week || !session || identitiesRevealed) return;

    const prevRankOfSong = myRanks[submissionId] as 1 | 2 | 3 | 4 | undefined;
    const prevSongAtRank = Object.entries(myRanks).find(([id, r]) => r === newRank && id !== submissionId)?.[0];
    const isToggling = prevRankOfSong === newRank;

    // Optimistic update
    setMyRanks((prev) => {
      const next = { ...prev };
      if (isToggling) { delete next[submissionId]; }
      else { if (prevSongAtRank) delete next[prevSongAtRank]; next[submissionId] = newRank; }
      return next;
    });

    // Collect IDs whose existing votes must be deleted first
    const idsToDelete = new Set<string>();
    if (prevRankOfSong !== undefined) idsToDelete.add(submissionId);
    if (!isToggling && prevSongAtRank) idsToDelete.add(prevSongAtRank);

    for (const id of idsToDelete) {
      await supabase.from("song_votes").delete()
        .eq("week_id", week.id).eq("voter_id", session.user.id).eq("submission_id", id);
    }

    if (!isToggling) {
      await supabase.from("song_votes").insert({
        week_id: week.id, voter_id: session.user.id, submission_id: submissionId, rank: newRank,
      });
    }
  };

  const toggleReaction = async (submissionId: string, emoji: string) => {
    if (!session || !week) return;
    const hasIt = myReactions[submissionId]?.has(emoji);
    setMyReactions((p) => {
      const next = { ...p };
      if (hasIt) { const s = new Set(next[submissionId]); s.delete(emoji); next[submissionId] = s; }
      else next[submissionId] = new Set([...(next[submissionId] || []), emoji]);
      return next;
    });
    setReactions((p) => ({
      ...p,
      [submissionId]: { ...p[submissionId], [emoji]: Math.max(0, (p[submissionId]?.[emoji] || 0) + (hasIt ? -1 : 1)) },
    }));
    if (hasIt) {
      await supabase.from("song_reactions").delete().eq("submission_id", submissionId).eq("user_id", session.user.id).eq("emoji", emoji);
    } else {
      await supabase.from("song_reactions").insert({ week_id: week.id, submission_id: submissionId, user_id: session.user.id, emoji });
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!session || !week) return;
    const liked = myCommentLikes.has(commentId);
    setMyCommentLikes((p) => { const n = new Set(p); liked ? n.delete(commentId) : n.add(commentId); return n; });
    setCommentLikes((p) => ({ ...p, [commentId]: Math.max(0, (p[commentId] || 0) + (liked ? -1 : 1)) }));
    if (liked) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", session.user.id);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: session.user.id, week_id: week.id });
    }
  };

  const toggleCommentLaugh = async (commentId: string) => {
    if (!session || !week) return;
    const laughed = myCommentLaughs.has(commentId);
    setMyCommentLaughs((p) => { const n = new Set(p); laughed ? n.delete(commentId) : n.add(commentId); return n; });
    setCommentLaughs((p) => ({ ...p, [commentId]: Math.max(0, (p[commentId] || 0) + (laughed ? -1 : 1)) }));
    if (laughed) {
      await supabase.from("comment_laughs").delete().eq("comment_id", commentId).eq("user_id", session.user.id);
    } else {
      await supabase.from("comment_laughs").insert({ comment_id: commentId, user_id: session.user.id, week_id: week.id });
    }
  };

  const submitComment = async (submissionId: string) => {
    const text = (commentInputs[submissionId] || "").trim();
    const media = commentMedia[submissionId];
    if (!text && !media?.url || !session || !week) return;
    setCommentInputs((p) => ({ ...p, [submissionId]: "" }));
    setMentionState((p) => ({ ...p, [submissionId]: null }));
    setCommentMedia((p) => ({ ...p, [submissionId]: null }));
    const { error, data } = await supabase.from("song_comments")
      .insert({ week_id: week.id, submission_id: submissionId, user_id: session.user.id, text, media_url: media?.url ?? null })
      .select().single();
    if (error) {
      setCommentInputs((p) => ({ ...p, [submissionId]: text }));
      if (media?.url) setCommentMedia((p) => ({ ...p, [submissionId]: media }));
      toast("Failed to post comment", "error");
    } else {
      setComments((p) => ({ ...p, [submissionId]: [...(p[submissionId] || []), data] }));
    }
  };

  const handleCommentChange = (songId: string, value: string) => {
    setCommentInputs((p) => ({ ...p, [songId]: value }));
    // Detect @mention: find last @ and check nothing but word chars follow it
    const atIdx = value.lastIndexOf("@");
    if (atIdx !== -1 && /^\w*$/.test(value.slice(atIdx + 1))) {
      setMentionState((p) => ({ ...p, [songId]: { query: value.slice(atIdx + 1).toLowerCase(), atIndex: atIdx } }));
    } else {
      setMentionState((p) => ({ ...p, [songId]: null }));
    }
  };

  const insertMention = (songId: string, firstName: string) => {
    const ms = mentionState[songId];
    if (!ms) return;
    const current = commentInputs[songId] || "";
    const newVal = current.slice(0, ms.atIndex + 1) + firstName + " " + current.slice(ms.atIndex + 1 + ms.query.length);
    setCommentInputs((p) => ({ ...p, [songId]: newVal }));
    setMentionState((p) => ({ ...p, [songId]: null }));
  };

  const revealIdentities = async () => {
    if (identitiesRevealed || !week || !selectedLeagueId || !session) return;
    const res = await fetch("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekId: week.id, leagueId: selectedLeagueId }),
    });
    if (!res.ok) { toast("Failed to reveal", "error"); return; }
    setIdentitiesRevealed(true);
    setSubmissionsLocked(true);
    setJustRevealed(true);
    setTimeout(() => setJustRevealed(false), 2500);
    await loadAllForWeek(week.id);
    toast("Identities revealed! 🎉", "success");
  };

  const lockInVotes = async () => {
    if (!week || !session || !selectedLeagueId) return;
    const res = await fetch("/api/lock-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekId: week.id, leagueId: selectedLeagueId }),
    });
    if (res.ok) setVoteLocks((prev) => new Set([...prev, session.user.id]));
  };

  const startNewRound = async (overrideAuthorId?: string) => {
    if (!selectedLeagueId) return;
    const res = await fetch("/api/start-round", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId: selectedLeagueId, overrideAuthorId }),
    });
    const body = await res.json();
    if (!res.ok) { toast(body.error || "Failed to start round", "error"); return; }
    setNewRoundPick(null);
    window.location.reload();
  };

  const closeSubmissions = async () => {
    if (!week || !selectedLeagueId || !session) return;
    const res = await fetch("/api/close-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekId: week.id, leagueId: selectedLeagueId }),
    });
    if (!res.ok) { toast("Failed to close submissions", "error"); return; }
    toast("Submissions locked — songs revealed!", "success");
  };

  const submitPrompt = async () => {
    const text = promptInput.trim();
    if (!text || !week) return;
    const res = await fetch("/api/submit-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ weekId: week.id, prompt: text }),
    });
    const body = await res.json();
    if (!res.ok) { toast(body.error || "Failed to submit prompt", "error"); return; }
    toast("Prompt submitted! Round is live.", "success");
    window.location.reload();
  };

  const sendMagicLink = async () => {
    if (!magicEmail.trim()) return;
    const { error } = await supabase.auth.signInWithOtp({ email: magicEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) { toast("Couldn't send link: " + error.message, "error"); return; }
    setMagicSent(true);
  };

  const startSpotifyAuth = async () => {
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh_token");
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = "league_spotify_" + Math.random().toString(36).slice(2);
    localStorage.setItem("spotify_verifier", verifier);
    localStorage.setItem("spotify_state", state);
    const p = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "",
      response_type: "code",
      redirect_uri: window.location.origin,
      scope: "playlist-modify-public playlist-modify-private",
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      show_dialog: "true",
    });
    window.location.href = `https://accounts.spotify.com/authorize?${p}`;
  };

  const clearSpotifyToken = () => {
    setSpotifyToken(null);
    setSpotifyRefreshToken(null);
    localStorage.removeItem("spotify_token");
    localStorage.removeItem("spotify_refresh_token");
  };

  const refreshSpotifyToken = async (): Promise<string | null> => {
    const refreshTok = spotifyRefreshToken || localStorage.getItem("spotify_refresh_token");
    if (!refreshTok) return null;
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshTok,
        client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "",
      }),
    });
    const d = await res.json();
    if (d.access_token) {
      setSpotifyToken(d.access_token);
      localStorage.setItem("spotify_token", d.access_token);
      if (d.refresh_token) {
        setSpotifyRefreshToken(d.refresh_token);
        localStorage.setItem("spotify_refresh_token", d.refresh_token);
      }
      return d.access_token;
    }
    return null;
  };

  const exportToSpotify = async () => {
    if (!week) return;
    setExportingPlaylist(true);

    let token = spotifyToken;
    if (!token) {
      // Try to get a fresh token via refresh
      const refreshed = await refreshSpotifyToken();
      if (!refreshed) { toast("Connect Spotify first", "error"); setExportingPlaylist(false); return; }
      token = refreshed;
    }

    // Verify token is valid, refresh if not
    let meRes = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!meRes.ok) {
      const refreshed = await refreshSpotifyToken();
      if (!refreshed) { clearSpotifyToken(); toast("Spotify session expired — tap Connect Spotify", "error"); setExportingPlaylist(false); return; }
      token = refreshed;
      meRes = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) { clearSpotifyToken(); toast("Spotify reconnect required", "error"); setExportingPlaylist(false); return; }
    }

    try {
      const { data: freshSongs } = await supabase.from("song_submissions").select("spotify_url, resolved_spotify_id").eq("week_id", week.id);
      const uris = (freshSongs || [])
        .map((s: any) => s.resolved_spotify_id || getTrackId(s.spotify_url ?? ""))
        .filter(Boolean)
        .map((id: string) => `spotify:track:${id}`);
      if (!uris.length) { toast("No Spotify tracks to add", "error"); return; }

      const playlistName = `League of Music: ${week.prompt}`.slice(0, 100);
      const plRes = await fetch(`https://api.spotify.com/v1/me/playlists`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: playlistName, description: "Round submissions", public: true }),
      });
      const playlist = await plRes.json();
      if (!plRes.ok || !playlist.id) {
        console.error("Spotify playlist creation failed:", plRes.status, playlist);
        if (plRes.status === 401) { clearSpotifyToken(); toast("Spotify session expired — tap Connect Spotify", "error"); }
        else { toast(`Playlist creation failed: ${playlist.error?.message ?? plRes.status}`, "error"); }
        return;
      }

      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/items`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris }),
      });
      const addData = await addRes.json();
      if (!addRes.ok) {
        console.error("Spotify add tracks failed:", addRes.status, addData);
        toast(`Add tracks failed: ${addData.error?.message ?? addRes.status}`, "error");
        return;
      }
      toast("Playlist created! Opening…", "success");
      window.open(`https://open.spotify.com/playlist/${playlist.id}`, "_blank");
    } catch (e: any) {
      console.error("Spotify export error:", e);
      toast("Spotify export failed: " + (e?.message ?? "unknown"), "error");
    } finally {
      setExportingPlaylist(false);
    }
  };

  const generateInviteLink = async () => {
    if (!selectedLeagueId) return;
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId: selectedLeagueId }),
    });
    const body = await res.json();
    if (!res.ok || !body.token) { toast("Failed to generate invite link", "error"); return; }
    const link = `${window.location.origin}/join/${body.token}`;
    // Show the link in a modal — reliable on all browsers including mobile Safari.
    // Also attempt clipboard copy on desktop as a convenience.
    setInviteLink(link);
    if (!navigator.share) {
      try { await navigator.clipboard.writeText(link); } catch {}
    }
  };

  const shareRound = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "League of Music", text: week?.prompt, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast("Link copied!", "success");
    }
  };

  const requestLeague = async () => {
    if (!newLeagueName.trim() || !session) return;
    const res = await fetch("/api/request-league", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: newLeagueName.trim() }),
    });
    if (!res.ok) { toast("Failed to submit request", "error"); return; }
    setLeagueRequested(true);
    setRequestingLeague(false);
    setNewLeagueName("");
    setPendingRequests((p) => [...p, { id: Date.now(), name: newLeagueName.trim(), status: "pending" }]);
  };

  const renameLeague = async () => {
    if (!selectedLeagueId || !renameInput.trim() || !session) return;
    const trimmed = renameInput.trim();
    const res = await fetch("/api/rename-league", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId: selectedLeagueId, name: trimmed }),
    });
    const json = await res.json();
    if (!res.ok) { toast(json.error || "Failed to rename", "error"); return; }
    setMyLeagues((prev) => prev.map((l) => l.id === selectedLeagueId ? { ...l, name: trimmed } : l));
    setRenamingLeague(false);
    setRenameInput("");
    toast("League renamed!", "success");
  };

  const transferHost = async (newHostId: string) => {
    if (!selectedLeagueId || !session) return;
    const res = await fetch("/api/transfer-host", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId: selectedLeagueId, newHostId }),
    });
    const body = await res.json();
    if (!res.ok) { toast(body.error || "Failed to transfer", "error"); return; }
    toast("Ownership transferred", "success");
    setTransferring(false);
    window.location.reload();
  };

  const removeMember = async (memberId: string) => {
    if (!selectedLeagueId || !session) return;
    const res = await fetch("/api/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId: selectedLeagueId, memberId }),
    });
    const body = await res.json();
    if (!res.ok) { toast(body.error || "Failed to remove member", "error"); return; }
    toast("Member removed", "info");
    setProfilesMap((p) => { const n = { ...p }; delete n[memberId]; return n; });
  };

  /* ─────────────────────── Screens ─────────────────────── */

  const ToastStack = () => (
    <>
      {toasts.map((t, i) => (
        <div key={t.id}
          className={`toast fixed left-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl max-w-xs text-center pointer-events-none ${
            t.kind === "success" ? "bg-green-500 text-black" :
            t.kind === "error" ? "bg-red-500/90 text-white" :
            "bg-zinc-800 border border-zinc-700 text-white"
          }`}
          style={{ bottom: `${1.5 + i * 3}rem` }}>
          {t.msg}
        </div>
      ))}
    </>
  );

  /* ── Not logged in ── */
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center p-5 shadow-lg shadow-green-500/20"><IMusic /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">League of Music</h1>
            <p className="text-zinc-500 text-sm mt-1.5 max-w-xs">Submit songs. Comment. Rank your favorites. Compete with friends.</p>
          </div>
        </div>
        <button onClick={login} className="flex items-center gap-3 px-6 py-3.5 bg-white text-black rounded-2xl font-semibold text-sm shadow-lg active:scale-95 transition-transform">
          <GoogleLogo /> Continue with Google
        </button>
        <div className="w-full max-w-xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[11px] text-zinc-600 uppercase tracking-widest">or email link</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          {magicSent ? (
            <p className="text-center text-sm text-green-400 py-2">Check your email for a login link!</p>
          ) : (
            <div className="flex gap-2">
              <input type="email" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMagicLink()} placeholder="your@email.com" className="input flex-1 min-w-0" />
              <button onClick={sendMagicLink} disabled={!magicEmail.trim()} className="btn-primary px-4 flex-shrink-0 text-xs">Send</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Needs profile ── */
  if (needsProfile) {
    return (
      <div className="min-h-screen bg-black flex items-start justify-center px-5 pt-16 pb-10">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <div className="w-11 h-11 bg-green-500 rounded-2xl flex items-center justify-center p-2.5 mb-5"><IMusic /></div>
            <h1 className="text-2xl font-bold">Set up your profile</h1>
            <p className="text-zinc-500 text-sm mt-1">Let the league know who you are</p>
          </div>
          <div className="space-y-5">
            <Field label="Your name">
              <input maxLength={30} placeholder="Don Quixote" value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </Field>
            <Field label="Top 2 artists right now">
              <input maxLength={30} placeholder="Artist #1" value={artist1} onChange={(e) => setArtist1(e.target.value)} className="input" />
              <input maxLength={30} placeholder="Artist #2" value={artist2} onChange={(e) => setArtist2(e.target.value)} className="input mt-2" />
            </Field>
            <Field label="Song on repeat">
              <input maxLength={60} placeholder="Super Bass – Nicki Minaj" value={onRepeat} onChange={(e) => setOnRepeat(e.target.value)} className="input" />
            </Field>
          </div>
          <button onClick={createProfile} disabled={!name.trim()} className="btn-primary w-full">Join the League</button>
        </div>
      </div>
    );
  }

  /* ── Profile view ── */
  if (viewingUserId) {
    const viewed = profilesMap[viewingUserId];
    if (!viewed) { setViewingUserId(null); return null; }
    const isOwn = viewingUserId === session?.user?.id;

    return (
      <div className="min-h-screen bg-black">
        <ToastStack />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => { setViewingUserId(null); setEditingProfile(false); }} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white transition-colors">
              <IChevLeft /> Back
            </button>
            {isOwn && !editingProfile && (
              <button onClick={() => { setEditName(viewed.name); setEditArtist1(""); setEditArtist2(""); setEditOnRepeat(""); setEditingProfile(true); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 border border-zinc-800 rounded-full">
                <IEdit /> Edit
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <Avatar name={viewed.name} url={editAvatarPreview ?? viewed.avatar_url} size="lg"
                onClick={isOwn && editingProfile ? () => document.getElementById("avatar-upload")?.click() : undefined} />
              {isOwn && editingProfile && (
                <>
                  <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 pointer-events-none">
                    <span className="text-white text-lg">📷</span>
                  </div>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadAvatar(file);
                    if (url) setEditAvatarPreview(url);
                  }} />
                </>
              )}
            </div>
            <div>
              {editingProfile
                ? <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={30} className="input text-xl font-bold py-1.5" />
                : <h1 className="text-2xl font-bold leading-tight">{viewed.name}</h1>
              }
              {isOwn && editingProfile && <p className="text-[11px] text-zinc-600 mt-1">Tap photo to change</p>}
              {isOwn && !editingProfile && <p className="text-zinc-600 text-sm mt-0.5">{viewed.email}</p>}
            </div>
          </div>
          {editingProfile ? (
            <div className="space-y-4">
              <Field label="Top 2 artists">
                <input maxLength={30} placeholder={viewed.top_artists?.split(", ")[0] || "Artist #1"} value={editArtist1} onChange={(e) => setEditArtist1(e.target.value)} className="input" />
                <input maxLength={30} placeholder={viewed.top_artists?.split(", ")[1] || "Artist #2"} value={editArtist2} onChange={(e) => setEditArtist2(e.target.value)} className="input mt-2" />
              </Field>
              <Field label="Song on repeat">
                <input maxLength={60} placeholder={viewed.on_repeat || "Song – Artist"} value={editOnRepeat} onChange={(e) => setEditOnRepeat(e.target.value)} className="input" />
              </Field>
              <div className="flex gap-2 pt-2">
                <button onClick={saveProfile} disabled={!editName.trim()} className="btn-primary flex-1">Save</button>
                <button onClick={() => setEditingProfile(false)} className="flex-1 py-3 text-sm font-semibold border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {[["Top Artists", viewed.top_artists], ["On Repeat", viewed.on_repeat]].map(([label, value]) => (
                <div key={label as string} className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 space-y-0.5">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{label as string}</p>
                  <p className="text-sm text-white">{(value as string) || "—"}</p>
                </div>
              ))}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Rounds Won</p>
                <p className="text-2xl font-bold text-green-400">{viewed.wins || 0}</p>
              </div>
              {isOwn && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Total Points</p>
                  <p className="text-2xl font-bold text-green-400">{fmtScore(viewed.points || 0)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── League picker ── */
  if (!selectedLeagueId) {
    return (
      <div className="min-h-screen bg-black">
        <ToastStack />
        <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-zinc-900">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0"><IMusic /></div>
              <span className="font-bold text-sm">League of Music</span>
            </div>
            <div className="flex items-center gap-1">
              {profile && (
                <button onClick={() => { setProfilesMap((p) => ({ ...p, [session.user.id]: profile })); setViewingUserId(session.user.id); }}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition-colors">
                  <Avatar name={profile.name} url={profile.avatar_url} size="sm" />
                  <span className="text-zinc-300 text-xs font-medium">{profile.name.split(" ")[0]}</span>
                </button>
              )}
              <button onClick={logout} className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors"><ILogout /></button>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
          {myLeagues.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Your Leagues</p>
              {myLeagues.map((league: any) => (
                <button key={league.id}
                  onClick={() => { setSelectedLeagueId(league.id); setWentBack(false); localStorage.setItem("last_league", league.id); }}
                  className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 hover:border-zinc-700 transition-colors text-left active:scale-[.99]">
                  <div>
                    <p className="font-semibold text-white">{league.name}</p>
                    {league.created_by === session.user.id && <p className="text-[11px] text-green-400 mt-0.5">Host</p>}
                  </div>
                  <span className="text-zinc-600 text-xl leading-none">›</span>
                </button>
              ))}
            </div>
          )}
          {myLeagues.length === 0 && pendingRequests.length === 0 && !leagueRequested && (
            <div className="py-10 text-center">
              <p className="text-zinc-500 text-sm">You're not in any leagues yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Ask a host for an invite link, or create your own.</p>
            </div>
          )}
          {pendingRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Pending Approval</p>
              {pendingRequests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800/50 rounded-2xl px-4 py-3.5 opacity-70">
                  <p className="text-sm font-semibold text-zinc-400">{r.name}</p>
                  <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Pending</span>
                </div>
              ))}
            </div>
          )}
          {leagueRequested ? (
            <div className="bg-green-500/8 border border-green-500/20 rounded-2xl px-4 py-4 text-center">
              <p className="text-green-400 text-sm font-medium">Request sent!</p>
              <p className="text-zinc-500 text-xs mt-1">You'll get an email once your league is approved.</p>
            </div>
          ) : requestingLeague ? (
            <div className="space-y-2">
              <input value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && requestLeague()} placeholder="League name (e.g. The Boys)" className="input w-full" autoFocus />
              <div className="flex gap-2">
                <button onClick={requestLeague} disabled={!newLeagueName.trim()} className="btn-primary flex-1">Request League</button>
                <button onClick={() => { setRequestingLeague(false); setNewLeagueName(""); }} className="flex-1 py-3 text-sm font-semibold border border-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors">Cancel</button>
              </div>
              <p className="text-[11px] text-zinc-600 text-center px-2">Your request will be reviewed before the league goes live.</p>
            </div>
          ) : (
            <button onClick={() => setRequestingLeague(true)}
              className="w-full py-4 border border-zinc-800 border-dashed rounded-2xl text-sm font-semibold text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors">
              + Create a League
            </button>
          )}
        </main>
      </div>
    );
  }

  /* ─────────────────────── Main app ─────────────────────── */
  // Pre-reveal: keep submission order. Post-reveal: sort by score.
  const sorted = identitiesRevealed
    ? [...submissions].sort((a, b) => (voteScores[b.id] || 0) - (voteScores[a.id] || 0))
    : [...submissions].sort((a, b) => a.id.localeCompare(b.id));
  const maxScore = submissions.length ? Math.max(0, ...submissions.map((s) => voteScores[s.id] || 0)) : 0;
  const showFourRanks = submissions.length >= 6;
  // Dense-rank: songs with the same score share the same place (no gaps)
  const uniqueScoresDesc = [...new Set(sorted.map((s) => voteScores[s.id] || 0))].sort((a, b) => b - a);
  const densePlace = (songId: string) => uniqueScoresDesc.indexOf(voteScores[songId] || 0) + 1;
  const selectedLeague = myLeagues.find((l: any) => l.id === selectedLeagueId) ?? null;
  const isHost = selectedLeague?.created_by === session?.user?.id;
  const leaderboard = Object.values(profilesMap).sort((a: any, b: any) => (b.wins || 0) - (a.wins || 0));

  const isPendingPrompt = week?.status === "pending_prompt";
  const isPromptAuthor = week?.prompt_author_id === session?.user?.id;
  const promptAuthorName = profilesMap[week?.prompt_author_id]?.name ?? "Someone";
  const promptDeadlinePassed = week?.prompt_deadline ? new Date(week.prompt_deadline) < new Date() : false;

  // Has the current user commented on a given song?
  const hasCommentedOn = (songId: string) =>
    comments[songId]?.some((c: any) => c.user_id === session.user.id) ?? false;

  const renderMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("@")
        ? <span key={i} className="font-semibold text-blue-400">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  const hasSpotifyConnection = !!(spotifyToken || spotifyRefreshToken);
  const isLockedIn = voteLocks.has(session?.user?.id ?? "");

  return (
    <div className="min-h-screen bg-black">
      <ToastStack />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-zinc-900">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => { setSelectedLeagueId(null); setWentBack(true); localStorage.removeItem("last_league"); }}
              className="p-1 text-zinc-600 hover:text-white transition-colors flex-shrink-0" aria-label="Back to leagues">
              <IChevLeft />
            </button>
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0"><IMusic /></div>
            <span className="font-bold text-sm truncate">{selectedLeague?.name ?? "League"}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {profile && (
              <button onClick={() => setViewingUserId(session.user.id)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition-colors">
                <Avatar name={profile.name} url={profile.avatar_url} size="sm" />
                <span className="text-zinc-300 text-xs font-medium">{profile.name.split(" ")[0]}</span>
              </button>
            )}
            <button onClick={logout} className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors"><ILogout /></button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto"><TabBar active={activeTab} onChange={setActiveTab} /></div>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">

        {/* ── ROUND TAB ── */}
        {activeTab === "current" && (
          <div className="space-y-4">

            {/* Prompt card */}
            {week && (
              <div className="bg-indigo-300/15 border border-indigo-300/20 rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                    {isPendingPrompt ? "Awaiting Prompt" : "This Round"}
                  </p>
                  <div className="flex items-center gap-3">
                    {countdown && isPendingPrompt && (
                      <span className={`flex items-center gap-1 text-xs font-medium tabular-nums ${countdown === "Time's up!" ? "text-red-400" : "text-zinc-500"}`}>
                        <IClock /> {countdown}
                      </span>
                    )}
                    {!isPendingPrompt && (
                      <button onClick={shareRound} className="text-zinc-600 hover:text-zinc-300 transition-colors"><IShare /></button>
                    )}
                  </div>
                </div>
                {isPendingPrompt ? (
                  <p className="text-sm text-zinc-400 leading-snug">
                    {isPromptAuthor ? "It's your turn! Submit this week's prompt below." : `Waiting for ${promptAuthorName} to submit this week's prompt…`}
                  </p>
                ) : (
                  <p className="text-base font-semibold leading-snug">{week.prompt}</p>
                )}
              </div>
            )}

            {/* No rounds yet — welcome screen */}
            {!week && (
              <div className="space-y-6 py-4">
                <div className="rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-950 to-black p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center text-lg">🎵</div>
                    <div>
                      <p className="font-bold text-sm">Welcome to {selectedLeague?.name ?? "League of Music"}!</p>
                      <p className="text-xs text-zinc-500">{isHost ? "You're the host — start the first round when ready." : "Waiting for the host to kick things off."}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      ["1", "Someone picks a prompt", 'e.g. "songs that go hard at 3am"'],
                      ["2", "Everyone submits a song", "paste a Spotify or Apple Music link that fits"],
                      ["3", "Listen, comment & rank", "leave a comment before voting"],
                      ["4", "Guess & reveal", "who submitted what? find out at the end"],
                    ].map(([num, title, sub]) => (
                      <div key={num} className="flex gap-3 items-start">
                        <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{num}</span>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">{title}</p>
                          <p className="text-[11px] text-zinc-500">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Members in this league */}
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Players ({Object.keys(profilesMap).length})</p>
                  <div className="space-y-1.5">
                    {Object.values(profilesMap).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/40">
                        <Avatar name={p.name} url={p.avatar_url} size="sm" />
                        <span className="text-sm text-zinc-300">{p.name}</span>
                        {p.id === selectedLeague?.created_by && <span className="ml-auto text-[10px] text-zinc-600">host</span>}
                      </div>
                    ))}
                    {Object.keys(profilesMap).length === 0 && (
                      <p className="text-xs text-zinc-600 px-1">No other players yet — share the invite link!</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Prompt submission form */}
            {week && isPendingPrompt && (isPromptAuthor || isHost) && (
              <div className="space-y-1.5">
                {isHost && !isPromptAuthor && (
                  <p className="text-xs text-amber-400 px-1">{promptDeadlinePassed ? "Deadline passed —" : "As host, you can"} submit a prompt on behalf of {promptAuthorName}.</p>
                )}
                <div className="flex gap-2">
                  <input value={promptInput} onChange={(e) => setPromptInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitPrompt()} placeholder="e.g. Songs that hit different at 3am…" className="input flex-1 min-w-0" />
                  <button onClick={submitPrompt} disabled={!promptInput.trim()} className="btn-primary px-5 flex-shrink-0">Submit</button>
                </div>
              </div>
            )}

            {/* How-to-play banner */}
            {week && !isPendingPrompt && !identitiesRevealed && (
              <div className="rounded-2xl overflow-hidden border border-zinc-800/60 bg-gradient-to-br from-zinc-950 to-black">
                <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center gap-2">
                  <span className="text-sm">🎵</span>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">How it works</p>
                </div>
                <div className="px-4 py-4 space-y-4">
                  {[
                    { n: "1", title: "Submit a song!", sub: null },
                    { n: "2", title: "All songs revealed", sub: "Songs stay hidden until everyone has submitted." },
                    { n: "3", title: "⚡ Listen, comment & vote", sub: "Rank your top 3 by how well they fit the prompt. You must comment before you can vote." },
                    { n: "4", title: "Guess who submitted each song", sub: "This is just for fun!" },
                    { n: "5", title: "Scores tallied!", sub: null },
                  ].map(({ n, title, sub }) => (
                    <div key={n} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-green-400">{n}</span>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white leading-snug">{title}</p>
                        {sub && <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">{sub}</p>}
                      </div>
                    </div>
                  ))}
                  <p className="text-sm text-zinc-400 italic pl-8">There&apos;s technically a winner — but the real prize is the music we shared along the way. 😊</p>
                </div>
              </div>
            )}

            {/* Song submission */}
            {week && !isPendingPrompt && !submissionsLocked && (
              hasSubmitted ? (
                <div className="flex items-center gap-2.5 px-4 py-3.5 bg-green-500/8 border border-green-500/20 rounded-2xl">
                  <span className="text-green-500"><ICheck /></span>
                  <span className="text-green-400 text-sm font-medium">Song submitted!</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input value={spotifyUrl} onChange={(e) => { setSpotifyUrl(e.target.value); setUrlError(""); }} onKeyDown={(e) => e.key === "Enter" && submitSong()} placeholder="Paste a Spotify or Apple Music link…" className={`input flex-1 min-w-0 ${urlError ? "border-red-500/60" : ""}`} />
                    <button onClick={submitSong} disabled={!spotifyUrl.trim() || isSubmitting} className="btn-primary px-5 flex-shrink-0">{isSubmitting ? "…" : "Submit"}</button>
                  </div>
                  {urlError && <p className="text-xs text-red-400 px-1">{urlError}</p>}
                </div>
              )
            )}

            {/* Submission count + waiting state */}
            {week && !isPendingPrompt && !identitiesRevealed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{submissions.length} / {Object.keys(profilesMap).length} submitted</span>
                  <div className="flex items-center gap-2">
                    {submissions.length < Object.keys(profilesMap).length && (
                      <span className="text-xs text-zinc-700">waiting on {Object.keys(profilesMap).length - submissions.length} more…</span>
                    )}
                    {countdown && !submissionsLocked && (
                      <span className={`flex items-center gap-1 text-xs font-medium tabular-nums ${countdown === "Time's up!" ? "text-red-400" : "text-zinc-600"}`}>
                        <IClock /> {countdown}
                      </span>
                    )}
                  </div>
                </div>
                {submissionsLocked && (
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-zinc-800/60 bg-zinc-950">
                    <span className="text-lg">🎉</span>
                    <p className="text-sm font-semibold text-zinc-300">All songs are in!</p>
                  </div>
                )}
              </div>
            )}

            {/* Song cards — visible once submissions locked; identities hidden until reveal */}
            <div className="space-y-3">
              {week && isPendingPrompt && (
                <div className="py-12 text-center"><p className="text-zinc-600 text-sm">Round starts once the prompt is submitted.</p></div>
              )}
              {submissionsLocked && !identitiesRevealed && (
                <div className="space-y-1.5">
                  {voteCountdown && (
                    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${voteCountdown === "Time's up!" ? "border-red-500/30 bg-red-500/5" : "border-zinc-800/60 bg-zinc-950"}`}>
                      <div>
                        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-0.5">Voting closes in</p>
                        <span className={`text-xl font-bold tabular-nums tracking-tight ${voteCountdown === "Time's up!" ? "text-red-400" : "text-zinc-200"}`}>
                          {voteCountdown}
                        </span>
                      </div>
                      <IClock />
                    </div>
                  )}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] text-zinc-600">
                      {voteLocks.size} / {Object.keys(profilesMap).length} locked in
                    </span>
                  </div>
                  {isLockedIn ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-green-500/20 bg-green-500/5">
                      <span className="text-green-400 text-sm">✓</span>
                      <span className="text-sm font-semibold text-green-400">Votes locked in!</span>
                    </div>
                  ) : (
                    Object.keys(myRanks).length > 0 && sorted.filter((s) => s.user_id !== session.user.id).every((s) => hasCommentedOn(s.id)) && (
                      <button onClick={lockInVotes}
                        className="w-full py-4 text-sm font-semibold rounded-2xl bg-green-500 text-black active:scale-[.98] transition-all shadow-xl shadow-green-500/20">
                        Lock in votes
                      </button>
                    )
                  )}
                </div>
              )}
              {submissionsLocked && (() => {
                const otherSongs = sorted.filter((s) => s.user_id !== session.user.id);
                const allCommented = otherSongs.length > 0 && otherSongs.every((s) => hasCommentedOn(s.id));
                return sorted.map((song, index) => {
                const trackId = song.resolved_spotify_id || getTrackId(song.spotify_url ?? "") || "";
                const score = voteScores[song.id] || 0;
                // Only show leader styling after reveal
                const isWinner = identitiesRevealed && score === maxScore && maxScore > 0;
                const isOwnSong = song.user_id === session.user.id;
                const submitterName = isOwnSong ? "You" : profilesMap[song.user_id]?.name ?? "Player";
                const songRx = reactions[song.id] || {};
                const songComments = comments[song.id] || [];
                const isExpanded = expandedComments.has(song.id);
                const myGuess = guesses[song.id];
                const otherPlayers = Object.values(profilesMap).filter((p: any) => p.id !== session.user.id);
                const commented = hasCommentedOn(song.id);

                return (
                  <div key={song.id}
                    className={`rounded-2xl border overflow-hidden ${isWinner ? "border-amber-500/40 bg-amber-500/5" : "border-zinc-800/60 bg-zinc-950"}`}>

                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        {identitiesRevealed && score > 0 && <span className="text-xs font-bold tabular-nums text-zinc-600">#{densePlace(song.id)}</span>}
                        {isWinner && (
                          <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Winner</span>
                        )}
                      </div>
                      {identitiesRevealed && (
                        <button
                          onClick={() => { if (!isOwnSong) setViewingUserId(song.user_id); }}
                          className={`flex items-center gap-1.5 text-xs ${isOwnSong ? "text-zinc-600 cursor-default" : "text-zinc-400 hover:text-white transition-colors"} ${justRevealed ? "reveal-pop" : ""}`}
                          style={justRevealed ? { animationDelay: `${index * 80}ms` } : {}}>
                          <Avatar name={submitterName} url={isOwnSong ? profile?.avatar_url : profilesMap[song.user_id]?.avatar_url} size="sm" />
                          <span className="font-medium">{submitterName}</span>
                        </button>
                      )}
                    </div>

                    {/* Music embed — clicking activates this song and remounts others to stop playback */}
                    {trackId ? (
                      <div className="px-3 relative">
                        <iframe key={activeSongId === song.id ? trackId : `${trackId}-idle`}
                          src={`https://open.spotify.com/embed/track/${trackId}?theme=0`} width="100%" height="80"
                          allow="autoplay; clipboard-write; encrypted-media" loading="lazy" style={{ borderRadius: "10px" }} />
                        {activeSongId !== song.id && (
                          <div className="absolute inset-0" onClick={() => setActiveSongId(song.id)} />
                        )}
                      </div>
                    ) : isAppleMusicUrl(song.spotify_url ?? "") ? (
                      <div className="px-3 relative">
                        <iframe key={activeSongId === song.id ? song.id : `${song.id}-idle`}
                          src={getAppleMusicEmbedUrl(song.spotify_url ?? "")} width="100%" height="150"
                          allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" loading="lazy"
                          style={{ borderRadius: "10px", overflow: "hidden", background: "transparent" }} />
                        {activeSongId !== song.id && (
                          <div className="absolute inset-0" onClick={() => setActiveSongId(song.id)} />
                        )}
                      </div>
                    ) : null}

                    {/* Score + ranking buttons */}
                    <div className="flex items-center justify-between px-4 py-3">
                      {identitiesRevealed && score > 0 ? (
                        <span className="text-sm font-bold text-green-400 tabular-nums">{fmtScore(score)} pts</span>
                      ) : (
                        <span />
                      )}

                      {isOwnSong ? (
                        <span className="text-xs text-zinc-700 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">Your song</span>
                      ) : !identitiesRevealed ? (
                        allCommented ? (
                          <div className="flex gap-1.5">
                            {(showFourRanks ? [1, 2, 3, 4] as const : [1, 2, 3] as const).map((r) => {
                              const selected = myRanks[song.id] === r;
                              return (
                                <button key={r} onClick={() => !isLockedIn && setVoteRank(song.id, r)}
                                  className={`w-9 h-9 rounded-full text-xs font-bold transition-all border ${
                                    isLockedIn
                                      ? selected ? "bg-green-500/50 border-green-500/50 text-black cursor-default" : "border-zinc-800 text-zinc-700 cursor-default"
                                      : selected ? "bg-green-500 border-green-500 text-black active:scale-95" : "border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200 active:scale-95"
                                  }`}>
                                  #{r}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600 italic">💬 comment all songs to vote</span>
                        )
                      ) : (
                        myRanks[song.id]
                          ? <span className="text-xs text-zinc-600">you ranked #{myRanks[song.id]}</span>
                          : <span className="text-xs text-zinc-800">—</span>
                      )}
                    </div>

                    {/* Reactions + comment toggle */}
                    <div className="flex items-center gap-1.5 px-4 pb-3">
                      {EMOJIS.map((emoji) => {
                        const count = songRx[emoji] || 0;
                        const reacted = myReactions[song.id]?.has(emoji);
                        return (
                          <button key={emoji} onClick={() => toggleReaction(song.id, emoji)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                              reacted ? "bg-zinc-700 border-zinc-600 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                            }`}>
                            <span>{emoji}</span>
                            {count > 0 && <span className="tabular-nums">{count}</span>}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setExpandedComments((p) => { const n = new Set(p); n.has(song.id) ? n.delete(song.id) : n.add(song.id); return n; })}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ml-auto ${
                          isExpanded ? "border-blue-500/40 text-blue-300 bg-blue-500/10" : "border-blue-500/20 text-blue-400 hover:border-blue-500/40"
                        }`}>
                        <IComment />
                        {songComments.length > 0 && <span>{songComments.length}</span>}
                      </button>
                    </div>

                    {/* Guess who — available after commenting, before reveal */}
                    {!identitiesRevealed && !isOwnSong && commented && otherPlayers.length > 0 && (
                      <div className="px-4 pb-3 border-t border-zinc-800/40 pt-3">
                        <p className="text-[11px] text-zinc-400 font-medium mb-2">Who do you think submitted this?</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {otherPlayers.map((p: any) => (
                            <button key={p.id} onClick={async () => {
                                setGuesses((prev) => ({ ...prev, [song.id]: p.id }));
                                await supabase.from("song_guesses").upsert(
                                  { submission_id: song.id, user_id: session.user.id, guessed_user_id: p.id, week_id: week!.id },
                                  { onConflict: "submission_id,user_id" }
                                );
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                guesses[song.id] === p.id
                                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                              }`}>
                              {p.name.split(" ")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Guess result */}
                    {identitiesRevealed && !isOwnSong && myGuess && (
                      <div className="px-4 pb-3 border-t border-zinc-800/40 pt-2.5">
                        {myGuess === song.user_id
                          ? <p className="text-xs text-green-400 font-medium">✓ You guessed right!</p>
                          : <p className="text-xs text-zinc-500">✗ You guessed <span className="text-zinc-400">{profilesMap[myGuess]?.name?.split(" ")[0] || "?"}</span></p>
                        }
                      </div>
                    )}

                    {/* Comments */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800/40 px-4 py-3 space-y-3">
                        {songComments.length === 0 ? (
                          <p className="text-xs text-zinc-700">No comments yet — be the first!</p>
                        ) : songComments.map((c: any) => {
                          const liked = myCommentLikes.has(c.id);
                          const likeCount = commentLikes[c.id] || 0;
                          return (
                            <div key={c.id} className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <span className="text-[11px] font-semibold text-zinc-500">
                                  {c.user_id === session.user.id ? "You" : profilesMap[c.user_id]?.name?.split(" ")[0] || "Player"}
                                </span>
                                {c.text && <p className="text-sm text-zinc-300 leading-snug break-words">{renderMentions(c.text)}</p>}
                                {c.media_url && (
                                  <img src={c.media_url} alt="" className="mt-1.5 max-h-48 rounded-xl object-contain" />
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0 mt-3">
                                <button onClick={() => toggleCommentLaugh(c.id)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                                    myCommentLaughs.has(c.id) ? "bg-zinc-700 border-zinc-600 text-yellow-300" : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
                                  }`}>
                                  <span>😂</span>
                                  {(commentLaughs[c.id] || 0) > 0 && <span className="tabular-nums">{commentLaughs[c.id]}</span>}
                                </button>
                                <button onClick={() => toggleCommentLike(c.id)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                                    liked ? "bg-zinc-700 border-zinc-600 text-pink-400" : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
                                  }`}>
                                  <span>❤️</span>
                                  {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {(() => {
                          const ms = mentionState[song.id];
                          const suggestions = ms
                            ? Object.values(profilesMap)
                                .filter((p: any) => p.id !== session.user.id)
                                .filter((p: any) => p.name?.split(" ")[0]?.toLowerCase().startsWith(ms.query))
                            : [];
                          return (
                            <div className="pt-1 space-y-1.5">
                              {suggestions.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                  {(suggestions as any[]).map((p: any) => (
                                    <button key={p.id} onMouseDown={(e) => { e.preventDefault(); insertMention(song.id, p.name.split(" ")[0]); }}
                                      className="px-2.5 py-0.5 text-xs rounded-full border border-blue-500/30 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                                      @{p.name.split(" ")[0]}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {commentMedia[song.id]?.url && (
                                <div className="relative w-fit">
                                  <img src={commentMedia[song.id]!.url} alt="" className="max-h-24 rounded-xl object-contain border border-zinc-700" />
                                  <button onClick={() => setCommentMedia((p) => ({ ...p, [song.id]: null }))}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-400 text-xs flex items-center justify-center hover:text-white">✕</button>
                                </div>
                              )}
                              {commentMedia[song.id]?.uploading && (
                                <p className="text-xs text-zinc-500">Uploading…</p>
                              )}
                              <div className="flex gap-2">
                                <input maxLength={150} value={commentInputs[song.id] || ""}
                                  onChange={(e) => handleCommentChange(song.id, e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && submitComment(song.id)}
                                  placeholder="Say something nice or funny 😂"
                                  className="input flex-1 py-2 text-xs" />
                                <label className="flex items-center justify-center px-2.5 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer flex-shrink-0">
                                  🖼️
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCommentMedia(song.id, f); e.target.value = ""; }} />
                                </label>
                                <button onClick={() => submitComment(song.id)}
                                  disabled={!(commentInputs[song.id] || "").trim() && !commentMedia[song.id]?.url}
                                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-green-500 text-black disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 active:scale-95 transition-all">Post</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              });
              })()}


            </div>

            {/* Host controls */}
            {isHost && (
              <div className="pt-8 border-t border-zinc-900 mt-4 space-y-5">
                <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-widest">Host Controls</p>

                {transferring ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Transfer ownership to:</p>
                    {Object.values(profilesMap).filter((p: any) => p.id !== session.user.id).map((p: any) => (
                      <button key={p.id} onClick={() => transferHost(p.id)}
                        className="w-full py-2.5 text-sm border border-zinc-800 rounded-xl text-zinc-400 hover:border-amber-500/40 hover:text-amber-400 transition-colors">
                        {p.name}
                      </button>
                    ))}
                    {Object.values(profilesMap).filter((p: any) => p.id !== session.user.id).length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-2">No other members to transfer to.</p>
                    )}
                    <button onClick={() => setTransferring(false)} className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <>
                    {/* Round actions */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Round</p>
                      {week && !submissionsLocked && !isPendingPrompt && (
                        <button onClick={closeSubmissions}
                          className="w-full py-3 text-xs font-semibold rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all active:scale-95">
                          Lock & Show Songs
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={revealIdentities} disabled={!week || !submissionsLocked || identitiesRevealed}
                          className="py-3 text-xs font-semibold rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95">
                          Reveal Identities & Votes
                        </button>
                        {newRoundPick === null ? (
                          <button onClick={() => setNewRoundPick("random")} disabled={isPendingPrompt}
                            className="py-3 text-xs font-semibold rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95">
                            New Round
                          </button>
                        ) : (
                          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 space-y-2 col-span-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Prompt chooser</p>
                            <div className="flex flex-wrap gap-1.5">
                              <button onClick={() => setNewRoundPick("random")}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${newRoundPick === "random" ? "bg-green-500/20 border-green-500/40 text-green-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                                Random
                              </button>
                              {Object.values(profilesMap).map((p: any) => (
                                <button key={p.id} onClick={() => setNewRoundPick(p.id)}
                                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${newRoundPick === p.id ? "bg-green-500/20 border-green-500/40 text-green-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                                  {p.name.split(" ")[0]}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setNewRoundPick(null)}
                                className="flex-1 py-2 text-xs rounded-lg border border-zinc-700 text-zinc-500 hover:border-zinc-500 transition-colors">
                                Cancel
                              </button>
                              <button onClick={() => startNewRound(newRoundPick === "random" ? undefined : newRoundPick)}
                                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-green-500 text-black active:scale-95 transition-all">
                                Start
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notify */}
                    {week && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Notify</p>
                        {isPendingPrompt && (
                          <button onClick={() => window.open(`sms:?body=${encodeURIComponent(`🎵 Hey ${promptAuthorName}, it's your turn to pick the prompt for ${selectedLeague?.name}! You have 24 hours. ${window.location.origin}`)}`)}
                            className="w-full py-3 text-xs font-semibold rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-95">
                            📱 Text {promptAuthorName} — their turn
                          </button>
                        )}
                        {!isPendingPrompt && !week.all_submitted_at && !identitiesRevealed && (
                          <button onClick={() => window.open(`sms:?body=${encodeURIComponent(`🎵 New round in ${selectedLeague?.name}! This week's prompt: "${week.prompt}" — submit your song. ${window.location.origin}`)}`)}
                            className="w-full py-3 text-xs font-semibold rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-95">
                            📱 Text group — submit your song
                          </button>
                        )}
                        {week.all_submitted_at && !identitiesRevealed && (
                          <button onClick={() => window.open(`sms:?body=${encodeURIComponent(`🎵 All songs are in for ${selectedLeague?.name}! 48 hours to comment and vote. ${window.location.origin}`)}`)}
                            className="w-full py-3 text-xs font-semibold rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-95">
                            📱 Text group — songs are in
                          </button>
                        )}
                        {identitiesRevealed && (
                          <button onClick={() => window.open(`sms:?body=${encodeURIComponent(`🎉 Votes revealed for ${selectedLeague?.name}! See who won. ${window.location.origin}`)}`)}
                            className="w-full py-3 text-xs font-semibold rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors active:scale-95">
                            📱 Text group — results are in
                          </button>
                        )}
                      </div>
                    )}

                    {/* League */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">League</p>
                      {renamingLeague ? (
                        <div className="flex gap-2">
                          <input value={renameInput} onChange={(e) => setRenameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && renameLeague()} placeholder={selectedLeague?.name} maxLength={40} className="input flex-1 min-w-0 text-sm" autoFocus />
                          <button onClick={renameLeague} disabled={!renameInput.trim()} className="btn-primary px-4 text-xs">Save</button>
                          <button onClick={() => setRenamingLeague(false)} className="px-3 text-xs text-zinc-500 hover:text-white transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setRenameInput(selectedLeague?.name ?? ""); setRenamingLeague(true); }}
                          className="w-full py-3 text-xs font-semibold rounded-xl border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors">
                          Rename League
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={generateInviteLink}
                          className="py-3 text-xs font-semibold rounded-xl border border-zinc-800 text-zinc-500 hover:border-blue-500/40 hover:text-blue-400 transition-colors">
                          Invite Link
                        </button>
                        {process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID && (
                          submissionsLocked && submissions.length > 0 ? (
                            <button onClick={hasSpotifyConnection ? exportToSpotify : startSpotifyAuth} disabled={exportingPlaylist}
                              className="py-3 text-xs font-semibold rounded-xl border border-zinc-800 text-zinc-500 hover:border-green-500/40 hover:text-green-400 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                              {exportingPlaylist ? "Creating…" : hasSpotifyConnection ? "Export Playlist" : "Connect Spotify"}
                            </button>
                          ) : hasSpotifyConnection ? (
                            <div className="flex gap-2">
                              <div className="flex-1 py-3 text-xs font-semibold rounded-xl border border-green-500/20 text-green-500/60 text-center">Spotify ✓</div>
                              <button onClick={() => { clearSpotifyToken(); startSpotifyAuth(); }} className="py-3 px-3 text-xs rounded-xl border border-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors">Reconnect</button>
                            </div>
                          ) : (
                            <button onClick={startSpotifyAuth}
                              className="py-3 text-xs font-semibold rounded-xl border border-zinc-800 text-zinc-500 hover:border-green-500/40 hover:text-green-400 transition-colors">
                              Connect Spotify
                            </button>
                          )
                        )}
                      </div>
                      <button onClick={() => setTransferring(true)}
                        className="w-full py-3 text-xs font-semibold rounded-xl border border-zinc-800 text-zinc-500 hover:border-amber-500/40 hover:text-amber-400 transition-colors">
                        Transfer Ownership
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab === "leaderboard" && (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Who's in the group</p>
            {leaderboard.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No players yet.</p>
            ) : leaderboard.map((p: any) => {
              const isYou = p.id === session.user.id;
              return (
                <div key={p.id} className="relative">
                  <button onClick={() => setViewingUserId(p.id)}
                    className="w-full flex items-center gap-3 bg-zinc-950 border border-zinc-800/60 rounded-2xl px-4 py-3.5 hover:border-zinc-700 transition-colors text-left">
                    <Avatar name={p.name} url={p.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{p.name}{isYou && <span className="ml-1.5 text-[10px] text-zinc-600">(you)</span>}</p>
                      {p.top_artists && <p className="text-xs text-zinc-600 truncate">{p.top_artists}</p>}
                    </div>
                  </button>
                  {isHost && !isYou && (
                    <button onClick={() => removeMember(p.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-700 hover:text-red-400 transition-colors rounded-lg"
                      title="Remove from league">
                      <span className="text-sm font-bold">✕</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Round History</p>
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No rounds yet.</p>
            ) : history.filter((w: any) => w.id !== week?.id).map((w: any, i: number) => {
              const winnerNames = w.winners.map((s: any) => profilesMap[s.user_id]?.name ?? "Player").join(" & ");
              const isExpanded = expandedHistoryId === w.id;
              return (
                <div key={w.id} className="rounded-2xl border overflow-hidden border-zinc-800 bg-zinc-950">
                  <button className="w-full px-4 py-4 text-left space-y-2" onClick={() => setExpandedHistoryId(isExpanded ? null : w.id)}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                        {`Round ${history.filter((x: any) => x.id !== week?.id).length - i}`}
                      </span>
                      <span className="text-[11px] text-zinc-600">{fmtDate(w.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">{w.prompt || "Awaiting prompt…"}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-zinc-600">
                        {`${w.songs.length} submission${w.songs.length !== 1 ? "s" : ""}`}
                      </span>
                      {winnerNames
                        ? <span className="text-xs font-medium text-amber-400">🏆 {winnerNames}</span>
                        : <span className="text-xs text-zinc-700">No winner</span>
                      }
                    </div>
                  </button>
                  {isExpanded && w.songs.length > 0 && (
                    <div className="border-t border-zinc-800/60 px-4 py-3 space-y-3">
                      {w.songs.map((s: any, si: number) => {
                        const trackId = s.resolved_spotify_id || getTrackId(s.spotify_url ?? "") || "";
                        const submitter = w.revealed ? (profilesMap[s.user_id]?.name ?? "Player") : `Player ${si + 1}`;
                        const rxEntries = Object.entries(s.reactions || {}) as [string, number][];
                        const commentsOpen = expandedHistoryComments.has(s.id);
                        return (
                          <div key={s.id} className="rounded-xl border border-zinc-800/60 overflow-hidden">
                            {trackId ? (
                              <iframe src={`https://open.spotify.com/embed/track/${trackId}?theme=0`}
                                width="100%" height="80" allow="autoplay; clipboard-write; encrypted-media"
                                loading="lazy" style={{ borderRadius: "10px 10px 0 0", display: "block" }} />
                            ) : isAppleMusicUrl(s.spotify_url ?? "") ? (
                              <iframe src={getAppleMusicEmbedUrl(s.spotify_url ?? "")}
                                width="100%" height="150" allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
                                loading="lazy" style={{ borderRadius: "10px 10px 0 0", display: "block", overflow: "hidden", background: "transparent" }} />
                            ) : null}
                            <div className="px-3 py-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs font-bold ${si === 0 ? "text-amber-400" : "text-zinc-600"}`}>#{si + 1}</span>
                                <span className="text-xs text-zinc-500 truncate">{submitter}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {rxEntries.map(([emoji, count]) => count > 0 && (
                                  <span key={emoji} className="text-xs text-zinc-500">{emoji}{count}</span>
                                ))}
                                {s.commentCount > 0 && (
                                  <button onClick={() => setExpandedHistoryComments((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                                    className={`text-xs flex items-center gap-0.5 transition-colors ${commentsOpen ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400"}`}>
                                    <IComment />{s.commentCount}
                                  </button>
                                )}
                                <span className="text-xs font-semibold text-green-400 tabular-nums">{fmtScore(s.score)}pts</span>
                              </div>
                            </div>
                            {commentsOpen && s.comments?.length > 0 && (
                              <div className="border-t border-zinc-800/40 px-3 py-2.5 space-y-2">
                                {s.comments.map((c: any) => (
                                  <div key={c.submission_id + c.user_id + c.text} className="space-y-0.5">
                                    <span className="text-[11px] font-semibold text-zinc-500">
                                      {c.user_id === session.user.id ? "You" : profilesMap[c.user_id]?.name?.split(" ")[0] || "Player"}
                                    </span>
                                    {c.text && <p className="text-xs text-zinc-400 leading-snug">{renderMentions(c.text)}</p>}
                                    {c.media_url && <img src={c.media_url} alt="" className="max-h-32 rounded-lg object-contain mt-1" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>


      {/* Invite link modal — most reliable cross-browser way to share on mobile */}
      {inviteLink && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setInviteLink(null)}>
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Invite link</p>
              <p className="text-xs text-zinc-500">Tap the link below to copy, or use the share button.</p>
            </div>
            <input readOnly value={inviteLink}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-green-400 font-mono select-all"
              onFocus={(e) => e.target.select()} />
            <div className="flex gap-2">
              {navigator.share && (
                <button onClick={() => navigator.share!({ title: selectedLeague?.name ?? "League of Music", url: inviteLink }).catch(() => {})}
                  className="flex-1 py-3 text-xs font-semibold rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 transition-all active:scale-95">
                  Share…
                </button>
              )}
              <button onClick={() => setInviteLink(null)}
                className="flex-1 py-3 text-xs font-semibold rounded-xl border border-zinc-700 text-zinc-400 hover:text-white transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/common/AdminLayout";

interface Candidate {
  id: string;
  rank: number;
  video_id: string;
  title: string;
  channel_name: string;
  channel_id: string;
  thumbnail_url: string | null;
  video_url: string;
  views: number;
  likes: number;
  comments: number;
  published_at: string;
  score: number;
  source: "channel" | "keyword";
  window_hours: number;
  candidate_date: string;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function hoursAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (diff < 1) return `${Math.round(diff * 60)}m ago`;
  return `${diff.toFixed(1)}h ago`;
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-base-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-base-content/60">{value.toFixed(4)}</span>
    </div>
  );
}

export default function YouTubeDebugPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/debug");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setCandidates(data.candidates ?? []);
      setDate(data.date ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  async function runIngest() {
    setRunning(true);
    setRunResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/debug", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingest failed");
      setRunResult(
        `Done — ${data.picksInserted} picks inserted, ${data.candidatesFound} candidates found (${data.windowHoursUsed}h window)${data.errors?.length ? ` · ${data.errors.length} non-fatal errors` : ""}`
      );
      await fetchCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin" className="text-sm text-base-content/40 hover:text-primary transition-colors">Admin</Link>
              <span className="text-base-content/30">/</span>
              <Link href="/admin/news/channels" className="text-sm text-base-content/40 hover:text-primary transition-colors">News Sources</Link>
              <span className="text-base-content/30">/</span>
              <span className="text-sm font-semibold">Debug</span>
            </div>
            <h1 className="text-2xl font-black">YouTube Top-15 Debug</h1>
            <p className="text-sm text-base-content/50 mt-1">
              {date ? `Candidates for ${date}` : "Loading..."} · Use this to tune channel accuracy
            </p>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <Link href="/admin/news/channels" className="btn btn-sm btn-outline">
              Manage Channels
            </Link>
            <button
              onClick={runIngest}
              disabled={running}
              className="btn btn-sm btn-primary gap-2"
            >
              {running ? (
                <><span className="loading loading-spinner loading-xs" /> Running ingest...</>
              ) : (
                <>▶ Run Ingest Now</>
              )}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {runResult && (
          <div className="alert alert-success text-sm">{runResult}</div>
        )}
        {error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-base-content/50">
          <span className="flex items-center gap-1">
            <span className="badge badge-primary badge-sm">channel</span> from channel watchlist
          </span>
          <span className="flex items-center gap-1">
            <span className="badge badge-secondary badge-sm">keyword</span> from keyword search
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-warning/50 mr-1" /> ranks 1–3 = today's /news picks
          </span>
        </div>

        {/* Candidates table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-base-content/30">
            <span className="text-4xl">📭</span>
            <p className="font-semibold">No candidates yet for today</p>
            <p className="text-sm">Click "Run Ingest Now" to fetch today's videos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div
                key={c.id}
                className={`flex gap-4 p-4 rounded-2xl border transition-shadow hover:shadow-md ${
                  c.rank <= 3
                    ? "border-primary/30 bg-primary/5"
                    : "border-base-200 bg-base-100"
                }`}
              >
                {/* Rank */}
                <div className="flex-none w-8 text-center">
                  <span
                    className={`text-lg font-black ${
                      c.rank <= 3 ? "text-primary" : "text-base-content/30"
                    }`}
                  >
                    #{c.rank}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="flex-none w-28 h-16 bg-base-200 rounded-xl overflow-hidden">
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base-content/20 text-2xl">▶</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <a
                    href={c.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sm leading-snug line-clamp-2 hover:text-primary transition-colors"
                  >
                    {c.title}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-base-content/50 flex-wrap">
                    <span className="font-semibold text-base-content/70">{c.channel_name}</span>
                    <span>·</span>
                    <span>{formatViews(c.views)} views</span>
                    <span>·</span>
                    <span>{formatViews(c.likes)} likes</span>
                    <span>·</span>
                    <span>{formatViews(c.comments)} comments</span>
                    <span>·</span>
                    <span>{hoursAgo(c.published_at)}</span>
                    <span>·</span>
                    <span className={`badge badge-xs ${c.source === "channel" ? "badge-primary" : "badge-secondary"}`}>
                      {c.source}
                    </span>
                  </div>
                  <ScoreBar value={c.score} />
                </div>

                {/* Score detail */}
                <div className="flex-none text-right hidden sm:block">
                  <div className="text-xs text-base-content/40 space-y-0.5">
                    <div>window: {c.window_hours}h</div>
                    <div className="font-mono text-base-content/60">{c.score.toFixed(4)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-base-content/30 text-center">
          Score formula: views×0.4 + engagement×0.4 + freshness×0.2 · Top 3 are shown on{" "}
          <Link href="/news" target="_blank" className="underline hover:text-primary">
            /news
          </Link>
        </p>
      </div>
    </AdminLayout>
  );
}

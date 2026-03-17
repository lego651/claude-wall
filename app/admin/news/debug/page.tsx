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
  pool: string;
  is_live_stream: boolean;
}

type Tab = "video" | "live";

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function hoursAtIngest(iso: string, candidateDate: string): string {
  const ingestRef = new Date(`${candidateDate}T07:00:00Z`);
  const diff = (ingestRef.getTime() - new Date(iso).getTime()) / 3_600_000;
  if (diff < 1) return `${Math.round(diff * 60)}m`;
  return `${diff.toFixed(1)}h`;
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-base-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-base-content/60">{value.toFixed(4)}</span>
    </div>
  );
}

function PoolSection({
  label,
  candidates,
  highlightTop,
  highlightCount = 3,
}: {
  label: string;
  candidates: Candidate[];
  highlightTop: boolean;
  highlightCount?: number;
}) {
  if (candidates.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/40">{label}</h3>
      {candidates.map((c) => (
        <div
          key={c.id}
          className={`flex gap-4 p-4 rounded-2xl border transition-shadow hover:shadow-md ${
            highlightTop && c.rank <= highlightCount
              ? "border-primary/30 bg-primary/5"
              : "border-base-200 bg-base-100"
          }`}
        >
          {/* Rank */}
          <div className="flex-none w-8 text-center">
            <span className={`text-lg font-black ${highlightTop && c.rank <= highlightCount ? "text-primary" : "text-base-content/30"}`}>
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
              <span>{hoursAtIngest(c.published_at, c.candidate_date)} at ingest</span>
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
  );
}

function EmptyPool() {
  return (
    <div className="flex flex-col items-center py-16 gap-3 text-base-content/30">
      <span className="text-4xl">📭</span>
      <p className="font-semibold">No candidates for this pool today</p>
      <p className="text-sm">Click &ldquo;Run Ingest Now&rdquo; to fetch today&apos;s videos</p>
    </div>
  );
}

export default function YouTubeDebugPage() {
  const [videoMerged,  setVideoMerged]  = useState<Candidate[]>([]);
  const [liveMerged,   setLiveMerged]   = useState<Candidate[]>([]);
  const [videoChannel, setVideoChannel] = useState<Candidate[]>([]);
  const [liveChannel,  setLiveChannel]  = useState<Candidate[]>([]);
  const [videoKeyword, setVideoKeyword] = useState<Candidate[]>([]);
  const [liveKeyword,  setLiveKeyword]  = useState<Candidate[]>([]);
  const [date, setDate] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("video");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [ingestErrors, setIngestErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/debug");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setVideoMerged(data.videoMerged ?? []);
      setLiveMerged(data.liveMerged ?? []);
      setVideoChannel(data.videoChannel ?? []);
      setLiveChannel(data.liveChannel ?? []);
      setVideoKeyword(data.videoKeyword ?? []);
      setLiveKeyword(data.liveKeyword ?? []);
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
    setIngestErrors([]);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/debug", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingest failed");
      setRunResult(
        `Done — ${data.picksInserted} videos + ${data.livePicksInserted} live picks inserted, ${data.candidatesFound} candidates found (${data.windowHoursUsed}h window)`
      );
      if (data.errors?.length) setIngestErrors(data.errors);
      await fetchCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: string; mergedCount: number }[] = [
    { id: "video", label: "Videos",      icon: "▶", mergedCount: videoMerged.length },
    { id: "live",  label: "Live Streams", icon: "🔴", mergedCount: liveMerged.length },
  ];

  const isEmpty = activeTab === "video"
    ? videoMerged.length === 0 && videoChannel.length === 0 && videoKeyword.length === 0
    : liveMerged.length === 0 && liveChannel.length === 0 && liveKeyword.length === 0;

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
            <h1 className="text-2xl font-black">YouTube Ingest Debug</h1>
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
        {ingestErrors.length > 0 && (
          <div className="alert alert-warning text-sm flex-col items-start gap-1">
            <p className="font-semibold">{ingestErrors.length} non-fatal error{ingestErrors.length > 1 ? "s" : ""}:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {ingestErrors.map((e, i) => <li key={i} className="font-mono text-xs">{e}</li>)}
            </ul>
          </div>
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
            <span className="inline-block w-3 h-3 rounded bg-primary/30 mr-1" /> highlighted = today&apos;s /news picks
          </span>
        </div>

        {/* Video / Live tabs */}
        <div className="tabs tabs-bordered">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab gap-2 ${activeTab === tab.id ? "tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.mergedCount > 0 && (
                <span className="badge badge-sm badge-ghost">{tab.mergedCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="text-xs text-base-content/40 -mt-4">
          {activeTab === "video" && (
            <>Top 20 non-live videos (merged pool, ranks 1–10 shown on /news). Channel pool: top 10 non-live. Keyword pool: top 10 non-live. Scored independently per pool.</>
          )}
          {activeTab === "live" && (
            <>Top 10 live streams (merged pool, ranks 1–3 shown on /news). Channel pool: top 5 live. Keyword pool: top 5 live.</>
          )}
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : isEmpty ? (
          <EmptyPool />
        ) : (
          <div className="space-y-10">
            {activeTab === "video" && (
              <>
                <PoolSection
                  label={`Merged Top ${videoMerged.length} · non-live combined`}
                  candidates={videoMerged}
                  highlightTop={true}
                  highlightCount={10}
                />
                <PoolSection
                  label={`Channel Pool · top ${videoChannel.length} non-live`}
                  candidates={videoChannel}
                  highlightTop={false}
                />
                <PoolSection
                  label={`Keyword Pool · top ${videoKeyword.length} non-live`}
                  candidates={videoKeyword}
                  highlightTop={false}
                />
              </>
            )}
            {activeTab === "live" && (
              <>
                <PoolSection
                  label={`Merged Top ${liveMerged.length} · live streams combined`}
                  candidates={liveMerged}
                  highlightTop={true}
                  highlightCount={3}
                />
                <PoolSection
                  label={`Channel Pool · top ${liveChannel.length} live`}
                  candidates={liveChannel}
                  highlightTop={false}
                />
                <PoolSection
                  label={`Keyword Pool · top ${liveKeyword.length} live`}
                  candidates={liveKeyword}
                  highlightTop={false}
                />
              </>
            )}
          </div>
        )}

        <p className="text-xs text-base-content/30 text-center">
          Score formula: views×0.4 + engagement×0.4 + freshness×0.2 · Each pool normalized independently ·{" "}
          <Link href="/news" target="_blank" className="underline hover:text-primary">
            /news
          </Link>
        </p>
      </div>
    </AdminLayout>
  );
}

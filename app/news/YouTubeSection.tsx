"use client";

import { useState } from "react";

export interface YouTubePick {
  rank: number;
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string | null;
  video_url: string;
  views: number;
  ai_summary: string | null;
  published_at: string;
  video_type: "video" | "live";
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function VideoCard({ pick, rank }: { pick: YouTubePick; rank: number }) {
  return (
    <a
      href={pick.video_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 p-4 rounded-2xl border border-base-200 bg-base-100 hover:shadow-md hover:border-primary/20 transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative flex-none w-40 sm:w-48 aspect-video bg-base-200 rounded-xl overflow-hidden">
        {pick.thumbnail_url ? (
          <img
            src={pick.thumbnail_url}
            alt={pick.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base-content/30 text-3xl">▶</div>
        )}
        <span className="absolute top-2 left-2 badge badge-error text-white font-black text-xs">
          #{rank}
        </span>
        {pick.video_type === "live" && (
          <span className="absolute top-2 right-2 badge badge-accent text-white font-black text-xs animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-1 space-y-1.5">
        <h3 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {pick.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <span className="font-semibold">{pick.channel_name}</span>
          <span>·</span>
          <span>{formatViews(pick.views)} views</span>
        </div>
        {pick.ai_summary && (
          <p className="text-sm text-base-content/60 line-clamp-2 mt-1">{pick.ai_summary}</p>
        )}
      </div>
    </a>
  );
}

interface Props {
  videos: YouTubePick[];      // non-live, up to 10
  liveStreams: YouTubePick[]; // live, up to 3
}

export function YouTubeSection({ videos, liveStreams }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? videos : videos.slice(0, 3);
  const remaining = videos.length - 3;

  const handleExpand = async () => {
    setShowAll(true);
    try {
      await fetch("/api/events/youtube-expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "youtube_expand", metadata: { total: videos.length } }),
      });
    } catch {
      // analytics failure is non-blocking
    }
  };

  return (
    <>
      {/* Regular videos */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">▶</span>
          <h2 className="text-xl font-black text-base-content">Top Videos Today</h2>
        </div>

        {videos.length > 0 ? (
          <>
            <div className="flex flex-col gap-3">
              {displayed.map((pick) => (
                <VideoCard key={pick.video_id} pick={pick} rank={pick.rank} />
              ))}
            </div>

            {!showAll && remaining > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={handleExpand}
                  className="btn btn-outline btn-sm gap-2"
                >
                  Show {remaining} more video{remaining !== 1 ? "s" : ""}
                  <span className="text-base-content/40 text-xs">↓</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-base-content/30 gap-3">
            <span className="text-4xl">📭</span>
            <p className="font-semibold">No video picks yet — updated daily at 07:00 UTC</p>
          </div>
        )}
      </section>

      {/* Live streams — only shown when present */}
      {liveStreams.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
            </span>
            <h2 className="text-xl font-black text-base-content">Live Streams Now</h2>
          </div>
          <div className="flex flex-col gap-3">
            {liveStreams.map((pick) => (
              <VideoCard key={pick.video_id} pick={pick} rank={pick.rank} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

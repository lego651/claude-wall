/**
 * Public /news page — daily top-3 YouTube videos + top-3 Twitter posts.
 * Server component — reads from DB on each request (fresh picks).
 */

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";

export const metadata = getSEOTags({
  title: "Daily Prop Trading News | Top Videos & Tweets",
  description:
    "Today's top prop trading videos and industry tweets, curated daily by AI. Stay up to date on prop firms, challenges, and funded trading.",
  canonicalUrlRelative: "/news",
});

export const dynamic = "force-dynamic";

interface YouTubePick {
  rank: number;
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string | null;
  video_url: string;
  views: number;
  ai_summary: string | null;
  published_at: string;
}

interface Tweet {
  id: string;
  author_username: string;
  text: string;
  url: string;
  ai_summary: string | null;
  importance_score: number;
  tweeted_at: string;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function YouTubeCard({ pick }: { pick: YouTubePick }) {
  return (
    <a
      href={pick.video_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow group"
    >
      <figure className="relative aspect-video bg-base-200 overflow-hidden rounded-t-2xl">
        {pick.thumbnail_url ? (
          <img
            src={pick.thumbnail_url}
            alt={pick.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base-content/30 text-4xl">
            ▶
          </div>
        )}
        <span className="absolute top-3 left-3 badge badge-error text-white font-black text-xs">
          #{pick.rank}
        </span>
      </figure>
      <div className="card-body gap-2 p-5">
        <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {pick.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <span className="font-semibold">{pick.channel_name}</span>
          <span>·</span>
          <span>{formatViews(pick.views)} views</span>
        </div>
        {pick.ai_summary && (
          <p className="text-sm text-base-content/70 line-clamp-3 mt-1">{pick.ai_summary}</p>
        )}
      </div>
    </a>
  );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow group p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center font-bold text-sm text-base-content/60">
          {tweet.author_username[0]?.toUpperCase() ?? "X"}
        </div>
        <span className="font-semibold text-sm group-hover:text-primary transition-colors">
          @{tweet.author_username}
        </span>
      </div>
      <p className="text-sm text-base-content/80 leading-relaxed line-clamp-4">{tweet.text}</p>
      {tweet.ai_summary && (
        <p className="text-xs text-base-content/50 border-l-2 border-primary/30 pl-3 line-clamp-2">
          {tweet.ai_summary}
        </p>
      )}
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-16 text-base-content/30 gap-3">
      <span className="text-4xl">📭</span>
      <p className="font-semibold">{label}</p>
    </div>
  );
}

export default async function NewsPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: youtubePicks }, { data: tweets }] = await Promise.all([
    supabase
      .from("youtube_daily_picks")
      .select("rank, video_id, title, channel_name, thumbnail_url, video_url, views, ai_summary, published_at")
      .eq("pick_date", today)
      .order("rank"),

    supabase
      .from("firm_twitter_tweets")
      .select("id, author_username, text, url, ai_summary, importance_score, tweeted_at")
      .eq("firm_id", "industry")
      .eq("tweeted_at", today)
      .order("importance_score", { ascending: false })
      .limit(3),
  ]);

  const displayDate = new Date(today).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest">
          Daily Brief
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-base-content">
          Prop Trading News
        </h1>
        <p className="text-base-content/50 text-sm font-medium">{displayDate}</p>
      </div>

      {/* YouTube Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">▶</span>
          <h2 className="text-xl font-black text-base-content">Top Videos Today</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {youtubePicks && youtubePicks.length > 0 ? (
            (youtubePicks as YouTubePick[]).map((pick) => (
              <YouTubeCard key={pick.video_id} pick={pick} />
            ))
          ) : (
            <EmptyState label="No video picks yet today — check back after 07:00 UTC" />
          )}
        </div>
      </section>

      {/* Twitter Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">𝕏</span>
          <h2 className="text-xl font-black text-base-content">Top Posts Today</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tweets && tweets.length > 0 ? (
            (tweets as Tweet[]).map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))
          ) : (
            <EmptyState label="No posts yet today — check back later" />
          )}
        </div>
      </section>

      {/* Footer note */}
      <p className="text-center text-xs text-base-content/30">
        Curated daily by AI · Updated each morning ·{" "}
        <Link href="/propfirms" className="underline hover:text-primary transition-colors">
          Explore prop firms
        </Link>
      </p>
    </main>
  );
}

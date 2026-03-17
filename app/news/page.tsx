/**
 * Public /news page — top YouTube videos, top live streams, history, and top tweets.
 * Data is server-fetched; interactive expand lives in <YouTubeSection>.
 */

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import { YouTubeSection, type YouTubePick } from "./YouTubeSection";

export const metadata = getSEOTags({
  title: "Daily Prop Trading News | Top Videos & Tweets",
  description:
    "Today's top prop trading videos and industry tweets, curated daily by AI. Stay up to date on prop firms, challenges, and funded trading.",
  canonicalUrlRelative: "/news",
});

export const dynamic = "force-dynamic";

interface Tweet {
  id: string;
  author_username: string;
  text: string;
  url: string;
  ai_summary: string | null;
  importance_score: number;
  tweeted_at: string;
}

interface HistoryPick {
  pick_date: string;
  rank: number;
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string | null;
  video_url: string;
  views: number;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

function HistoryDay({ date, picks }: { date: string; picks: HistoryPick[] }) {
  return (
    <details className="group border border-base-200 rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none bg-base-100 hover:bg-base-200/50 transition-colors list-none">
        <span className="font-semibold text-sm text-base-content">{formatDate(date)}</span>
        <span className="text-xs text-base-content/40 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="divide-y divide-base-200">
        {picks.map((pick) => (
          <a
            key={pick.video_id}
            href={pick.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-5 py-3 hover:bg-base-200/40 transition-colors group"
          >
            {pick.thumbnail_url && (
              <img
                src={pick.thumbnail_url}
                alt={pick.title}
                className="w-20 h-12 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                {pick.title}
              </p>
              <p className="text-xs text-base-content/50 mt-0.5">
                {pick.channel_name} · {formatViews(pick.views)} views
              </p>
            </div>
            <span className="badge badge-ghost text-xs flex-shrink-0">#{pick.rank}</span>
          </a>
        ))}
      </div>
    </details>
  );
}

export default async function NewsPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ data: allPicks }, { data: tweets }, { data: historyRows }] = await Promise.all([
    // Today's picks — both video and live types
    supabase
      .from("youtube_daily_picks")
      .select("rank, video_id, title, channel_name, thumbnail_url, video_url, views, ai_summary, published_at, video_type")
      .eq("pick_date", today)
      .order("video_type")   // 'live' before 'video' alphabetically, but we split below
      .order("rank"),

    // Today's top tweets
    supabase
      .from("firm_twitter_tweets")
      .select("id, author_username, text, url, ai_summary, importance_score, tweeted_at")
      .eq("firm_id", "industry")
      .eq("tweeted_at", today)
      .order("importance_score", { ascending: false })
      .limit(3),

    // Past 7 days history — top 3 non-live per day
    supabase
      .from("youtube_daily_picks")
      .select("pick_date, rank, video_id, title, channel_name, thumbnail_url, video_url, views")
      .eq("video_type", "video")
      .lt("pick_date", today)
      .gte("pick_date", sevenDaysAgo)
      .lte("rank", 3)
      .order("pick_date", { ascending: false })
      .order("rank", { ascending: true }),
  ]);

  // Split today's picks by type
  const picks = (allPicks ?? []) as YouTubePick[];
  const videoPicks = picks.filter((p) => p.video_type === "video");
  const livePicks = picks.filter((p) => p.video_type === "live");

  // Group history by date
  const historyByDate = new Map<string, HistoryPick[]>();
  for (const row of (historyRows ?? []) as HistoryPick[]) {
    const existing = historyByDate.get(row.pick_date) ?? [];
    existing.push(row);
    historyByDate.set(row.pick_date, existing);
  }

  const displayDate = new Date(today).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const twitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE;

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
        <p className="text-base-content/50 text-sm font-medium">
          {displayDate} · Updated daily at 07:00 UTC
        </p>
      </div>

      {/* Digest signup CTA */}
      <div className="card bg-primary/5 border border-primary/20 max-w-xl mx-auto">
        <div className="card-body p-6 gap-3 text-center">
          <h2 className="font-black text-base text-base-content">
            Get the weekly intelligence report
          </h2>
          <p className="text-sm text-base-content/60">
            Payout trends, firm incidents, and top content — delivered every Sunday.
          </p>
          <Link
            href="/onboarding"
            className="btn btn-primary btn-sm w-full sm:w-auto sm:mx-auto"
          >
            Subscribe free →
          </Link>
        </div>
      </div>

      {/* YouTube section (client component handles expand + live split) */}
      <div className="space-y-12">
        <div className="flex items-center justify-between gap-3">
          <div /> {/* spacer */}
          {twitterHandle && (
            <a
              href={`https://twitter.com/${twitterHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-base-content/50 hover:text-primary transition-colors"
            >
              <span>𝕏</span>
              <span>@{twitterHandle}</span>
            </a>
          )}
        </div>
        <YouTubeSection videos={videoPicks} liveStreams={livePicks} />
      </div>

      {/* History */}
      {historyByDate.size > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-black text-base-content">Previous Days</h2>
          <div className="space-y-2">
            {[...historyByDate.entries()].map(([date, dayPicks]) => (
              <HistoryDay key={date} date={date} picks={dayPicks} />
            ))}
          </div>
        </section>
      )}

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
            <div className="col-span-3 flex flex-col items-center justify-center py-16 text-base-content/30 gap-3">
              <span className="text-4xl">📭</span>
              <p className="font-semibold">No posts yet today — check back later</p>
            </div>
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

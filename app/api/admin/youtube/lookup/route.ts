/**
 * GET /api/admin/youtube/lookup?url=<youtube_url>
 *
 * Resolves a YouTube channel URL to channel metadata and suggests a category.
 * Supports:
 *   https://www.youtube.com/@handle
 *   https://www.youtube.com/channel/UCxxxxxxxx
 *   https://www.youtube.com/c/name  (treated as handle)
 *   https://www.youtube.com/user/name
 *   Bare handle (@name) or channel ID (UCxxxxxxxx)
 */

import { NextResponse } from "next/server";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface ParsedChannel {
  type: "handle" | "channelId" | "username";
  value: string;
}

export function parseYouTubeInput(input: string): ParsedChannel | null {
  const trimmed = input.trim();

  // Bare channel ID
  if (/^UC[\w-]{20,}$/.test(trimmed)) {
    return { type: "channelId", value: trimmed };
  }

  // Bare handle (@xxx)
  if (/^@[\w.-]+$/.test(trimmed)) {
    return { type: "handle", value: trimmed.slice(1) };
  }

  // Full URL
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/$/, "");

    // /@handle
    const handleMatch = path.match(/^\/@([\w.-]+)$/);
    if (handleMatch) return { type: "handle", value: handleMatch[1] };

    // /channel/UCxxxxxxxx
    const channelMatch = path.match(/^\/channel\/(UC[\w-]+)$/);
    if (channelMatch) return { type: "channelId", value: channelMatch[1] };

    // /user/name
    const userMatch = path.match(/^\/user\/([\w.-]+)$/);
    if (userMatch) return { type: "username", value: userMatch[1] };

    // /c/name — treated as handle
    const customMatch = path.match(/^\/c\/([\w.-]+)$/);
    if (customMatch) return { type: "handle", value: customMatch[1] };
  } catch {
    // not a URL
  }

  return null;
}

export function suggestCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();

  // Review signals — must come before official check
  if (
    /\breview[s]?\b/.test(text) &&
    (/\bprop\b/.test(text) || /\bfunded\b/.test(text) || /\bfirm\b/.test(text))
  ) {
    return "prop_firm_review";
  }

  // Industry news
  if (
    /\b(bloomberg|reuters|cnbc|financial news|market news|markets today|business news)\b/.test(
      text
    )
  ) {
    return "industry_news";
  }

  // Prop firm official — the company itself
  if (
    /\b(we fund traders|funded accounts|our challenge|trader funding|prop (firm|trading) (llc|ltd|inc|group))\b/.test(
      text
    ) ||
    /\b(ftmo|topstep|earn2trade|apex trader|fundednext|funding ?pips|bluefx|true forex funds|the ?5ers)\b/.test(
      text
    )
  ) {
    return "prop_firm_official";
  }

  // Default: trading educator
  return "trading_educator";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const input = searchParams.get("url");

    if (!input) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY is not set" }, { status: 500 });
    }

    const parsed = parseYouTubeInput(input);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid YouTube URL or handle" }, { status: 400 });
    }

    let ytUrl: string;
    if (parsed.type === "handle") {
      ytUrl = `${YT_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(parsed.value)}&key=${apiKey}`;
    } else if (parsed.type === "channelId") {
      ytUrl = `${YT_BASE}/channels?part=snippet,statistics&id=${encodeURIComponent(parsed.value)}&key=${apiKey}`;
    } else {
      ytUrl = `${YT_BASE}/channels?part=snippet,statistics&forUsername=${encodeURIComponent(parsed.value)}&key=${apiKey}`;
    }

    const ytRes = await fetch(ytUrl);
    if (!ytRes.ok) {
      return NextResponse.json({ error: "YouTube API error" }, { status: 502 });
    }

    const data = (await ytRes.json()) as {
      items?: {
        id?: string;
        snippet?: {
          title?: string;
          description?: string;
          thumbnails?: {
            default?: { url?: string };
            medium?: { url?: string };
          };
        };
        statistics?: { subscriberCount?: string };
      }[];
    };

    const item = data.items?.[0];
    if (!item) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channelId = item.id ?? "";
    const channelName = item.snippet?.title ?? "";
    const description = item.snippet?.description ?? "";
    const thumbnail =
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "";
    const subscriberCount = parseInt(item.statistics?.subscriberCount ?? "0", 10) || 0;
    const suggestedCategory = suggestCategory(channelName, description);

    return NextResponse.json({
      channel_id: channelId,
      channel_name: channelName,
      description,
      thumbnail,
      subscriber_count: subscriberCount,
      suggested_category: suggestedCategory,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

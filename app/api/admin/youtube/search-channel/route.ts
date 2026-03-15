/**
 * GET /api/admin/youtube/search-channel?name=FTMO
 *
 * Searches YouTube for channels matching a firm name and returns the top
 * candidates. Used by the admin UI to discover official prop firm channels.
 *
 * Quota cost: 100 units per call (search.list). Use sparingly.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeSearchItem {
  snippet?: {
    channelId?: string;
    channelTitle?: string;
    description?: string;
    thumbnails?: { default?: { url?: string } };
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();

  if (!name) {
    return NextResponse.json({ error: "name parameter required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not configured" }, { status: 500 });
  }

  // Search for channels — append "official" to bias toward official channels
  const query = `${name} official`;
  const url =
    `${YT_BASE}/search?part=snippet&type=channel` +
    `&q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as { items?: YouTubeSearchItem[]; error?: { message?: string } };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "YouTube API error" },
        { status: 502 }
      );
    }

    const channels = (data.items ?? [])
      .map((item) => ({
        channel_id: item.snippet?.channelId ?? "",
        channel_name: item.snippet?.channelTitle ?? "",
        description: (item.snippet?.description ?? "").slice(0, 200),
        thumbnail: item.snippet?.thumbnails?.default?.url ?? "",
      }))
      .filter((c) => c.channel_id);

    return NextResponse.json({ channels });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

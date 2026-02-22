/**
 * Apify Twitter/X scraper client (S8-TW-002)
 *
 * Runs the Kaito "Cheapest" Tweet Scraper Actor via Apify REST API,
 * polls until done, fetches dataset, and returns normalized tweets.
 */

const DEFAULT_ACTOR_ID = "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest";
const POLL_INTERVAL_MS = 5000;
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface NormalizedTweet {
  id: string;
  text: string;
  url: string;
  authorUsername: string;
  createdAt: string; // ISO
}

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId?: string;
  };
}

interface ApifyDatasetItem {
  id?: string;
  url?: string;
  text?: string;
  createdAt?: string;
  author?: { userName?: string; username?: string };
}

function getToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token?.trim()) {
    throw new Error("APIFY_TOKEN is not set. Set it in .env or environment.");
  }
  return token.trim();
}

function getActorId(): string {
  return process.env.APIFY_TWITTER_ACTOR_ID?.trim() || DEFAULT_ACTOR_ID;
}

/**
 * Normalize a raw Apify dataset item to our common shape.
 * Handles Kaito output: id, url, text, createdAt, author.userName.
 */
function normalizeItem(item: ApifyDatasetItem): NormalizedTweet | null {
  const id = item.id ?? (item as Record<string, unknown>)?.id_str ?? "";
  const url = item.url ?? "";
  const text = item.text ?? "";
  const author = item.author;
  const authorUsername =
    (author && ("userName" in author ? author.userName : author.username)) ?? "";

  if (!id || !url) return null;

  let createdAt = item.createdAt;
  if (typeof createdAt === "string" && !/^\d{4}-\d{2}-\d{2}/.test(createdAt)) {
    // Kaito returns "Thu Oct 17 09:30:41 +0000 2024" – parse to ISO
    try {
      const d = new Date(createdAt);
      createdAt = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch {
      createdAt = new Date().toISOString();
    }
  }
  const createdAtStr = typeof createdAt === "string" ? createdAt : new Date().toISOString();

  return {
    id: String(id),
    text: String(text).slice(0, 10000),
    url: String(url),
    authorUsername: String(authorUsername),
    createdAt: createdAtStr,
  };
}

/**
 * Start an Actor run and return run id.
 */
async function startRun(
  token: string,
  actorId: string,
  input: { searchTerms: string[]; maxItems: number; queryType: string }
): Promise<string> {
  const url = `https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify start run failed: ${res.status} ${res.statusText} ${body}`);
  }
  const data = (await res.json()) as ApifyRunResponse;
  if (!data?.data?.id) throw new Error("Apify run response missing run id");
  return data.data.id;
}

/**
 * Poll run status until SUCCEEDED or FAILED; return defaultDatasetId.
 */
async function waitForRun(
  token: string,
  runId: string,
  timeoutMs: number = RUN_TIMEOUT_MS
): Promise<string> {
  const start = Date.now();
  const pollUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`;

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(pollUrl);
    if (!res.ok) {
      throw new Error(`Apify get run failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as ApifyRunResponse;
    const status = data?.data?.status;
    const datasetId = data?.data?.defaultDatasetId;

    if (status === "SUCCEEDED" && datasetId) return datasetId;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Apify run timed out after ${timeoutMs}ms`);
}

/**
 * Fetch dataset items as JSON.
 */
async function getDatasetItems(token: string, datasetId: string): Promise<ApifyDatasetItem[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apify get dataset failed: ${res.status} ${res.statusText}`);
  }
  const items = (await res.json()) as ApifyDatasetItem[];
  return Array.isArray(items) ? items : [];
}

export interface RunTwitterSearchOptions {
  /** Search terms (Twitter query syntax). Each term is run; maxItems applies per term. */
  searchTerms: string[];
  /** Max items per search term (Kaito min 20). Default 50. */
  maxItemsPerTerm?: number;
  /** Optional total cap across all terms (we stop after this many normalized tweets). */
  maxItemsTotal?: number;
}

/**
 * Run the Twitter scraper Actor with the given search terms and return normalized tweets.
 * On Apify failure or timeout, logs and returns empty array (does not throw).
 */
export async function runTwitterSearch(
  options: RunTwitterSearchOptions
): Promise<NormalizedTweet[]> {
  const { searchTerms, maxItemsPerTerm = 50, maxItemsTotal } = options;
  const token = getToken();
  const actorId = getActorId();

  if (!searchTerms.length) return [];

  const maxItems = Math.max(20, Math.min(maxItemsPerTerm, 1000)); // Kaito min 20
  const input = {
    searchTerms,
    maxItems,
    queryType: "Latest",
  };

  try {
    const runId = await startRun(token, actorId, input);
    const datasetId = await waitForRun(token, runId);
    const rawItems = await getDatasetItems(token, datasetId);

    const seen = new Set<string>();
    const out: NormalizedTweet[] = [];
    for (const item of rawItems) {
      const norm = normalizeItem(item);
      if (!norm || seen.has(norm.id)) continue;
      seen.add(norm.id);
      out.push(norm);
      if (maxItemsTotal != null && out.length >= maxItemsTotal) break;
    }
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Apify Twitter] Run failed:", message);
    return [];
  }
}

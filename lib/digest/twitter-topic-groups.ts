/**
 * Twitter topic grouping (TG-004)
 * Groups industry tweets by topic_title (≥3 per topic) and stores in twitter_topic_groups
 * for weekly-review UI (1–3 cards like Trustpilot incidents).
 */

import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient } from "@/lib/ai/openai-client";
import { getWeekBoundsUtc, getWeekNumberUtc, getYearUtc } from "./week-utils";

const MIN_ITEMS_PER_GROUP = 3;

export interface TwitterTopicGroupInput {
  topic_title: string;
  item_ids: number[];
  summaries: string[];
}

export interface TwitterTopicGroupRow {
  id: number;
  topic_title: string;
  summary: string;
  item_type: string;
  item_ids: number[];
  source_type: string;
  week_start: string;
  year: number;
  week_number: number;
  firm_id: string | null;
  published: boolean;
}

function normalizeTopicTitle(s: string | null): string {
  if (!s || typeof s !== "string") return "";
  return s.trim().toLowerCase().slice(0, 200);
}

/**
 * Fetch industry Twitter items for the week and group by normalized topic_title.
 * Returns groups with ≥ MIN_ITEMS_PER_GROUP items.
 */
export async function buildIndustryTopicGroups(
  weekStart: Date,
  weekEnd: Date
): Promise<TwitterTopicGroupInput[]> {
  const supabase = createServiceClient();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("industry_news_items")
    .select("id, topic_title, ai_summary")
    .eq("source_type", "twitter")
    .gte("content_date", weekStartStr)
    .lte("content_date", weekEndStr)
    .not("topic_title", "is", null);

  if (error) throw new Error(`Failed to fetch industry tweets: ${error.message}`);
  if (!rows?.length) return [];

  const byTopic = new Map<string, { id: number; ai_summary: string | null }[]>();
  for (const r of rows as { id: number; topic_title: string | null; ai_summary: string | null }[]) {
    const key = normalizeTopicTitle(r.topic_title);
    if (!key) continue;
    const list = byTopic.get(key) ?? [];
    list.push({ id: r.id, ai_summary: r.ai_summary });
    byTopic.set(key, list);
  }

  const groups: TwitterTopicGroupInput[] = [];
  for (const [topicTitle, items] of byTopic) {
    if (items.length < MIN_ITEMS_PER_GROUP) continue;
    groups.push({
      topic_title: topicTitle,
      item_ids: items.map((i) => i.id),
      summaries: items.map((i) => (i.ai_summary || "").slice(0, 300)),
    });
  }
  return groups;
}

/**
 * Generate one summary per group via batch OpenAI call.
 */
async function generateGroupSummariesBatch(
  groups: TwitterTopicGroupInput[]
): Promise<string[]> {
  if (groups.length === 0) return [];

  const openai = getOpenAIClient();
  const parts = groups.map(
    (g, idx) =>
      `--- Topic ${idx + 1}: "${g.topic_title}" (${g.item_ids.length} tweets) ---\n` +
      g.summaries.map((s, i) => `${i + 1}. ${s || "(no summary)"}`).join("\n")
  );
  const prompt = `Summarize each of the following ${groups.length} tweet topic clusters for a prop trading newsletter. Each cluster has multiple tweet summaries. Produce one short aggregated summary (1-2 sentences, max 250 chars) per cluster in the same order.

Respond with JSON: {"results": [{"summary":"..."}, ...]} with exactly ${groups.length} objects. No other text.`;

  const fullContent = prompt + "\n\n" + parts.join("\n\n");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: fullContent }],
    temperature: 0.2,
    max_tokens: Math.min(4096, 300 * groups.length),
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response for topic group summaries");
  const parsed = JSON.parse(raw) as { results?: Array<{ summary?: string }> };
  const arr = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!arr || arr.length < groups.length) {
    throw new Error(`Expected ${groups.length} summaries, got ${arr?.length ?? 0}`);
  }

  return arr.slice(0, groups.length).map((o) => String(o?.summary ?? "").slice(0, 2000));
}

/**
 * Run topic grouping for the given week: build groups, generate summaries, replace rows in twitter_topic_groups.
 */
export async function runIndustryTopicGrouping(
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  const groups = await buildIndustryTopicGroups(weekStart, weekEnd);
  if (groups.length === 0) return 0;

  const summaries = await generateGroupSummariesBatch(groups);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);

  const supabase = createServiceClient();

  await supabase
    .from("twitter_topic_groups")
    .delete()
    .eq("week_start", weekStartStr)
    .eq("item_type", "industry")
    .is("firm_id", null);

  const rows = groups.map((g, i) => ({
    topic_title: g.topic_title,
    summary: summaries[i] ?? "",
    item_type: "industry",
    item_ids: g.item_ids,
    source_type: "twitter",
    week_start: weekStartStr,
    year,
    week_number: weekNumber,
    firm_id: null,
    published: false,
  }));

  const { error } = await supabase.from("twitter_topic_groups").insert(rows);
  if (error) throw new Error(`Failed to store topic groups: ${error.message}`);
  return rows.length;
}

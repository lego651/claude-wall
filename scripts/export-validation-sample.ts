/**
 * TICKET-007: Classification Validation – export 50 random reviews with classifier output
 *
 * Fetches up to 150 reviews from DB, picks 50 at random, runs classifier on each
 * (without updating DB), writes CSV for manual review. PM fills category_ok, severity_ok, notes.
 *
 * Run: npx tsx scripts/export-validation-sample.ts
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createWriteStream } from 'fs';
config({ path: resolve(process.cwd(), '.env') });

import { createServiceClient } from '../libs/supabase/service';
import { classifyReview } from '../lib/ai/classifier';

const SAMPLE_SIZE = 50;
const FETCH_LIMIT = 150;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log('TICKET-007: Export validation sample (50 reviews)\n');

  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from('trustpilot_reviews')
    .select('id, firm_id, rating, title, review_text')
    .limit(FETCH_LIMIT);

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.error('No reviews in DB. Run backfill first.');
    process.exit(1);
  }

  const sample = shuffle(rows).slice(0, Math.min(SAMPLE_SIZE, rows.length));
  console.log(`Selected ${sample.length} random reviews. Running classifier...\n`);

  const outPath = resolve(process.cwd(), `validation-sample-${new Date().toISOString().slice(0, 10)}.csv`);
  const stream = createWriteStream(outPath, { encoding: 'utf8' });

  const header =
    'id,firm_id,rating,title,review_text_snippet,category,severity,confidence,summary,category_ok,severity_ok,notes\n';
  stream.write(header);

  for (let i = 0; i < sample.length; i++) {
    const row = sample[i];
    const textSnippet = (row.review_text ?? '').slice(0, 200).replace(/\n/g, ' ');
    let category = '';
    let severity = '';
    let confidence = '';
    let summary = '';

    try {
      const result = await classifyReview({
        rating: row.rating,
        title: row.title ?? undefined,
        text: row.review_text ?? '',
      });
      category = result.category;
      severity = result.severity ?? '';
      confidence = String(result.confidence);
      summary = result.summary;
    } catch (err) {
      summary = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }

    const line = [
      row.id,
      row.firm_id,
      row.rating,
      escapeCsv((row.title ?? '').slice(0, 100)),
      escapeCsv(textSnippet),
      category,
      severity,
      confidence,
      escapeCsv(summary.slice(0, 300)),
      '', // category_ok – PM fills Y/N
      '', // severity_ok – PM fills Y/N
      '', // notes
    ].join(',') + '\n';
    stream.write(line);

    if ((i + 1) % 10 === 0) console.log(`  Classified ${i + 1}/${sample.length}`);
  }

  stream.end();
  console.log(`\nWrote ${outPath}`);
  console.log('Next: Open in Excel/Sheets, fill category_ok and severity_ok (Y/N), then compute accuracy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

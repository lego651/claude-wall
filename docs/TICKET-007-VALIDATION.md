# TICKET-007: Classification Validation

**Goal:** Manually validate AI classification accuracy (target: >80% category, >75% severity).

---

## 1. Export 50 random reviews with classifier output

```bash
npx tsx scripts/export-validation-sample.ts
```

- Fetches reviews from `trustpilot_reviews`, picks 50 at random, runs the classifier on each (does **not** update DB).
- Writes **`validation-sample-YYYY-MM-DD.csv`** in the project root.

**Requires:** `.env` with `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Review in spreadsheet

Open the CSV in Excel or Google Sheets.

| Column | Description |
|--------|--------------|
| id, firm_id, rating, title, review_text_snippet | From DB |
| category, severity, confidence, summary | Classifier output |
| **category_ok** | You fill: **Y** if category is correct, **N** if wrong |
| **severity_ok** | You fill: **Y** if severity is correct (or N/A for positive/neutral/noise), **N** if wrong |
| **notes** | Optional: e.g. "should be platform_issue" |

---

## 3. Compute accuracy

- **Category accuracy:** `(count of category_ok = Y) / 50`. Target: **>80%** (e.g. 41+ correct).
- **Severity accuracy:** For rows where a severity is expected (negative categories), `(count of severity_ok = Y) / (number of negative rows)`. Target: **>75%**. For simplicity you can use all 50 and mark N/A as Y if severity was null and that was correct.

---

## 4. Document errors

- Keep a list of misclassified reviews (id + expected vs actual category/severity) in a tab or separate doc.
- Use this to adjust the prompt in `lib/ai/classifier.ts` (e.g. add examples, clarify category definitions).

---

## 5. If accuracy is below target

- Edit the classifier prompt in **`lib/ai/classifier.ts`** (`buildPrompt`).
- Re-run the export script to get a fresh 50 (or re-classify the same 50), then repeat steps 2–4 until category >80% and severity >75%.

---

## Acceptance criteria (alpha_tickets.md)

- [ ] Select 50 random reviews from backfilled data
- [ ] Run classifier on all 50 (export script does this)
- [ ] PM manually reviews: correct category? correct severity? useful summary?
- [ ] Document errors in spreadsheet
- [ ] Adjust prompt if accuracy <80%; re-run until target met

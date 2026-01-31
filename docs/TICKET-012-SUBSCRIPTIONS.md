# TICKET-012: Subscription API Endpoints

API routes for managing which firms a user **follows** for the weekly digest. Users receive one aggregated email per week with reports for all firms they follow.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscriptions` | List firms the user follows |
| POST | `/api/subscriptions` | Subscribe to (follow) a firm |
| DELETE | `/api/subscriptions/[firmId]` | Unfollow a firm |

All routes require authentication. Unauthenticated requests return `401 Unauthorized`.

---

### GET /api/subscriptions

**Auth:** Required (session cookie).

**Response (200):**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "firm_id": "fundingpips",
      "firm": {
        "id": "fundingpips",
        "name": "FundingPips",
        "logo_url": "/logos/firms/fundingpips.jpeg",
        "website": "https://fundingpips.com"
      },
      "subscribed_at": "2026-01-30T12:00:00.000Z",
      "email_enabled": true,
      "next_report_date": "2026-02-03"
    }
  ]
}
```

---

### POST /api/subscriptions

**Auth:** Required.

**Body:** `{ "firm_id": "fundingpips" }`

**Validation:**
- `firm_id` required; must exist in `firms` table (404 if not found).
- Duplicate subscribe returns existing subscription with `already_subscribed: true`.

**Response (200) – new subscription:**
```json
{
  "subscription": {
    "id": 1,
    "firm_id": "fundingpips",
    "firm": { "id": "fundingpips", "name": "FundingPips", "logo_url": "...", "website": "..." },
    "subscribed_at": "2026-01-30T12:00:00.000Z",
    "email_enabled": true,
    "next_report_date": "2026-02-03"
  },
  "already_subscribed": false
}
```

**Response (200) – already subscribed:** Same shape with `already_subscribed: true`.

---

### DELETE /api/subscriptions/[firmId]

**Auth:** Required.

**Params:** `firmId` – firm slug (e.g. `fundingpips`). Case-insensitive.

**Response:** `204 No Content` on success.

**404:** No subscription found for this user and firm.

---

## How to test and verify

### Option A: Browser (easiest)

1. **Start the app and sign in**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`, go to **Sign In**, and log in.

2. **Open DevTools** (F12 or Cmd+Option+I) → **Console** tab.

3. **Run these in the Console** (same-origin so cookies are sent automatically):

   **List subscriptions (should be empty at first):**
   ```js
   fetch('/api/subscriptions').then(r => r.json()).then(console.log)
   ```
   Expect: `{ subscriptions: [] }` or 401 if not logged in.

   **Subscribe to a firm:**
   ```js
   fetch('/api/subscriptions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ firm_id: 'fundingpips' })
   }).then(r => r.json()).then(console.log)
   ```
   Expect: 200 with `subscription` and `already_subscribed: false` (or `true` if you already subscribed).

   **List again (should include the firm):**
   ```js
   fetch('/api/subscriptions').then(r => r.json()).then(console.log)
   ```

   **Unfollow:**
   ```js
   fetch('/api/subscriptions/fundingpips', { method: 'DELETE' }).then(r => console.log(r.status, r.statusText))
   ```
   Expect: status `204`. Then run the list snippet again — the firm should be gone.

   **Invalid firm (404):**
   ```js
   fetch('/api/subscriptions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ firm_id: 'nonexistent' })
   }).then(r => r.json()).then(console.log)
   ```
   Expect: 404 with `{ error: "Firm not found" }`.

4. **Test without auth (401):** Open a private/incognito window (or sign out), go to `http://localhost:3000`, open Console and run:
   ```js
   fetch('/api/subscriptions').then(r => r.json()).then(console.log)
   ```
   Expect: 401 with `{ error: "Unauthorized" }`.

### Option B: curl (with session cookie)

1. Sign in at `http://localhost:3000/signin` in your browser.
2. DevTools → **Application** (or **Storage**) → **Cookies** → `http://localhost:3000`. Copy the value of the Supabase auth cookie (e.g. `sb-<project>-auth-token` or similar).
3. Run (replace `YOUR_COOKIE_VALUE`):
   ```bash
   # List
   curl -s -H "Cookie: sb-xxx-auth-token=YOUR_COOKIE_VALUE" http://localhost:3000/api/subscriptions

   # Subscribe
   curl -s -X POST -H "Content-Type: application/json" -H "Cookie: sb-xxx-auth-token=YOUR_COOKIE_VALUE" \
     -d '{"firm_id":"fundingpips"}' http://localhost:3000/api/subscriptions

   # Unfollow
   curl -s -X DELETE -H "Cookie: sb-xxx-auth-token=YOUR_COOKIE_VALUE" \
     http://localhost:3000/api/subscriptions/fundingpips
   ```

### Quick checklist

| Check | How |
|-------|-----|
| GET when logged in | 200, `subscriptions` array |
| GET when not logged in | 401 |
| POST valid firm | 200, `subscription` + firm details |
| POST invalid firm | 404 "Firm not found" |
| POST same firm twice | 200 both times, second has `already_subscribed: true` |
| DELETE existing | 204; then GET no longer shows that firm |
| DELETE when not subscribed | 404 |

---

## Test Cases (manual / curl)

1. **Subscribe when logged in → success**  
   `POST /api/subscriptions` with `{ "firm_id": "fundingpips" }` and session cookie → 200 and subscription object.

2. **Subscribe when not logged in → 401**  
   `POST /api/subscriptions` without auth → 401 with `{ "error": "Unauthorized" }`.

3. **Subscribe to invalid firm → 404**  
   `POST /api/subscriptions` with `{ "firm_id": "nonexistent" }` → 404 with `{ "error": "Firm not found" }`.

4. **Subscribe twice → return existing**  
   Subscribe to same firm twice → both 200; second response has `already_subscribed: true`.

5. **Unsubscribe → 204**  
   `DELETE /api/subscriptions/fundingpips` with session → 204. Then `GET /api/subscriptions` no longer includes that firm.

6. **List when not logged in → 401**  
   `GET /api/subscriptions` without auth → 401.

7. **Delete non-existent subscription → 404**  
   `DELETE /api/subscriptions/fundingpips` when user has no subscription → 404.

---

## Implementation Notes

- **Next report date:** Computed as next Monday 00:00 UTC (digest send day).
- **Unfollow:** Hard delete from `firm_subscriptions` (no soft delete).
- **Firm validation:** `firm_id` is checked against `firms` table; valid IDs match alpha schema seed (e.g. `fundingpips`, `the5ers`, `fundednext`).

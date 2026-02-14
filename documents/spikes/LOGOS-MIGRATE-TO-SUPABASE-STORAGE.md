# Migrate /public/logos to Supabase Storage

## Recommendation: Use Supabase Storage

**Yes, you can store images in Supabase.** Supabase provides **Storage** (S3-compatible object storage). It fits well because:

- You already use Supabase (auth/DB); one less vendor.
- The `firms` table already has a `logo_url` column — you can store the public URL there.
- Public URLs are CDN-backed and work with Next.js `Image` (add hostname to `remotePatterns`).
- Free tier: 1 GB storage, 2 GB bandwidth/month.

**Alternatives** (if you prefer):

- **Vercel Blob** – trivial if you deploy on Vercel; pay per GB.
- **Cloudinary** – free tier, image transforms (resize, format) built-in.
- **AWS S3 + CloudFront** – max control, more setup.

---

## Current state

- **Files**: `public/logos/firms/` — 8 files (e.g. `fundingpips.webp`, `the5ers.webp`, `fundednext.jpeg`, …).
- **Usage**: App builds paths like `/logos/firms/${firm.id}.webp` and falls back to `.png` / `.jpeg` / `.jpg` on `onError`.
- **API**: `/api/v2/propfirms` returns `logo: firm.logo_url ?? firm.logo ?? null`; when `logo_url` is set in DB, that value is already exposed.

---

## Migration steps

### 1. Create a Supabase Storage bucket

In Supabase Dashboard: **Storage** → **New bucket**.

- Name: e.g. `logos` (or `public-assets`).
- **Public bucket**: yes (so you get public URLs without signed tokens for logos).

### 2. Optional: RLS for the bucket

If the bucket is public and you only store public logos, you can allow public read:

```sql
-- In Supabase SQL Editor (Storage policies)
-- Allow public read for logos bucket
CREATE POLICY "Public read for logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );
```

(Exact policy depends on your Supabase version; use the Dashboard “Policies” tab for the bucket if you prefer.)

### 3. Upload files

**Option A – Dashboard**

- Storage → `logos` → **Upload file**.
- Create a folder `firms/` and upload each file (e.g. `fundingpips.webp`, `the5ers.webp`).

**Option B – Script (Node)**

Use `@supabase/supabase-js` (you already have it). Example:

```js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const logosDir = path.join(process.cwd(), 'public', 'logos', 'firms');
const files = fs.readdirSync(logosDir);

for (const file of files) {
  const filePath = path.join(logosDir, file);
  if (!fs.statSync(filePath).isFile()) continue;
  const buffer = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage
    .from('logos')
    .upload(`firms/${file}`, buffer, { contentType: 'image/*', upsert: true });
  if (error) console.error(file, error);
  else console.log('Uploaded', file);
}
```

Run once (e.g. `node scripts/upload-logos-to-supabase.js`), then you can remove the script or keep it for future uploads.

### 4. Get public URL format

For a **public** bucket, Supabase URLs look like:

```
https://<PROJECT_REF>.supabase.co/storage/v1/object/public/logos/firms/fundingpips.webp
```

So the pattern is:  
`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/firms/${filename}`.

### 5. Populate `firms.logo_url`

Either:

- **Convention**: don’t store in DB; in the app, when `logo_url` is null, build  
  `https://<project>.supabase.co/storage/v1/object/public/logos/firms/${firm.id}.webp`  
  (and keep fallback to .png/.jpeg/.jpg if you want).
- **DB**: run an update so each firm has `logo_url` set to the correct Storage URL (e.g. one URL per firm, pointing to the file you chose for that firm).

Example (SQL) if you store by firm id and prefer one format (e.g. webp):

```sql
UPDATE firms SET logo_url =
  'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/logos/firms/' || id || '.webp'
WHERE id IN ('fundingpips','the5ers','fundednext', ...);
```

(Adjust for firms that use `.png` or `.jpeg` if you keep multiple extensions.)

### 6. Next.js: allow Supabase Storage images

In `next.config.js`, add the Storage host to `images.remotePatterns`:

```js
{
  protocol: "https",
  hostname: "YOUR_PROJECT_REF.supabase.co",
}
```

So the Supabase project hostname is allowed for `next/image`.

### 7. Frontend: prefer API `logo`, fallback to local then Storage

- Where you currently use `/logos/firms/${firm.id}.webp`, use **`firm.logo`** (from the API) when it’s a string.
- If `firm.logo` is null/empty, fallback to the Supabase Storage URL pattern above (or keep `/logos/firms/...` during a transition).
- Optional: keep a single fallback to `/logos/firms/${firm.id}.png` (and .jpeg/.jpg) for legacy until you delete `public/logos`.

Example helper:

```js
function getLogoUrl(firm) {
  if (firm.logo) return firm.logo;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/firms/${firm.id}`
    : `/logos/firms/${firm.id}`;
  return `${base}.webp`;
}
```

Use that in propfirms page, ActiveLinksCard, SubscriptionSettings, dashboard, traders page, etc., and keep your existing `onError` fallback chain (e.g. try .webp → .png → .jpeg → .jpg or initials).

### 8. Delete local logos

After everything works in production with Supabase URLs:

- Remove the files under `public/logos/` (or the whole `public/logos` folder).
- Remove any code that only pointed at `/logos/` and is now dead.
- Optionally remove `next.config.js` entry for `logos-world.net` if it was only for logos.

---

## Checklist

- [ ] Create Supabase Storage bucket `logos` (public).
- [ ] Upload `public/logos/firms/*` to `logos/firms/`.
- [ ] Set `firms.logo_url` in DB (or adopt convention-based URL in app).
- [ ] Add Supabase hostname to `next.config.js` `images.remotePatterns`.
- [ ] Update all UI that shows firm logos to use `firm.logo` first, then Storage/local fallback.
- [ ] Test (propfirms list, detail, dashboard, ActiveLinksCard, subscriptions).
- [ ] Delete `public/logos` (or its contents).

---

## Note on blueguardian

One file is `blueguardian` with no extension. Either upload it as `blueguardian.png` (or whatever format it is) and set `logo_url` for that firm, or add the correct extension in Storage and in DB.

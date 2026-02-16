# Resend Domain Setup - Production Email Delivery

**Current Status:** ⚠️ Using Resend free tier with limitations
**Priority:** P1 (Required for production)

---

## Current Limitations

### Free Tier Restrictions:
1. **Can only send to:** `legogao651@gmail.com` (your verified email)
2. **Cannot send to:** Other email addresses (e.g., `jasonusca@gmail.com`, `cabittiger@gmail.com`)
3. **Rate limit:** 2 requests per second (600ms delay added to code)
4. **From address:** `onboarding@resend.dev` (Resend's test domain)

### Error Messages You Saw:
```
jasonusca@gmail.com: You can only send testing emails to your own email address (legogao651@gmail.com)
legogao651@gmail.com: Too many requests. You can only make 2 requests per second
```

---

## Solution: Verify Your Domain

### Step 1: Purchase/Use a Domain

**Options:**
1. **Use existing domain:** If you have one (e.g., `propproof.com`)
2. **Buy new domain:**
   - Namecheap: ~$10/year
   - Google Domains: ~$12/year
   - Cloudflare: ~$9/year

**Recommended subdomain for emails:** `mail.yourdomain.com`

---

### Step 2: Verify Domain in Resend

1. **Go to Resend Dashboard:**
   - Visit: https://resend.com/domains
   - Login with your account

2. **Add Domain:**
   - Click "Add Domain"
   - Enter your domain: `yourdomain.com` OR `mail.yourdomain.com`
   - Click "Add"

3. **Add DNS Records:**
   Resend will provide 3 DNS records to add to your domain:

   **Example Records:**
   ```
   Type: TXT
   Name: _resend
   Value: resend-verify=abc123xyz...

   Type: MX
   Name: @
   Value: 10 feedback-smtp.us-east-1.amazonses.com

   Type: TXT
   Name: @
   Value: "v=spf1 include:amazonses.com ~all"
   ```

4. **Add to Your DNS Provider:**
   - **If Cloudflare:** Go to DNS tab → Add records
   - **If Namecheap:** Go to Advanced DNS → Add records
   - **If Google Domains:** Go to DNS → Custom records → Add

5. **Wait for Verification:**
   - DNS propagation: 5-60 minutes
   - Resend will auto-verify when DNS records are live
   - Check status in Resend dashboard

---

### Step 3: Update Environment Variables

Once domain is verified:

**Vercel Environment Variables:**
```bash
# Add this new variable:
DIGEST_FROM_EMAIL="PropProof Weekly <digest@yourdomain.com>"

# OR use your mail subdomain:
DIGEST_FROM_EMAIL="PropProof Weekly <digest@mail.yourdomain.com>"
```

**Where to set:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DIGEST_FROM_EMAIL` variable
3. Value: `PropProof Weekly <digest@yourdomain.com>`
4. Environment: Production, Preview, Development
5. Save
6. Redeploy app (or it auto-deploys)

---

### Step 4: Test Email Delivery

After domain verified and env var set:

```bash
# Run email send workflow
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.vercel.app/api/cron/send-weekly-reports
```

**Expected result:**
```json
{
  "sent": 3,
  "failed": 0,
  "skipped": 0,
  "errors": [],
  "weekStart": "2026-02-16",
  "weekEnd": "2026-02-22"
}
```

**All 3 users should receive emails now** (not just legogao651@gmail.com)

---

## Code Already Updated

### ✅ Rate Limiting Added
**File:** [app/api/cron/send-weekly-reports/route.js](../../app/api/cron/send-weekly-reports/route.js)

**Line 127-128:** Added 600ms delay between emails
```javascript
const RATE_LIMIT_DELAY_MS = 600;
// ...
await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
```

**Why 600ms?**
- Resend limit: 2 requests/second = 500ms between requests
- Added 100ms buffer for safety
- 600ms = ~1.67 requests/second (safely under 2)

### ✅ From Address Configuration
**File:** [lib/email/send-digest.ts](../../lib/email/send-digest.ts)

**Line 52-53:** Already supports custom from address
```javascript
const DEFAULT_FROM = "PropProof <onboarding@resend.dev>";
const from = (process.env.DIGEST_FROM_EMAIL || DEFAULT_FROM).trim();
```

**When `DIGEST_FROM_EMAIL` is set → uses your domain**
**When not set → uses Resend test domain (current)**

---

## Temporary Workaround (Testing Only)

If you want to test emails NOW before domain setup:

### Option 1: Remove Test Users
```sql
-- Delete test users (keep only legogao651)
DELETE FROM user_subscriptions
WHERE email IN ('jasonusca@gmail.com', 'cabittiger@gmail.com');
```

Now only legogao651@gmail.com will receive emails (no errors).

### Option 2: Update Test User Emails
```sql
-- Change test users to use legogao651 email
UPDATE profiles
SET email = 'legogao651@gmail.com'
WHERE email IN ('jasonusca@gmail.com', 'cabittiger@gmail.com');

-- Sync to subscriptions
UPDATE user_subscriptions
SET email = 'legogao651@gmail.com'
WHERE email IN ('jasonusca@gmail.com', 'cabittiger@gmail.com');
```

Now all users use legogao651@gmail.com → Only 1 email sent, no errors.

---

## Domain Verification Checklist

- [ ] Purchase or identify domain to use
- [ ] Add domain in Resend dashboard (resend.com/domains)
- [ ] Copy DNS records provided by Resend
- [ ] Add DNS records to domain provider
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Verify domain shows "Verified" in Resend dashboard
- [ ] Add `DIGEST_FROM_EMAIL` to Vercel environment variables
- [ ] Redeploy app (or wait for auto-deploy)
- [ ] Test email delivery to all 3 users
- [ ] Confirm all emails received

---

## Resend Pricing (For Reference)

**Free Tier:**
- 3,000 emails/month
- 100 emails/day
- 2 requests/second
- ⚠️ Can only send to YOUR email

**Pro Plan ($20/month):**
- 50,000 emails/month
- 2,000 emails/day
- 10 requests/second
- ✅ Send to ANY email (after domain verified)

**For your use case:**
- 3 users × 1 email/week = 12 emails/month
- Even scaling to 100 users = 400 emails/month
- **Free tier is enough** (just need domain verification)

---

## Expected Timeline

1. **Domain purchase:** 5 minutes
2. **Resend setup:** 10 minutes
3. **DNS records:** 5 minutes to add
4. **DNS propagation:** 5-60 minutes (usually ~15 min)
5. **Verify & test:** 5 minutes

**Total:** ~30-60 minutes to go live

---

## Support

If you need help:
- **Resend Docs:** https://resend.com/docs
- **Resend Support:** support@resend.com
- **DNS Setup Help:** Varies by provider (Cloudflare has best docs)

---

## Next Steps

**Immediate (Required for Production):**
1. ✅ Deploy rate limiting fix (already done in code)
2. ⚠️ Verify domain in Resend
3. ⚠️ Add `DIGEST_FROM_EMAIL` env var
4. ⚠️ Test with all 3 users

**Optional (For Testing Now):**
- Remove 2 test users to only send to legogao651@gmail.com
- OR wait for domain setup

**Recommendation:** Set up domain now (~30 min) rather than workarounds.

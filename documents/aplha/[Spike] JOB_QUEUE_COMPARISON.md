# Job Queue Alternatives Comparison (5-min Cron Jobs)

Comparison of job queue services for running tasks every 5 minutes as an alternative to GitHub Actions.

---

## 📊 Your Requirements

- **Frequency:** Every 5 minutes
- **Daily runs:** 288 runs/day (24 hours × 12 runs/hour)
- **Monthly runs:** ~8,640 runs/month (288 × 30 days)
- **Current solution:** GitHub Actions (free, runs every 30 min)

---

## 🔍 Service Comparison

### 1. **Inngest** ⭐ RECOMMENDED

#### Pricing
| Tier | Price | Free Executions | Events/Day | Notes |
|------|-------|----------------|------------|-------|
| **Free** | $0 | 50,000/month | 1-5M free | Generous free tier |
| **Pro** | $20/month | Higher limits | Higher | Volume discounts |

#### For Your Use Case (8,640 runs/month)
- ✅ **FREE** - Well within 50,000 execution limit
- ✅ Can run every 5 minutes forever at no cost
- ✅ 17% of free tier usage

#### Features
✅ **Pros:**
- Generous free tier (50K executions)
- Event-driven + scheduled jobs (cron)
- Built-in retries and error handling
- Excellent observability (logs, traces)
- Runs anywhere (Vercel, AWS, self-hosted)
- No infrastructure management
- TypeScript/JavaScript SDK
- Self-hosting option available

❌ **Cons:**
- Event payload limit: 256KB on free tier
- Requires code deployment (not standalone)

#### Setup Example
```typescript
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'propfirm-sync' });

export const syncPayouts = inngest.createFunction(
  {
    id: 'sync-payouts',
    name: 'Sync Propfirm Payouts',
    cron: '*/5 * * * *', // Every 5 minutes
  },
  async ({ step }) => {
    await step.run('fetch-from-arbiscan', async () => {
      // Your sync logic here
    });

    await step.run('update-supabase', async () => {
      // Update database
    });
  }
);
```

#### Observability
- ✅ Built-in dashboard with execution history
- ✅ Logs and traces per execution
- ✅ Error tracking and alerting
- ✅ Replay failed jobs

---

### 2. **QStash (Upstash)**

#### Pricing
| Tier | Price | Daily Limit | Notes |
|------|-------|-------------|-------|
| **Free** | $0 | 1,000 messages | ~30K/month |
| **Pay-as-you-go** | $1/100K | Unlimited | No daily limit |

#### For Your Use Case (8,640 runs/month)
- ✅ **FREE** - Within 30K/month limit (288 < 1,000/day)
- ✅ 28.8% of free tier usage

#### Features
✅ **Pros:**
- HTTP-based (no SDK required)
- Built-in retries and dead letter queues
- Scheduled messages with cron
- At-least-once delivery guarantee
- FIFO queuing support
- Webhook-based (stateless)

❌ **Cons:**
- Free tier has daily limit (1K/day)
- Less observability than Inngest
- Requires webhook endpoint
- Must handle idempotency yourself

#### Setup Example
```typescript
// In your API route
import { Client } from '@upstash/qstash';

const client = new Client({ token: process.env.QSTASH_TOKEN });

// Schedule with cron
await client.schedules.create({
  destination: 'https://your-app.com/api/sync-payouts',
  cron: '*/5 * * * *', // Every 5 minutes
});
```

---

### 3. **Trigger.dev**

#### Pricing
| Tier | Price | Free Runs | Concurrency | Log Retention |
|------|-------|-----------|-------------|---------------|
| **Free** | $0 + $5 credit | 10,000/month | 10 concurrent | 1 day |
| **Pro** | $20/month | Higher | 100 concurrent | 30 days |

#### For Your Use Case (8,640 runs/month)
- ✅ **FREE** - Within 10K/month limit
- ✅ 86.4% of free tier usage

#### Features
✅ **Pros:**
- No timeouts (unlike AWS Lambda)
- TypeScript-first with great DX
- Built-in wait/sleep (doesn't consume concurrency)
- Excellent observability
- Open-source (self-hostable)
- 10 concurrent runs on free tier

❌ **Cons:**
- Only 1-day log retention on free tier
- 86% of free tier (close to limit)
- Newer platform (less mature)

#### Setup Example
```typescript
import { task } from '@trigger.dev/sdk/v3';

export const syncPayoutsTask = task({
  id: 'sync-payouts',
  run: async () => {
    // Your sync logic
  },
});

// Schedule with cron
schedules.create({
  task: 'sync-payouts',
  cron: '*/5 * * * *',
});
```

---

### 4. **Vercel Cron Jobs**

#### Pricing
| Tier | Price | Status | Notes |
|------|-------|--------|-------|
| **Hobby** | $0 | Beta (free while in beta) | Will be paid eventually |
| **Pro** | $20/month | Beta | Function execution time applies |

#### For Your Use Case (8,640 runs/month)
- ⚠️ **Currently FREE** (in beta)
- ❌ **Will be PAID** when GA (general availability)
- ⚠️ Counts toward function invocations

#### Features
✅ **Pros:**
- Native Vercel integration
- Simple setup (just add to vercel.json)
- No external service needed

❌ **Cons:**
- **Will be paid feature** (timeline unknown)
- Still in beta (may have issues)
- Counts toward function execution quotas
- Less observability than dedicated services
- No retry logic built-in

#### Setup Example
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sync-payouts",
    "schedule": "*/5 * * * *"
  }]
}
```

---

### 5. **GitHub Actions** (Current Solution)

#### Pricing
| Tier | Price | Minutes/Month | Notes |
|------|-------|--------------|-------|
| **Free** | $0 | 2,000 | Public repos |
| **Pro** | $4/month | 3,000 | Private repos |

#### For Your Use Case (8,640 runs/month)
- ✅ **FREE** (you're already using this)
- ✅ Unlimited cron jobs
- ❌ Limited to 5-minute minimum interval
- ❌ Each run ~30-60 seconds = 4,320-8,640 minutes/month (within 2K limit)

#### Features
✅ **Pros:**
- Already set up
- Free forever for public repos
- Git-based versioning
- Mature platform

❌ **Cons:**
- **Minimum 5-minute interval** (can't go faster)
- Limited observability (basic logs)
- No built-in retries
- Slower to debug
- Must manage secrets in GitHub

---

### 6. **cron-job.org** (Free External)

#### Pricing
| Tier | Price | Jobs | Executions/Day | Notes |
|------|-------|------|---------------|-------|
| **Free** | $0 | Unlimited | Unlimited | Community-supported |

#### For Your Use Case
- ✅ **FREE** forever
- ✅ Unlimited jobs and executions

#### Features
✅ **Pros:**
- Completely free
- Simple webhook-based
- Reliable uptime
- Email notifications on failure

❌ **Cons:**
- **No observability** (just email alerts)
- **No retries** (must implement yourself)
- **No tracing** (hard to debug)
- Must expose webhook endpoint publicly
- Less control over execution

---

## 💰 Cost Comparison for 8,640 Runs/Month

| Service | Monthly Cost | Free Tier Limit | % of Free Tier Used | Status |
|---------|--------------|----------------|-------------------|--------|
| **Inngest** | **$0** | 50,000 | 17% | ✅ Recommended |
| **QStash** | **$0** | ~30,000 | 29% | ✅ Good option |
| **Trigger.dev** | **$0** | 10,000 | 86% | ⚠️ Close to limit |
| **Vercel Cron** | **$0*** | N/A | N/A | ⚠️ Beta, will be paid |
| **GitHub Actions** | **$0** | 2,000 min | ~33% | ✅ Current solution |
| **cron-job.org** | **$0** | Unlimited | N/A | ⚠️ No observability |

**Note:** Vercel Cron Jobs are free in beta but will require a paid plan when GA.

---

## 🎯 Recommendation

### **Option 1: Inngest** ⭐⭐⭐⭐⭐

**Why:**
- ✅ Most generous free tier (50K executions = 5.8x your usage)
- ✅ Best observability (logs, traces, replays)
- ✅ Built-in retries and error handling
- ✅ Modern DX (TypeScript SDK)
- ✅ Self-hostable if needed later
- ✅ Can run every 1 minute if needed (no restrictions)

**When to upgrade:**
- Never (unless you scale to 50K+ runs/month)

---

### **Option 2: QStash** ⭐⭐⭐⭐

**Why:**
- ✅ Free tier sufficient (30K/month = 3.5x your usage)
- ✅ Simple HTTP-based (no SDK)
- ✅ At-least-once delivery
- ✅ $1/100K requests if you exceed (very cheap)

**Cons vs Inngest:**
- Less observability
- Daily limit (not monthly)

---

### **Option 3: Stay with GitHub Actions** ⭐⭐⭐

**Why:**
- ✅ Already set up (no migration)
- ✅ Free forever
- ✅ Works fine for current needs

**When to switch:**
- Need faster than 5-min intervals
- Need better observability/debugging
- Want built-in retries

---

## 📋 Feature Comparison Matrix

| Feature | Inngest | QStash | Trigger.dev | Vercel Cron | GitHub Actions |
|---------|---------|--------|-------------|-------------|----------------|
| **Free Tier** | ✅✅ 50K | ✅ 30K | ✅ 10K | ⚠️ Beta | ✅ 2K min |
| **Observability** | ✅✅ | ⚠️ | ✅✅ | ⚠️ | ⚠️ |
| **Retries** | ✅ Built-in | ✅ Built-in | ✅ Built-in | ❌ | ❌ |
| **Min Interval** | 1 min | 1 min | 1 min | 1 min | 5 min |
| **Webhooks** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Self-hosting** | ✅ | ❌ | ✅ | ❌ | N/A |
| **TypeScript SDK** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Error Tracking** | ✅✅ | ⚠️ | ✅✅ | ⚠️ | ⚠️ |
| **Replay Failed Jobs** | ✅ | ⚠️ | ✅ | ❌ | ❌ |
| **Maturity** | ✅ | ✅ | ⚠️ | ⚠️ | ✅✅ |

---

## 🚀 Migration Effort

### Inngest (Recommended)
**Effort:** Low (2-4 hours)

```typescript
// 1. Install SDK
npm install inngest

// 2. Create function
export const syncJob = inngest.createFunction(
  { id: 'sync', cron: '*/5 * * * *' },
  async ({ step }) => {
    // Move your GitHub Actions script here
  }
);

// 3. Deploy to Vercel
// Add /api/inngest route for webhook
```

### QStash
**Effort:** Very Low (1-2 hours)

```typescript
// 1. Install client
npm install @upstash/qstash

// 2. Create webhook endpoint
// app/api/sync/route.ts (your existing logic)

// 3. Schedule via dashboard or API
await qstash.schedules.create({
  destination: 'https://your-app.com/api/sync',
  cron: '*/5 * * * *'
});
```

---

## 📊 Decision Matrix

| If You Need... | Use This |
|----------------|----------|
| **Best observability** | Inngest or Trigger.dev |
| **Simplest setup** | QStash |
| **No migration** | GitHub Actions (stay) |
| **Guaranteed free forever** | Inngest or cron-job.org |
| **Future scalability** | Inngest |
| **HTTP-only (no SDK)** | QStash |

---

## 🎯 Final Recommendation

**Migrate to Inngest** for these reasons:

1. ✅ **FREE forever** at your scale (17% of free tier)
2. ✅ **Best observability** - See exactly what's happening
3. ✅ **Built-in retries** - Automatic error recovery
4. ✅ **Easy debugging** - Replay failed runs
5. ✅ **Future-proof** - Can scale to 50K runs before paying
6. ✅ **Better than GitHub Actions** for scheduled jobs
7. ✅ **Modern DX** - TypeScript, type-safe

**Migration time:** 2-4 hours (one afternoon)

**Alternative:** If you want **zero dependencies**, stick with **GitHub Actions** - it works fine for your current needs.

---

**Updated:** January 2025

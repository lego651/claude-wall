# Database Migrations

This directory is the **single source** for all SQL migrations. Do not create other migration folders (e.g. `supabase/migrations`, `database/`). Files are prefixed with a number (01_, 02_, …) to indicate run order.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of the migration file
4. Click **Run** to execute

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migration
supabase db push
```

### Option 3: Direct SQL Connection

```bash
# Connect to your Supabase Postgres instance
psql "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres"

# Run migration
\i /path/to/migration-file.sql
```

## Migration Files (run in order 01 → 17)

### Core Schema
- `01_schema.sql` - Original profiles table and auth setup
- `02_create-profile-for-existing-user.sql` - Ensure existing users get profiles
- `03_add-profile-fields.sql` - Additional profile fields
- `04_add-isadmin-field.sql` - Admin user support
- `05_add-public-profile-policy.sql` - Public profile visibility

### Trading Features
- `06_create-trader-records-table.sql` - Trader verification system
- `07_create-pending-wallets-table.sql` - Wallet connection queue
- `08_create-recent-trader-payouts-table.sql` - Recent payout tracking
- `09_create-trader-payout-history-table.sql` - Historical payout data
- `10_add-backfilled-at-column.sql` - Backfill tracking column

### Alpha Intelligence Engine
- `11_alpha-intelligence-schema.sql` - **TICKET-001** - Trustpilot reviews, subscriptions, weekly reports
- `12_add-indexes.sql` - Indexes for API and sync performance
- `13_add-ftmo-topstep.sql` - FTMO/Topstep firm data
- `14_update-classifier-taxonomy.sql` - Classifier taxonomy updates
- `15_fix-existing-users.sql` - Fix existing user data
- `16_verify-alpha-schema.sql` - Alpha schema verification
- `17_verify-policies.sql` - RLS policy verification

## Alpha Intelligence Schema

The alpha intelligence schema adds the following tables:

### 1. `firms`
Reference table for prop firms (migrated from `data/propfirms.json`)

### 2. `trustpilot_reviews`
Stores scraped Trustpilot reviews with AI classification:
- Review data (rating, title, text, date, author)
- AI classification (category, severity, confidence)
- Indexes for fast firm/date queries

### 3. `firm_subscriptions`
Tracks user subscriptions to weekly reports:
- One subscription per user per firm
- Email preferences
- Last sent timestamp

### 4. `weekly_reports`
Cached weekly intelligence reports:
- Stored as JSONB for flexibility
- Email delivery metrics
- Public archive (no auth required)

### 5. `weekly_incidents`
Aggregated incidents from multiple reviews:
- AI-generated summaries
- Severity levels
- Source review references

## Verification

After running the alpha intelligence migration, verify with:

```sql
-- Check firms loaded
SELECT id, name FROM firms;

-- Verify table creation
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents');

-- Check RLS policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents');
```

## Rollback

To rollback the alpha intelligence schema:

```sql
DROP TABLE IF EXISTS weekly_incidents CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;
DROP TABLE IF EXISTS firm_subscriptions CASCADE;
DROP TABLE IF EXISTS trustpilot_reviews CASCADE;
DROP TABLE IF EXISTS firms CASCADE;
DROP FUNCTION IF EXISTS get_week_number(DATE);
DROP FUNCTION IF EXISTS get_year(DATE);
```

## Original Schema (Profiles)

The `profiles` table extends Supabase's built-in `auth.users` table with additional fields:

- `id` - UUID (references `auth.users.id`)
- `email` - User's email address
- `twitter` - Twitter/X username
- `instagram` - Instagram profile URL
- `youtube` - YouTube channel URL
- `wallet_address` - Ethereum/Arbitrum/Polygon wallet address (0x... format)
- `customer_id` - Stripe customer ID (optional)
- `price_id` - Stripe price ID (optional)
- `has_access` - Boolean flag for subscription access
- `created_at` - Timestamp
- `updated_at` - Auto-updated timestamp

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile
- Public data (firms, reviews, reports) is readable by anyone

### Indexes

- Index on `wallet_address` for faster lookups
- Index on `email` for faster lookups
- Indexes on firm_id and dates for intelligence queries

### Triggers

- Automatic `updated_at` timestamp update on row changes

## Next Steps

After running `11_alpha-intelligence-schema.sql`:

1. ✅ Verify all tables created
2. ✅ Verify RLS policies applied
3. ✅ Verify 8 firms seeded
4. 🔄 Proceed to **TICKET-002** (Trustpilot Scraper)

## Environment Variables

Ensure the following are set for the application:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (for AI classification)
OPENAI_API_KEY=your_openai_key

# Resend (for email delivery)
RESEND_API_KEY=your_resend_key
```

## Support

For issues or questions:
- Check Supabase logs in Dashboard > Database > Logs
- Review RLS policies if getting permission errors
- Ensure service role key is set for cron jobs

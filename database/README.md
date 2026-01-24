# Database Setup

This directory contains the SQL schema for setting up the user profiles table in Supabase.

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `schema.sql`

Alternatively, you can run it via the Supabase CLI:

```bash
supabase db reset
# or
psql -h your-db-host -U postgres -d postgres -f schema.sql
```

## Schema Overview

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

## Row Level Security (RLS)

The table has RLS enabled with the following policies:

- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile

## Indexes

- Index on `wallet_address` for faster lookups
- Index on `email` for faster lookups

## Triggers

- Automatic `updated_at` timestamp update on row changes

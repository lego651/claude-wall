/**
 * Supabase Service Role Client
 *
 * Used for server-side operations that don't have a request context:
 * - Cron jobs
 * - Background tasks
 * - Scripts (like our scraper)
 *
 * This bypasses RLS and should only be used in trusted server contexts.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let serviceClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createServiceClient() {
  // Return existing client if already created (singleton pattern)
  if (serviceClient) {
    return serviceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  // Create client with service role key (bypasses RLS)
  serviceClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceClient;
}

// Export default for convenience
export default createServiceClient;

#!/usr/bin/env node

/**
 * Sync Traders to Supabase
 * 
 * Script to sync trader transaction data from Arbiscan to Supabase.
 * This script is run via GitHub Actions every 30 minutes.
 * 
 * Usage: node scripts/sync-traders-to-supabase.js
 * 
 * Required environment variables:
 *   - ARBISCAN_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

// Use dynamic import for ES modules
// Note: The service uses @/ aliases which work in Next.js context
// For Node.js scripts, we need to use a module loader or configure path resolution
async function main() {
  // Try to import with Next.js path resolution
  // If this fails, you may need to set up path aliases in Node.js or use a different approach
  let traderSyncService;
  try {
    // Try relative path first (for Node.js scripts)
    traderSyncService = await import('../lib/services/traderSyncService.js');
  } catch (e) {
    console.error('Failed to import traderSyncService:', e);
    console.error('Note: The service uses @/ path aliases. You may need to configure path resolution.');
    process.exit(1);
  }
  
  const { syncAllTraders, cleanupOrphanedRecords } = traderSyncService;
  const startTime = Date.now();
  
  console.log('🚀 Trader Sync Script (Supabase)');
  console.log('================================\n');

  try {
    // Sync all traders
    const summary = await syncAllTraders();

    // Cleanup orphaned records (wallets without profiles, older than 90 days)
    await cleanupOrphanedRecords(90);

    // Summary
    console.log('\n================================');
    console.log('📋 Summary\n');
    console.log(`  Wallets synced: ${summary.wallets}`);
    console.log(`  Successful: ${summary.successful}`);
    console.log(`  Errors: ${summary.errors.length}`);
    console.log(`  Duration: ${summary.duration}ms`);
    
    if (summary.errors.length > 0) {
      console.log(`  Error details:`, summary.errors);
      process.exit(1);
    }

    console.log('\n✅ Sync complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

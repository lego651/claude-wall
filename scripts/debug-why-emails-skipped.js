/**
 * Debug script: Why are 2 users skipped when sending weekly emails?
 * Run: node scripts/debug-why-emails-skipped.js
 *
 * This script replicates the exact logic from send-weekly-reports route
 * to show you WHY users are being skipped.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Same logic as send-weekly-reports route
function getCurrentWeekUtcIso() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    weekStartIso: monday.toISOString().slice(0, 10),
    weekEndIso: sunday.toISOString().slice(0, 10),
  };
}

async function main() {
  console.log('\n🔍 DEBUGGING EMAIL SKIPPED ISSUE\n');
  console.log('='.repeat(60));

  const { weekStartIso, weekEndIso } = getCurrentWeekUtcIso();
  console.log(`\n📅 Current week (UTC): ${weekStartIso} to ${weekEndIso}\n`);

  // Step 1: Get active subscriptions
  console.log('Step 1: Fetching active subscriptions...');
  const { data: rows, error: subsError } = await supabase
    .from('user_subscriptions')
    .select('user_id, firm_id')
    .eq('email_enabled', true);

  if (subsError) {
    console.error('❌ Error fetching subscriptions:', subsError);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('⚠️  NO ACTIVE SUBSCRIPTIONS FOUND');
    console.log('   → Users need to subscribe to firms via /user/settings');
    process.exit(0);
  }

  console.log(`✅ Found ${rows.length} active subscription(s)`);

  // Group by user
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r.firm_id);
  }
  console.log(`   → ${byUser.size} unique user(s) with subscriptions\n`);

  // Step 2: Get emails
  console.log('Step 2: Fetching user emails...');
  const userIds = [...byUser.keys()];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    process.exit(1);
  }

  const emailByUser = new Map(
    (profiles || [])
      .map((p) => [p.id, p.email?.trim()])
      .filter(([, e]) => e)
  );
  console.log(`✅ Found emails for ${emailByUser.size} user(s)\n`);

  // Step 3: Get reports for current week
  console.log('Step 3: Fetching weekly reports...');
  const firmIds = [...new Set(rows.map((r) => r.firm_id))];
  console.log(`   → Looking for reports for ${firmIds.length} firm(s): ${firmIds.join(', ')}`);
  console.log(`   → Filtering by week_from_date = '${weekStartIso}'`);
  console.log(`   → Filtering by week_to_date = '${weekEndIso}'`);

  const { data: reportsRows, error: reportsError } = await supabase
    .from('firm_weekly_reports')
    .select('firm_id, week_from_date, week_to_date, generated_at')
    .in('firm_id', firmIds)
    .eq('week_from_date', weekStartIso)
    .eq('week_to_date', weekEndIso);

  if (reportsError) {
    console.error('❌ Error fetching reports:', reportsError);
    process.exit(1);
  }

  console.log(`✅ Found ${reportsRows?.length || 0} report(s) for current week\n`);

  if (reportsRows?.length) {
    console.log('   Reports found:');
    reportsRows.forEach((r) => {
      console.log(`   - ${r.firm_id}: ${r.week_from_date} to ${r.week_to_date} (generated ${r.generated_at})`);
    });
    console.log('');
  } else {
    console.log('⚠️  NO REPORTS FOUND for current week!');
    console.log('   This is likely why users are being skipped.\n');

    // Check if reports exist for OTHER weeks
    console.log('   Checking if reports exist for other weeks...');
    const { data: allReports } = await supabase
      .from('firm_weekly_reports')
      .select('firm_id, week_from_date, week_to_date, generated_at')
      .order('generated_at', { ascending: false })
      .limit(10);

    if (allReports?.length) {
      console.log(`   Found ${allReports.length} report(s) for OTHER weeks:`);
      allReports.forEach((r) => {
        console.log(`   - ${r.firm_id}: ${r.week_from_date} to ${r.week_to_date} (generated ${r.generated_at})`);
      });
      console.log('\n   ❌ PROBLEM: Reports exist but dates don\'t match current week!');
      console.log('   → Solution: Run weekly-step1 workflow to generate reports for current week\n');
    } else {
      console.log('   ❌ NO REPORTS FOUND AT ALL in firm_weekly_reports table');
      console.log('   → Solution: Run weekly-step1 workflow to generate reports\n');
    }
  }

  const reportsByFirm = new Map((reportsRows || []).map((r) => [r.firm_id, r]));

  // Step 4: Simulate email sending logic
  console.log('='.repeat(60));
  console.log('\n📧 SIMULATING EMAIL SEND LOGIC\n');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [userId, firmIdsForUser] of byUser) {
    const email = emailByUser.get(userId);
    const userIdShort = userId.slice(0, 8) + '...';

    if (!email) {
      console.log(`❌ User ${userIdShort}: NO EMAIL in profiles → FAILED`);
      failed += 1;
      continue;
    }

    const reports = firmIdsForUser
      .map((fid) => reportsByFirm.get(fid))
      .filter(Boolean);

    console.log(`\n👤 User: ${email} (${userIdShort})`);
    console.log(`   Subscribed to: ${firmIdsForUser.join(', ')}`);
    console.log(`   Reports available: ${reports.length}/${firmIdsForUser.length}`);

    if (reports.length === 0) {
      console.log(`   ⏭️  SKIPPED (no reports for subscribed firms)`);
      skipped += 1;
      continue;
    }

    console.log(`   ✅ WOULD SEND EMAIL with ${reports.length} firm report(s)`);
    reports.forEach((r) => {
      console.log(`      - ${r.firm_id}`);
    });
    sent += 1;
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`   Sent: ${sent}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log('');

  if (skipped > 0 && reportsByFirm.size === 0) {
    console.log('🔧 SOLUTION:\n');
    console.log('   1. Run weekly-step1 workflow in GitHub Actions');
    console.log('      OR run locally: npx tsx scripts/generate-firm-weekly-reports.ts');
    console.log('');
    console.log('   2. After reports are generated, run weekly-step2 to send emails');
    console.log('      OR call: curl -H "Authorization: Bearer $CRON_SECRET" $SITE_URL/api/cron/send-weekly-reports');
    console.log('');
  }

  if (skipped > 0 && reportsByFirm.size > 0) {
    console.log('🔧 SOLUTION:\n');
    console.log('   Users are subscribed to firms that have no reports this week.');
    console.log('   Check which firms have reports vs which users are subscribed to.');
    console.log('');
  }

  if (sent === 0 && failed === 0 && skipped === 0) {
    console.log('🔧 SOLUTION:\n');
    console.log('   No active subscriptions found.');
    console.log('   Users need to subscribe to firms via /user/settings');
    console.log('');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

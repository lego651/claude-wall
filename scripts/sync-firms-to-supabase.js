#!/usr/bin/env node

/**
 * Sync Firms to Supabase
 *
 * Upserts firms from `data/propfirms.json` into the Supabase `firms` table.
 * This is needed because the public `/api/v2/propfirms` endpoint reads from
 * Supabase `firms`, not from the JSON file.
 *
 * Usage:
 *   node scripts/sync-firms-to-supabase.js
 *   node scripts/sync-firms-to-supabase.js --firm blueguardian
 *
 * Required environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require("fs");
const path = require("path");

// Load environment variables from .env file manually (for local runs)
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

// Parse args
const args = process.argv.slice(2);
const firmFilter = args.includes("--firm")
  ? args[args.indexOf("--firm") + 1]
  : null;

async function createSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

function loadFirmsFromJson() {
  const firmsPath = path.join(process.cwd(), "data", "propfirms.json");
  const firmsData = JSON.parse(fs.readFileSync(firmsPath, "utf8"));
  let firms = firmsData.firms || [];

  if (firmFilter) {
    firms = firms.filter((f) => f.id === firmFilter);
    if (firms.length === 0) {
      throw new Error(`Firm "${firmFilter}" not found in data/propfirms.json`);
    }
  }

  return firms;
}

async function main() {
  console.log("🚀 Sync Firms to Supabase");
  console.log("========================\n");

  const firms = loadFirmsFromJson();
  console.log(`Found ${firms.length} firm(s) to upsert`);

  const supabase = await createSupabaseClient();

  // Keep the payload minimal to avoid schema mismatches.
  // Assumes `firms` table has at least: id (pk), name, addresses (json/text[]).
  const payload = firms.map((f) => ({
    id: f.id,
    name: f.name,
    addresses: f.addresses,
  }));

  const { error } = await supabase.from("firms").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }

  console.log("✅ Upsert complete!");
  console.log("Tip: refresh `/propfirms` and Blue Guardian should appear.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});


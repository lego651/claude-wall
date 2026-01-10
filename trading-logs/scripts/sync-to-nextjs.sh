#!/bin/bash

# Sync Trading Logs Data to Next.js App
# This script copies aggregated trading data to the Next.js public directory
# so it's automatically available for the frontend to fetch

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRADING_LOGS_DIR="$(dirname "$SCRIPT_DIR")"
NEXTJS_PUBLIC_DIR="$(dirname "$TRADING_LOGS_DIR")/public/data/trading"

echo "🔄 Syncing trading logs data to Next.js..."
echo ""
echo "Source: $TRADING_LOGS_DIR/data"
echo "Target: $NEXTJS_PUBLIC_DIR"
echo ""

# Find all year directories
YEARS=$(find "$TRADING_LOGS_DIR/data" -maxdepth 1 -type d -name "20*" | xargs -n 1 basename)

if [ -z "$YEARS" ]; then
  echo "❌ No year directories found in $TRADING_LOGS_DIR/data"
  exit 1
fi

# Create target directory
mkdir -p "$NEXTJS_PUBLIC_DIR"

# Sync each year's aggregated data
for YEAR in $YEARS; do
  AGGREGATED_DIR="$TRADING_LOGS_DIR/data/$YEAR/aggregated"

  if [ -d "$AGGREGATED_DIR" ]; then
    echo "📊 Syncing year $YEAR..."

    # Copy all aggregated JSON files
    cp -v "$AGGREGATED_DIR"/*.json "$NEXTJS_PUBLIC_DIR/"

    echo "✅ Year $YEAR synced"
  else
    echo "⚠️  No aggregated data found for year $YEAR (run aggregate-data.js first)"
  fi
done

echo ""
echo "✨ Sync complete!"
echo ""
echo "📁 Files in $NEXTJS_PUBLIC_DIR:"
ls -lh "$NEXTJS_PUBLIC_DIR"
echo ""
echo "💡 Next steps:"
echo "   1. npm run build   # Build Next.js app"
echo "   2. npm run dev     # Test locally"
echo "   3. git commit & push to deploy"

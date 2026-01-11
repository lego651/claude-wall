import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * API Route to serve trading data files
 * Reads directly from trading-logs directory - no data duplication
 *
 * Usage: /api/trading-data/2026/aggregated/yearly-summary.json
 */
export async function GET(request, { params }) {
  try {
    const { path } = await params;
    const filePath = join(process.cwd(), 'trading-logs', 'data', ...path);

    // Security: Ensure the path is within trading-logs/data
    if (!filePath.startsWith(join(process.cwd(), 'trading-logs', 'data'))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read and return the file
    const fileContent = readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error('Error reading trading data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

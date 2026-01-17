import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'propfirms.json');

// Helper to read firms from JSON file
function readFirms() {
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    return { firms: [] };
  }
}

// Helper to write firms to JSON file
function writeFirms(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/propfirms - List all firms
export async function GET() {
  const data = readFirms();
  return NextResponse.json(data);
}

// POST /api/propfirms - Create new firm
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, addresses = [] } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const data = readFirms();

    // Generate simple ID from name
    const id = name.toLowerCase().replace(/\s+/g, '-');

    // Check if firm already exists
    const exists = data.firms.find(f => f.id === id);
    if (exists) {
      return NextResponse.json({ error: 'Firm with this name already exists' }, { status: 400 });
    }

    const newFirm = {
      id,
      name,
      addresses: addresses.filter(a => a && a.trim()),
      createdAt: new Date().toISOString()
    };

    data.firms.push(newFirm);
    writeFirms(data);

    return NextResponse.json({ firm: newFirm }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/propfirms - Delete a firm
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const data = readFirms();
    const initialLength = data.firms.length;
    data.firms = data.firms.filter(f => f.id !== id);

    if (data.firms.length === initialLength) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    writeFirms(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/propfirms - Update a firm
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, name, addresses } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const data = readFirms();
    const firmIndex = data.firms.findIndex(f => f.id === id);

    if (firmIndex === -1) {
      return NextResponse.json({ error: 'Firm not found' }, { status: 404 });
    }

    // Update fields
    if (name) data.firms[firmIndex].name = name;
    if (addresses !== undefined) {
      data.firms[firmIndex].addresses = addresses.filter(a => a && a.trim());
    }

    writeFirms(data);
    return NextResponse.json({ firm: data.firms[firmIndex] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

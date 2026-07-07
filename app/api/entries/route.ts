import { NextRequest, NextResponse } from 'next/server';
import { getEntries, upsertEntry } from '@/lib/db';

export async function GET() {
  try {
    const entries = await getEntries();
    return NextResponse.json({ entries });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const entry = await req.json();
    if (!entry.id) entry.id = crypto.randomUUID();
    await upsertEntry(entry);
    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

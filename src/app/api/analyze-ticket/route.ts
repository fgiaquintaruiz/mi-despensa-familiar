import { NextResponse } from 'next/server';
import { findParser } from '@/lib/parsers';

export const POST = async (req: Request) => {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = findParser({ filename: file.name });
  if (!parser) {
    return NextResponse.json({ error: 'no parser matched', items: [] }, { status: 422 });
  }
  const items = await parser.parse({ buffer });
  return NextResponse.json({ store: parser.store, items });
};

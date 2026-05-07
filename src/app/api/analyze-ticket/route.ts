import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
import { findParser } from '@/lib/parsers';

const isPdf = (filename: string) => filename.toLowerCase().endsWith('.pdf');

export const POST = async (req: Request) => {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string | undefined;
  if (isPdf(file.name)) {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  }

  const parser = findParser({ filename: file.name, text });
  if (!parser) {
    return NextResponse.json({ error: 'no parser matched', items: [] }, { status: 422 });
  }
  const items = await parser.parse({ buffer, text });
  return NextResponse.json({ store: parser.store, items });
};

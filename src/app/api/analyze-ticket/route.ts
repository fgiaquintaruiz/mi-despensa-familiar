import { NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
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
    try {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } catch (e) {
      return NextResponse.json(
        { error: 'PDF parsing failed', detail: e instanceof Error ? e.message : 'Unknown error' },
        { status: 500 },
      );
    }
  }

  const parser = findParser({ filename: file.name, text });
  if (!parser) {
    return NextResponse.json({ error: 'no parser matched', items: [] }, { status: 422 });
  }
  const items = await parser.parse({ buffer, text });
  return NextResponse.json({ store: parser.store, items });
};

import { NextResponse } from 'next/server';
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
      // Lazy dynamic import: avoids top-level module initialisation crash in
      // Vercel serverless runtimes where pdf-parse CJS/native binding resolution
      // can fail at cold-start. Any load error is caught here, returned as JSON.
      //
      // pdf-parse v1.1.1 exports a default function: pdfParse(buffer) => Promise<{ text, numpages, ... }>
      // v2.x was avoided because it depends on pdfjs-dist which requires DOMMatrix (browser API),
      // unavailable in Vercel serverless Node.js runtime.
      const { default: pdfParse } = await import('pdf-parse');
      const result = await pdfParse(buffer);
      text = result.text;
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

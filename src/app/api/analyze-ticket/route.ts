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
      // pdf-parse v2 exports a class-based API — no default function export.
      // Constructor takes LoadParameters with a `data` field; getText() returns
      // { text: string, pages: [...], total: {...} }.
      const { PDFParse } = await import('pdf-parse') as unknown as { PDFParse: new (opts: { data: Buffer; verbosity: number }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } };
      const parser = new PDFParse({ data: buffer, verbosity: 0 });
      const result = await parser.getText();
      await parser.destroy();
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

import { NextResponse } from 'next/server';
import { findParser, getParserByName } from '@/lib/parsers';
import type { ParsedTicketItem } from '@/lib/parsers/types';

export const runtime = 'nodejs';

export const POST = async (req: Request): Promise<NextResponse> => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).text !== 'string' ||
    !(body as Record<string, unknown>).text
  ) {
    return NextResponse.json({ error: 'text is required and must be a non-empty string' }, { status: 400 });
  }

  const { text, hint } = body as { text: string; hint?: unknown };

  console.log('[parse-ticket-text]', text.substring(0, 200), hint ? `hint=${hint}` : '');

  // Validate hint: must be a non-empty string and match a known parser
  let parser = findParser({ text });

  if (typeof hint === 'string' && hint.trim() !== '') {
    const hintedParser = getParserByName(hint.trim());
    if (!hintedParser) {
      return NextResponse.json({ error: `Unknown hint: "${hint}"` }, { status: 400 });
    }
    parser = hintedParser;
  }

  if (!parser) {
    return NextResponse.json(
      { items: [] as ParsedTicketItem[], parser: null, message: 'No se reconoció el supermercado' },
      { status: 200 },
    );
  }

  try {
    const items = await parser.parse({ buffer: Buffer.from(text), text });
    return NextResponse.json({ items, parser: parser.store });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al parsear el ticket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

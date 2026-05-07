import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Mock pdf-parse BEFORE any import resolves it.
// pdf-parse v1.1.1 exports a default function: pdfParse(buffer) => Promise<{ text, numpages, ... }>
vi.mock('pdf-parse', () => {
  const mockFn = vi.fn();
  return { default: mockFn };
});

// Mock findParser to isolate the route from real parsers
vi.mock('@/lib/parsers', () => ({
  findParser: vi.fn(),
}));

import pdfParseMock from 'pdf-parse';
import { findParser } from '@/lib/parsers';
const mockPdfParse = vi.mocked(pdfParseMock);
const mockFindParser = vi.mocked(findParser);

function makePdfFormData(filename = 'mercadona.pdf'): FormData {
  const blob = new Blob(['%PDF-1.4 fake pdf content'], { type: 'application/pdf' });
  const file = new File([blob], filename, { type: 'application/pdf' });
  const fd = new FormData();
  fd.append('file', file);
  return fd;
}

function makeRequest(formData: FormData): Request {
  return new Request('http://localhost/api/analyze-ticket', {
    method: 'POST',
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/analyze-ticket — PDF path', () => {
  it('calls pdfParse with the file buffer', async () => {
    mockPdfParse.mockResolvedValue({ text: 'LECHE ENTERA 1,25\n', numpages: 1, info: {}, metadata: {}, version: '1.1.1' });
    mockFindParser.mockReturnValue({
      store: 'mercadona',
      canParse: () => true,
      parse: async () => [],
    });

    const req = makeRequest(makePdfFormData('mercadona.pdf'));
    await POST(req);

    expect(mockPdfParse).toHaveBeenCalledOnce();
    const callArg = mockPdfParse.mock.calls[0][0];
    expect(Buffer.isBuffer(callArg)).toBe(true);
  });

  it('passes extracted text to the parser', async () => {
    const extractedText = 'LECHE ENTERA 1,25\nPAN BIMBO 2,10\n';
    mockPdfParse.mockResolvedValue({ text: extractedText, numpages: 1, info: {}, metadata: {}, version: '1.1.1' });

    const mockParse = vi.fn().mockResolvedValue([
      { name: 'LECHE ENTERA', qty: 1, unit: 'ud', price: 1.25, category: 'frescos' },
    ]);
    mockFindParser.mockReturnValue({
      store: 'mercadona',
      canParse: () => true,
      parse: mockParse,
    });

    const req = makeRequest(makePdfFormData('mercadona.pdf'));
    await POST(req);

    expect(mockParse).toHaveBeenCalledOnce();
    const parseInput = mockParse.mock.calls[0][0];
    expect(parseInput.text).toBe(extractedText);
  });

  it('returns non-empty items when parser finds products', async () => {
    mockPdfParse.mockResolvedValue({ text: 'LECHE ENTERA 1,25\n', numpages: 1, info: {}, metadata: {}, version: '1.1.1' });
    mockFindParser.mockReturnValue({
      store: 'mercadona',
      canParse: () => true,
      parse: async () => [
        { name: 'LECHE ENTERA', qty: 1, unit: 'ud', price: 1.25, category: 'frescos' },
      ],
    });

    const req = makeRequest(makePdfFormData('mercadona.pdf'));
    const res = await POST(req);
    const body = await res.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('LECHE ENTERA');
    expect(body.store).toBe('mercadona');
  });

  it('returns 400 when no file is sent', async () => {
    const fd = new FormData();
    const req = makeRequest(fd);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 when no parser matches', async () => {
    mockPdfParse.mockResolvedValue({ text: 'unknown store', numpages: 1, info: {}, metadata: {}, version: '1.1.1' });
    mockFindParser.mockReturnValue(undefined);

    const req = makeRequest(makePdfFormData('unknown.pdf'));
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns JSON 500 with error body when pdf-parse throws', async () => {
    mockPdfParse.mockRejectedValue(new Error('PDF corrupted'));

    const req = makeRequest(makePdfFormData('corrupt.pdf'));
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Use vi.hoisted so these refs are available inside vi.mock() factory closures.
// Without hoisting, the top-level const declarations are TDZ when the mock factory runs.
const { mockGetText, mockDestroy } = vi.hoisted(() => ({
  mockGetText: vi.fn(),
  mockDestroy: vi.fn(),
}));

// Mock pdf-parse BEFORE any import resolves it.
// pdf-parse v2 exports a class `PDFParse` (no default function).
// We must use a `function` declaration (not arrow fn) so Vitest treats it as a constructor.
vi.mock('pdf-parse', () => {
  return {
    // eslint-disable-next-line prefer-arrow-callback
    PDFParse: vi.fn(function PDFParseConstructor() {
      return {
        getText: mockGetText,
        destroy: mockDestroy,
      };
    }),
  };
});

// Mock findParser to isolate the route from real parsers
vi.mock('@/lib/parsers', () => ({
  findParser: vi.fn(),
}));

import { PDFParse as MockPDFParse } from 'pdf-parse';
import { findParser } from '@/lib/parsers';
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
  // Re-apply implementations after clearAllMocks resets them.
  // clearAllMocks() wipes mockImplementation on MockPDFParse too.
  // Must use a `function` expression (not arrow fn) for Vitest's `new` support.
  // eslint-disable-next-line prefer-arrow-callback
  vi.mocked(MockPDFParse).mockImplementation(function () {
    return {
      getText: mockGetText,
      destroy: mockDestroy,
    };
  });
  mockDestroy.mockResolvedValue(undefined);
});

describe('POST /api/analyze-ticket — PDF path', () => {
  it('constructs PDFParse with the file buffer and calls getText()', async () => {
    mockGetText.mockResolvedValue({ text: 'LECHE ENTERA 1,25\n', pages: [], total: {} });
    mockFindParser.mockReturnValue({
      store: 'mercadona',
      canParse: () => true,
      parse: async () => [],
    });

    const req = makeRequest(makePdfFormData('mercadona.pdf'));
    await POST(req);

    expect(MockPDFParse).toHaveBeenCalledOnce();
    const constructorArg = MockPDFParse.mock.calls[0][0];
    expect(Buffer.isBuffer(constructorArg.data)).toBe(true);
    expect(mockGetText).toHaveBeenCalledOnce();
  });

  it('passes extracted text to the parser', async () => {
    const extractedText = 'LECHE ENTERA 1,25\nPAN BIMBO 2,10\n';
    mockGetText.mockResolvedValue({ text: extractedText, pages: [], total: {} });

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
    mockGetText.mockResolvedValue({ text: 'LECHE ENTERA 1,25\n', pages: [], total: {} });
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
    mockGetText.mockResolvedValue({ text: 'unknown store', pages: [], total: {} });
    mockFindParser.mockReturnValue(undefined);

    const req = makeRequest(makePdfFormData('unknown.pdf'));
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns JSON 500 with error body when pdf-parse throws', async () => {
    mockGetText.mockRejectedValue(new Error('PDF corrupted'));

    const req = makeRequest(makePdfFormData('corrupt.pdf'));
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

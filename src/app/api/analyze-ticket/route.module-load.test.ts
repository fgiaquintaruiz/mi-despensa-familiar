/**
 * Tests that verify the route module survives a pdf-parse load failure.
 *
 * WHY a separate file: vi.doMock (non-hoisted) must run BEFORE the module
 * under test is imported. Using a fresh file with dynamic import gives us
 * full control over module initialisation order.
 *
 * This regression test captures the Vercel HTTP-500 bug:
 *   - root cause: top-level `import pdfParse from 'pdf-parse'` crashes the
 *     entire serverless module when pdf-parse fails to initialise at runtime.
 *   - fix: lazy require inside the handler, wrapped in try/catch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe('POST /api/analyze-ticket — module-load resilience', () => {
  it('returns JSON 500 when pdf-parse fails to load (module initialisation error)', async () => {
    // Arrange — make require('pdf-parse') throw BEFORE importing the route
    vi.doMock('pdf-parse', () => {
      throw new Error('Cannot find module pdf-parse (simulated Vercel init crash)');
    });

    // Also mock findParser so the module can load cleanly
    vi.doMock('@/lib/parsers', () => ({
      findParser: vi.fn().mockReturnValue(undefined),
    }));

    // Act — dynamic import; with a top-level import this would throw here
    const { POST } = await import('./route');

    const blob = new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' });
    const file = new File([blob], 'invoice.pdf', { type: 'application/pdf' });
    const fd = new FormData();
    fd.append('file', file);
    const req = new Request('http://localhost/api/analyze-ticket', {
      method: 'POST',
      body: fd,
    });

    const res = await POST(req);

    // Assert — must be a JSON 500, NOT an unhandled module crash
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

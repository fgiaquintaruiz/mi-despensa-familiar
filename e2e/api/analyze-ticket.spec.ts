/**
 * E2E API tests for POST /api/analyze-ticket
 *
 * Uses Playwright's `request` fixture (API mode — no browser).
 * Fixtures: real supermarket receipts from docs/.
 *
 * Item shape expected from the API:
 *   { name: string; qty: number; unit: string; price: number; category: string }
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve(__dirname, '../../docs');

function pdfFixture(filename: string): Buffer {
  return fs.readFileSync(path.join(DOCS_DIR, filename));
}

function imageFixture(filename: string): Buffer {
  return fs.readFileSync(path.join(DOCS_DIR, filename));
}

// ---------------------------------------------------------------------------
// Happy path — real Mercadona PDF
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — PDF Mercadona: returns items array', async ({ request }) => {
  const buffer = pdfFixture('20260430 Mercadona 24,75 €.pdf');

  const response = await request.post('/api/analyze-ticket', {
    multipart: {
      file: {
        name: 'mercadona.pdf',
        mimeType: 'application/pdf',
        buffer,
      },
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty('items');
  expect(Array.isArray(body.items)).toBe(true);

  // IMPORTANT: if this fails with length 0, that is a real parser bug — report it.
  // The PDF is a real Mercadona ticket dated 2026-04-30 worth 24,75 €.
  expect(body.items.length).toBeGreaterThan(0);

  const item = body.items[0];
  expect(typeof item.name).toBe('string');
  expect(item.name.length).toBeGreaterThan(0);
  expect(typeof item.price).toBe('number');
  expect(item.price).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Happy path — second Mercadona PDF (cross-validation)
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — second Mercadona PDF: returns items', async ({ request }) => {
  const buffer = pdfFixture('20260502 Mercadona 13,08 €.pdf');

  const response = await request.post('/api/analyze-ticket', {
    multipart: {
      file: {
        name: 'mercadona2.pdf',
        mimeType: 'application/pdf',
        buffer,
      },
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.store).toMatch(/mercadona/i);
});

// ---------------------------------------------------------------------------
// Happy path — JPEG image (Mercadona short ticket via OCR)
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — JPEG Mercadona: returns items or empty with valid shape', async ({ request }) => {
  const buffer = imageFixture('mercadona corto.jpeg');

  const response = await request.post('/api/analyze-ticket', {
    multipart: {
      file: {
        name: 'mercadona corto.jpeg',
        mimeType: 'image/jpeg',
        buffer,
      },
    },
  });

  // Could be 200 (items found via OCR) or 422 (no parser matched for image-only path)
  // The important thing is: no crash, and if 200 → valid shape
  expect([200, 422]).toContain(response.status());

  const body = await response.json();
  if (response.status() === 200) {
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.price).toBe('number');
    }
  } else {
    // 422: no parser matched — acceptable for short OCR tickets
    expect(typeof body.error).toBe('string');
  }
});

// ---------------------------------------------------------------------------
// Happy path — JPEG Aldi
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — JPEG Aldi: returns items or valid 422', async ({ request }) => {
  const buffer = imageFixture('aldi corto.jpeg');

  const response = await request.post('/api/analyze-ticket', {
    multipart: {
      file: {
        name: 'aldi corto.jpeg',
        mimeType: 'image/jpeg',
        buffer,
      },
    },
  });

  expect([200, 422]).toContain(response.status());
  const body = await response.json();
  if (response.status() === 200) {
    expect(Array.isArray(body.items)).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Error path — invalid PDF (plain text disguised as PDF)
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — invalid PDF: returns HTTP 500 with JSON error', async ({ request }) => {
  const fakePdfBuffer = Buffer.from('This is definitely not a PDF file, just plain text.');

  const response = await request.post('/api/analyze-ticket', {
    multipart: {
      file: {
        name: 'fake.pdf',
        mimeType: 'application/pdf',
        buffer: fakePdfBuffer,
      },
    },
  });

  // Must return 500 with JSON — never HTML (no unhandled crash)
  expect(response.status()).toBe(500);

  const contentType = response.headers()['content-type'] ?? '';
  expect(contentType).toContain('application/json');

  const body = await response.json();
  expect(typeof body.error).toBe('string');
  expect(body.error.length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Error path — no file in body
// ---------------------------------------------------------------------------
test('POST /api/analyze-ticket — no file: returns 400 with JSON error', async ({ request }) => {
  const response = await request.post('/api/analyze-ticket', {
    multipart: {},
  });

  expect(response.status()).toBe(400);

  const contentType = response.headers()['content-type'] ?? '';
  expect(contentType).toContain('application/json');

  const body = await response.json();
  expect(typeof body.error).toBe('string');
});

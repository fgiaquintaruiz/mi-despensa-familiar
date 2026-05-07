/**
 * E2E API tests for POST /api/parse-ticket-text
 *
 * Uses Playwright's `request` fixture (API mode — no browser).
 *
 * Body shape: { text: string; hint?: string }
 * The field is `hint`, not `store` (see route.ts L24).
 *
 * Item shape expected:
 *   { name: string; qty: number; unit: string; price: number; category: string }
 */
import { test, expect } from '@playwright/test';

// Realistic Mercadona ticket text (matches the format the mercadonaParser expects:
//   "Descripción" header, item lines as "QTY NAME PRICE", ends with "TOTAL (€)")
const MERCADONA_TEXT = `
MERCADONA, S.A.
AVDA. DE MADRID, 44
TICKET DE COMPRA

Descripción
1 LECHE ENTERA 1L      0,72
2 PAN MOLDE BIMBO      1,95
1 ACEITE OLIVA VIRGEN  4,25
1 YOGUR NATURAL        0,65
1 DETERGENTE ARIEL     5,99
TOTAL (€)              13,56
`.trim();

const MERCADONA_TEXT_SHORT = `
MERCADONA, S.A.
Descripción
1 ARROZ LARGO          1,20
1 PASTA ESPAGUETI      0,85
TOTAL (€)              2,05
`.trim();

// ---------------------------------------------------------------------------
// Happy path — Mercadona text, auto-detect
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — Mercadona text: returns items', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: MERCADONA_TEXT },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(body).toHaveProperty('items');
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items.length).toBeGreaterThan(0);

  const item = body.items[0];
  expect(typeof item.name).toBe('string');
  expect(item.name.length).toBeGreaterThan(0);
  expect(typeof item.price).toBe('number');
  expect(item.price).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Happy path — with hint (store hint overrides auto-detection)
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — with hint=Mercadona: returns items', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: MERCADONA_TEXT_SHORT, hint: 'Mercadona' },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();

  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.parser).toMatch(/mercadona/i);
});

// ---------------------------------------------------------------------------
// Happy path — case-insensitive hint
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — hint=mercadona (lowercase): returns items', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: MERCADONA_TEXT_SHORT, hint: 'mercadona' },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.items)).toBe(true);
});

// ---------------------------------------------------------------------------
// No-match path — text without any recognizable store
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — unrecognized store: returns 200 with empty items', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: 'Tienda desconocida\nProducto X 1,00\n' },
    headers: { 'Content-Type': 'application/json' },
  });

  // Route returns 200 with items:[] and message when no parser matches (see route.ts L41)
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items).toHaveLength(0);
  // Optional: route also returns message
  if (body.message) {
    expect(typeof body.message).toBe('string');
  }
});

// ---------------------------------------------------------------------------
// Error path — empty text string
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — empty text: returns 400', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: '' },
    headers: { 'Content-Type': 'application/json' },
  });

  // Route validates text is non-empty (route.ts L15-21)
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(typeof body.error).toBe('string');
});

// ---------------------------------------------------------------------------
// Error path — missing text field entirely
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — missing text field: returns 400', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { hint: 'mercadona' },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(typeof body.error).toBe('string');
});

// ---------------------------------------------------------------------------
// Error path — invalid JSON body
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — invalid JSON: returns 400', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: 'not json at all',
    headers: { 'Content-Type': 'application/json' },
  });

  expect(response.status()).toBe(400);
});

// ---------------------------------------------------------------------------
// Error path — unknown hint value
// ---------------------------------------------------------------------------
test('POST /api/parse-ticket-text — unknown hint: returns 400', async ({ request }) => {
  const response = await request.post('/api/parse-ticket-text', {
    data: { text: MERCADONA_TEXT, hint: 'supermercado-inexistente' },
    headers: { 'Content-Type': 'application/json' },
  });

  // Route returns 400 when hint doesn't match a known parser (route.ts L33-36)
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(typeof body.error).toBe('string');
  expect(body.error).toContain('supermercado-inexistente');
});

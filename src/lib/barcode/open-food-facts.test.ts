import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupBarcode } from './open-food-facts';

describe('lookupBarcode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(data: unknown) {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve(data),
    } as Response);
  }

  it('returns a FoodProduct when barcode is found', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Leche Entera',
        brands: 'La Serenísima',
        categories_tags: ['en:dairy'],
      },
    });

    const result = await lookupBarcode('7790036001290');

    expect(result).toEqual({
      name: 'Leche Entera',
      brand: 'La Serenísima',
      category: 'frescos',
      barcode: '7790036001290',
    });
  });

  it('returns null when status is 0', async () => {
    mockFetch({ status: 0 });

    const result = await lookupBarcode('0000000000000');

    expect(result).toBeNull();
  });

  it('returns null when product is missing', async () => {
    mockFetch({ status: 1 });

    const result = await lookupBarcode('0000000000000');

    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await lookupBarcode('7790036001290');

    expect(result).toBeNull();
  });

  it('maps en:dairy to frescos', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Yogur',
        brands: 'Danone',
        categories_tags: ['en:dairy'],
      },
    });

    const result = await lookupBarcode('1234567890123');

    expect(result?.category).toBe('frescos');
  });

  it('maps en:hygiene to higiene', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Shampoo',
        brands: 'Head & Shoulders',
        categories_tags: ['en:hygiene'],
      },
    });

    const result = await lookupBarcode('1234567890124');

    expect(result?.category).toBe('higiene');
  });

  it('maps en:baby to bebe', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Pañales',
        brands: 'Pampers',
        categories_tags: ['en:baby'],
      },
    });

    const result = await lookupBarcode('1234567890125');

    expect(result?.category).toBe('bebe');
  });

  it('maps en:cleaning to limpieza', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Detergente',
        brands: 'Skip',
        categories_tags: ['en:cleaning'],
      },
    });

    const result = await lookupBarcode('1234567890126');

    expect(result?.category).toBe('limpieza');
  });

  it('maps en:medications to farmacia', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Ibuprofeno',
        brands: null,
        categories_tags: ['en:medications'],
      },
    });

    const result = await lookupBarcode('1234567890127');

    expect(result?.category).toBe('farmacia');
  });

  it('defaults unmapped categories to despensa', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Galletitas',
        brands: 'Oreo',
        categories_tags: ['en:snacks'],
      },
    });

    const result = await lookupBarcode('1234567890128');

    expect(result?.category).toBe('despensa');
  });

  it('returns null category when no categories_tags', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Producto sin categoría',
        brands: null,
        categories_tags: [],
      },
    });

    const result = await lookupBarcode('1234567890129');

    expect(result?.category).toBeNull();
  });

  it('takes only the first brand when brands is a comma-separated list', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Multi-brand',
        brands: 'Marca A, Marca B',
        categories_tags: ['en:snacks'],
      },
    });

    const result = await lookupBarcode('1234567890130');

    expect(result?.brand).toBe('Marca A');
  });

  it('passes the barcode through to the result', async () => {
    mockFetch({
      status: 1,
      product: {
        product_name: 'Algo',
        brands: null,
        categories_tags: [],
      },
    });

    const result = await lookupBarcode('9876543210987');

    expect(result?.barcode).toBe('9876543210987');
  });
});

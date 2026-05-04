/**
 * Minimal Open Food Facts client.
 * Searches by product name and returns the first matching brand, or "" if none / error.
 */

interface OpenFoodFactsSearchResult {
  brands?: string;
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsSearchResult[];
}

export async function lookupBrand(name: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&json=1&page_size=1&fields=brands`;
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) return '';

    const data: OpenFoodFactsResponse = await res.json();
    return data.products?.[0]?.brands ?? '';
  } catch {
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}

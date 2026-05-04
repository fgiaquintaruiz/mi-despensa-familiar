/**
 * Minimal Open Food Facts client.
 * Searches by product name and returns the first matching brand and product name, or {} if none / error.
 */

interface OpenFoodFactsSearchResult {
  brands?: string;
  product_name?: string;
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsSearchResult[];
}

export interface OFFLookupResult {
  brand?: string;
  productName?: string;
}

export async function lookupBrand(name: string): Promise<OFFLookupResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&json=1&page_size=1&fields=brands,product_name`;
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) return {};

    const data: OpenFoodFactsResponse = await res.json();
    const hit = data.products?.[0];
    const brand = hit?.brands || undefined;
    const productName = hit?.product_name || undefined;

    if (!brand && !productName) return {};
    return { brand, productName };
  } catch {
    return {};
  } finally {
    clearTimeout(timeoutId);
  }
}

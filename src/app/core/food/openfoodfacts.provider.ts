import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FoodItem, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { FoodProvider } from './food-provider';

// Freitextsuche über search-a-licious (eigener Suchdienst der OFF).
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
// Autocomplete (Taxonomie) über search-a-licious.
const AUTOCOMPLETE_URL = 'https://search.openfoodfacts.org/autocomplete';
// Barcode exakt über Product Opener v3.
const PRODUCT_V3_URL = 'https://world.openfoodfacts.org/api/v3/product';
const FIELDS = 'code,product_name,brands,image_url,image_small_url,nutriments,serving_quantity';
const LANGS = 'de,en';

const OFF_HEADERS = new HttpHeaders({
  'User-Agent': 'NutriTrack/1.0 (https://github.com/jakob/nutritrack)',
});

interface OffNutriments {
  [k: string]: number | string | undefined;
}
interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_small_url?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
}
interface SearchResponse {
  hits?: OffProduct[];
  count?: number;
}
interface ProductV3Response {
  status?: string;
  product?: OffProduct;
}

/** Ein nicht gefundener Treffer (HTTP 404) ist kein Netzwerkfehler. */
function isNotFound(e: unknown): boolean {
  return e instanceof HttpErrorResponse && e.status === 404;
}

/**
 * Food-Datenquelle über die freie **OpenFoodFacts**-API (kein Key nötig).
 * Freitextsuche via **search-a-licious** (`/search`), Barcode-Lookup via
 * **Product Opener v3**. not-found (404) → leer/null statt Netzfehler.
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly http = inject(HttpClient);

  async searchByText(query: string, limit = 12): Promise<FoodItem[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const res = await firstValueFrom(
        this.http.get<SearchResponse>(SEARCH_URL, {
          headers: OFF_HEADERS,
          params: {
            q,
            page_size: String(limit),
            fields: FIELDS,
            langs: LANGS,
          },
        }),
      );
      return (res.hits ?? [])
        .map((p) => this.toFoodItem(p))
        .filter((f): f is FoodItem => f !== null);
    } catch (e: unknown) {
      if (isNotFound(e)) return [];
      throw e;
    }
  }

  /** Produkt-Namensvorschläge für die Freitextsuche (kleine, schnelle Trefferliste). */
  async autocomplete(query: string, limit = 6): Promise<FoodItem[]> {
    return this.searchByText(query, limit);
  }

  async lookupByBarcode(barcode: string): Promise<FoodItem | null> {
    const code = barcode.trim();
    if (!code) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<ProductV3Response>(
          `${PRODUCT_V3_URL}/${encodeURIComponent(code)}.json`,
          { headers: OFF_HEADERS, params: { fields: FIELDS } },
        ),
      );
      if (!res.product || res.status === 'failure') return null;
      return this.toFoodItem(res.product);
    } catch (e: unknown) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  private num(v: number | string | undefined): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  private toFoodItem(p: OffProduct): FoodItem | null {
    const name = (p.product_name ?? '').trim();
    if (!name) return null;
    const n = p.nutriments ?? {};
    const facts: NutritionFacts = {
      kcal: this.num(n['energy-kcal_100g']),
      proteinG: this.num(n['proteins_100g']),
      carbsG: this.num(n['carbohydrates_100g']),
      fatG: this.num(n['fat_100g']),
      fiberG: this.num(n['fiber_100g']),
      sugarG: this.num(n['sugars_100g']),
      saltG: this.num(n['salt_100g']),
      basis: 'per100g',
    };
    return {
      id: makeId('off'),
      source: 'openfoodfacts',
      name,
      brand: p.brands?.split(',')[0]?.trim(),
      barcode: p.code,
      facts,
      servingG: p.serving_quantity ? this.num(p.serving_quantity) : undefined,
      imageUrl: p.image_small_url || p.image_url,
    };
  }
}

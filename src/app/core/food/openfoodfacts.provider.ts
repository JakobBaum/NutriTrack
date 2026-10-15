import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FoodItem, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { FoodProvider } from './food-provider';

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'code,product_name,brands,image_small_url,nutriments,serving_quantity';

interface OffNutriments {
  [k: string]: number | string | undefined;
}
interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_small_url?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
}

/**
 * Food-Datenquelle über die freie **OpenFoodFacts**-API (kein Key nötig).
 * Nährwerte werden auf 100 g bezogen (`per100g`) nach {@link NutritionFacts} gemappt.
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly http = inject(HttpClient);

  async searchByText(query: string, limit = 12): Promise<FoodItem[]> {
    const q = query.trim();
    if (!q) return [];
    const res = await firstValueFrom(
      this.http.get<{ products?: OffProduct[] }>(SEARCH_URL, {
        params: {
          search_terms: q,
          search_simple: '1',
          action: 'process',
          json: '1',
          page_size: String(limit),
          fields: FIELDS,
        },
      }),
    );
    return (res.products ?? [])
      .map((p) => this.toFoodItem(p))
      .filter((f): f is FoodItem => f !== null);
  }

  async lookupByBarcode(barcode: string): Promise<FoodItem | null> {
    const code = barcode.trim();
    if (!code) return null;
    const res = await firstValueFrom(
      this.http.get<{ status?: number; product?: OffProduct }>(
        `${PRODUCT_URL}/${encodeURIComponent(code)}.json`,
        { params: { fields: FIELDS } },
      ),
    );
    if (!res.product || res.status === 0) return null;
    return this.toFoodItem(res.product);
  }

  private num(v: number | string | undefined): number {
    const n = typeof v === 'number' ? v : Number(v);
    // Nährwerte sind nie negativ — fehlerhafte Felder defensiv auf 0 klemmen.
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
      imageUrl: p.image_small_url,
    };
  }
}

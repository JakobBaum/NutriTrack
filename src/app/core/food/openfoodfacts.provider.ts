import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FoodItem, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { parseDecimal } from '../util/number-input';
import { FoodProvider } from './food-provider';
import { toFoodLookupError } from './food-errors';
import { SettingsStore } from '../state/settings.store';
import { environment } from '../../../environments/environment';
import { DebugLogService } from '../debug/debug-log.service';

// Freitextsuche: dev → Angular-Dev-Proxy; prod → NutriTrack-Worker (search.openfoodfacts.org
// sendet keine CORS-Header). Eine eigene proxyUrl in den Einstellungen hat Vorrang.
const SEARCH_URL_DEFAULT = environment.offSearchUrl;
// Barcode exakt über Product Opener v3 (hat CORS *).
const PRODUCT_V3_URL = 'https://world.openfoodfacts.org/api/v3/product';
const FIELDS = 'code,product_name,brands,image_url,image_small_url,nutriments,serving_quantity';
const SEARCH_FIELDS = `${FIELDS},lang,countries_tags`;
const LANGS = 'de,en';
// Mehr Kandidaten holen, damit nach dem DACH-Ranking genug passende übrig bleiben.
const CANDIDATE_FACTOR = 2;
const MAX_PAGE_SIZE = 50;
/** 1 kcal = 4,184 kJ. */
const KJ_PER_KCAL = 4.184;
const DACH_COUNTRIES = new Set(['en:austria', 'en:germany', 'en:switzerland']);

// Bewusst KEIN eigener User-Agent-Header: Chrome verwirft ihn, Safari/Firefox schicken
// dafür einen CORS-Preflight, den Proxy und OFF-Server ablehnen → Suche bricht ab.
// Der Worker setzt den von OFF gewünschten User-Agent serverseitig.

interface OffNutriments {
  [k: string]: number | string | undefined;
}
interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  image_url?: string;
  image_small_url?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
  lang?: string;
  countries_tags?: string[];
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

/** Höher = relevanter für Nutzer im DACH-Raum (Produkt dort verkauft, deutscher Name). */
function localeScore(p: OffProduct): number {
  const soldInDach = (p.countries_tags ?? []).some((c) => DACH_COUNTRIES.has(c));
  return (soldInDach ? 2 : 0) + (p.lang === 'de' ? 1 : 0);
}

/** Stabile Sortierung nach {@link localeScore}; Originalreihenfolge bleibt bei Gleichstand. */
function rankForDach(products: readonly OffProduct[]): OffProduct[] {
  return products
    .map((p, i) => ({ p, i, s: localeScore(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * Food-Datenquelle über die freie **OpenFoodFacts**-API (kein Key nötig).
 * Freitextsuche via **search-a-licious** (`/search`), Barcode-Lookup via
 * **Product Opener v3**. not-found (404) → leer/null; andere Fehler als
 * {@link FoodLookupError} (offline / rate-limit / server).
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsStore);
  private readonly log = inject(DebugLogService);

  private searchUrl(): string {
    const proxy = this.settings.ai().proxyUrl?.trim();
    return proxy ? `${proxy.replace(/\/+$/, '')}/off-search` : SEARCH_URL_DEFAULT;
  }

  async searchByText(query: string, limit = 12): Promise<FoodItem[]> {
    const q = query.trim();
    if (!q) return [];
    const url = this.searchUrl();
    this.log.info(`→ Suche "${q}" via ${url}`);
    try {
      const res = await firstValueFrom(
        this.http.get<SearchResponse>(url, {
          params: {
            q,
            page_size: String(Math.min(limit * CANDIDATE_FACTOR, MAX_PAGE_SIZE)),
            fields: SEARCH_FIELDS,
            langs: LANGS,
          },
        }),
      );
      const items = rankForDach(res.hits ?? [])
        .map((p) => this.toFoodItem(p))
        .filter((f): f is FoodItem => f !== null)
        .slice(0, limit);
      this.log.success(`✓ ${items.length} Treffer für "${q}"`);
      return items;
    } catch (e: unknown) {
      if (isNotFound(e)) { this.log.info(`Keine Treffer für "${q}"`); return []; }
      const err = toFoodLookupError(e);
      this.log.error(`✗ Suche "${q}" (${err.reason}): ${err.message}`);
      throw err;
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
          { params: { fields: FIELDS } },
        ),
      );
      if (!res.product || res.status === 'failure') return null;
      return this.toFoodItem(res.product);
    } catch (e: unknown) {
      if (isNotFound(e)) return null;
      const err = toFoodLookupError(e);
      this.log.error(`✗ Barcode ${code} (${err.reason}): ${err.message}`);
      throw err;
    }
  }

  private num(v: number | string | undefined): number {
    const n = parseDecimal(v);
    return n !== null ? Math.max(0, n) : 0;
  }

  /** kcal je 100 g; fehlt der Wert, wird aus kJ umgerechnet. null = keine Naehrwerte (nie still 0 kcal). */
  private kcalPer100g(n: OffNutriments): number | null {
    const kcal = parseDecimal(n['energy-kcal_100g']);
    if (kcal !== null) return Math.max(0, kcal);
    const kj = parseDecimal(n['energy-kj_100g']);
    return kj !== null ? Math.max(0, kj / KJ_PER_KCAL) : null;
  }

  private toFoodItem(p: OffProduct): FoodItem | null {
    const name = (p.product_name ?? '').trim();
    if (!name) return null;
    const n = p.nutriments ?? {};
    const kcal = this.kcalPer100g(n);
    if (kcal === null) return null;
    const facts: NutritionFacts = {
      kcal,
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
      brand: Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0]?.trim(),
      barcode: p.code,
      facts,
      servingG: p.serving_quantity ? this.num(p.serving_quantity) : undefined,
      imageUrl: p.image_small_url || p.image_url,
    };
  }
}

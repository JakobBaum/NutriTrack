import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlausiblePer100g } from './facts-plausibility';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { FoodItem, NutritionFacts } from '../models';
import { makeId } from '../util/id';
import { parseDecimal } from '../util/number-input';
import { FoodProvider } from './food-provider';
import { FOOD_TIMEOUT_MS, toFoodLookupError } from './food-errors';
import { plausibleServingG } from './serving';
import { environment } from '../../../environments/environment';
import { DebugLogService } from '../debug/debug-log.service';
import {
  RankEntry, dedupe, normalizeBrand, normalizeQuantity, rank, removeBrandFromName, stripSize,
} from './food-search-clean';

// Freitextsuche: dev → Angular-Dev-Proxy; prod → NutriTrack-Worker (search.openfoodfacts.org
// sendet keine CORS-Header). Die Adresse steht fest in der Umgebung.
const SEARCH_URL_DEFAULT = environment.offSearchUrl;
// Barcode exakt über Product Opener v3 (hat CORS *).
const PRODUCT_V3_URL = 'https://world.openfoodfacts.org/api/v3/product';
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,quantity,nutriscore_grade,categories_tags';
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
  serving_quantity?: number | string;
  quantity?: string;
  nutriscore_grade?: string;
  categories_tags?: string[];
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

/**
 * Food-Datenquelle über die freie **OpenFoodFacts**-API (kein Key nötig).
 * Freitextsuche via **search-a-licious** (`/search`), Barcode-Lookup via
 * **Product Opener v3**. not-found (404) → leer/null; andere Fehler als
 * {@link FoodLookupError} (offline / rate-limit / server).
 */
@Injectable({ providedIn: 'root' })
export class OpenFoodFactsProvider implements FoodProvider {
  private readonly http = inject(HttpClient);
  private readonly log = inject(DebugLogService);

  private searchUrl(): string {
    return SEARCH_URL_DEFAULT;
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
        }).pipe(timeout(FOOD_TIMEOUT_MS)),
      );
      const entries = (res.hits ?? []).flatMap((p): RankEntry[] => {
        const item = this.toFoodItem(p);
        return item ? [{ item, locale: localeScore(p), categories: p.categories_tags }] : [];
      });
      const items = dedupe(rank(entries, q).map((e) => e.item)).slice(0, limit);
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
        ).pipe(timeout(FOOD_TIMEOUT_MS)),
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

  /** Optionaler Nährwert: undefined statt 0, wenn OFF ihn nicht liefert (kein erfundenes "0 g Salz"). */
  private optionalNum(v: number | string | undefined): number | undefined {
    const n = parseDecimal(v);
    return n !== null ? Math.max(0, n) : undefined;
  }

  /** kcal je 100 g; fehlt der Wert, wird aus kJ umgerechnet. null = keine Naehrwerte (nie still 0 kcal). */
  private kcalPer100g(n: OffNutriments): number | null {
    const kcal = parseDecimal(n['energy-kcal_100g']);
    if (kcal !== null) return Math.max(0, kcal);
    const kj = parseDecimal(n['energy-kj_100g']);
    return kj !== null ? Math.max(0, kj / KJ_PER_KCAL) : null;
  }

  private toFoodItem(p: OffProduct): FoodItem | null {
    const rawName = (p.product_name ?? '').trim();
    if (!rawName) return null;
    const stripped = stripSize(rawName);
    const brand = normalizeBrand(p.brands, stripped.name);
    const name = removeBrandFromName(stripped.name, brand);
    const quantity = normalizeQuantity(p.quantity) ?? stripped.quantity;
    const grade = (p.nutriscore_grade ?? '').toLowerCase();
    const nutriscore = /^[a-e]$/.test(grade) ? (grade as FoodItem['nutriscore']) : undefined;
    const n = p.nutriments ?? {};
    const kcal = this.kcalPer100g(n);
    if (kcal === null) return null;
    const facts: NutritionFacts = {
      kcal,
      proteinG: this.num(n['proteins_100g']),
      carbsG: this.num(n['carbohydrates_100g']),
      fatG: this.num(n['fat_100g']),
      fiberG: this.optionalNum(n['fiber_100g']),
      sugarG: this.optionalNum(n['sugars_100g']),
      saltG: this.optionalNum(n['salt_100g']),
      basis: 'per100g',
    };
    if (!isPlausiblePer100g(facts)) {
      this.log.error(`Unplausible Nährwerte verworfen (Barcode ${p.code ?? 'ohne'})`);
      return null;
    }
    return {
      id: makeId('off'),
      source: 'openfoodfacts',
      name,
      brand,
      barcode: p.code,
      facts,
      servingG: plausibleServingG(p.serving_quantity),
      quantity,
      nutriscore,
    };
  }
}

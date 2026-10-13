import { InjectionToken } from '@angular/core';
import { FoodItem } from '../models';

/**
 * Austauschbare Lebensmittel-Datenquelle (Textsuche + Barcode-Lookup).
 * Default-Adapter: {@link OpenFoodFactsProvider}.
 */
export interface FoodProvider {
  /** Volltextsuche nach Lebensmitteln. */
  searchByText(query: string, limit?: number): Promise<FoodItem[]>;
  /** Lookup per Barcode (EAN/GTIN); null, wenn nicht gefunden. */
  lookupByBarcode(barcode: string): Promise<FoodItem | null>;
}

/** DI-Token für die aktive Food-Datenquelle. */
export const FOOD_PROVIDER = new InjectionToken<FoodProvider>('FOOD_PROVIDER');

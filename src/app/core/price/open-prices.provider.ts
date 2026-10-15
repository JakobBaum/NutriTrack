import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const PRICES_URL = 'https://prices.openfoodfacts.org/api/v1/prices';

interface OpenPrice {
  price?: number;
  currency?: string;
  date?: string;
}
interface OpenPricesResponse {
  items?: OpenPrice[];
  total?: number;
}

/** Realer Preis zu einem Produkt (aus Open Prices gemittelt). */
export interface PriceInfo {
  /** Durchschnittspreis der jüngsten Einträge. */
  avg: number;
  currency: string;
  /** Anzahl berücksichtigter Preis-Einträge. */
  count: number;
}

/**
 * Reale Supermarktpreise über **Open Prices** (OpenFoodFacts-Ökosystem, frei,
 * kein Key für Lesezugriff). Liefert zu einem Barcode den Durchschnitt der
 * jüngsten erfassten Preise. Keine Treffer → null (dann bleibt die Schätzung).
 */
@Injectable({ providedIn: 'root' })
export class OpenPricesProvider {
  private readonly http = inject(HttpClient);

  /** Mittlerer realer Preis zu einem Barcode (EUR bevorzugt); null wenn unbekannt. */
  async priceByBarcode(barcode: string, limit = 10): Promise<PriceInfo | null> {
    const code = barcode.trim();
    if (!code) return null;
    let res: OpenPricesResponse;
    try {
      res = await firstValueFrom(
        this.http.get<OpenPricesResponse>(PRICES_URL, {
          params: { product_code: code, order_by: '-date', size: String(limit) },
        }),
      );
    } catch {
      return null;
    }
    const items = (res.items ?? []).filter((i) => typeof i.price === 'number' && i.price! > 0);
    if (items.length === 0) return null;

    // Bevorzugt EUR; sonst die häufigste Währung in der Antwort.
    const eur = items.filter((i) => (i.currency ?? 'EUR').toUpperCase() === 'EUR');
    const pick = eur.length ? eur : items;
    const sum = pick.reduce((s, i) => s + (i.price as number), 0);
    return {
      avg: Math.round((sum / pick.length) * 100) / 100,
      currency: (pick[0].currency ?? 'EUR').toUpperCase(),
      count: pick.length,
    };
  }
}

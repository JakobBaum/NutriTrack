import { HttpErrorResponse } from '@angular/common/http';
import { isTimeoutError } from '../ai/ai-errors';

/** Warum eine Lebensmittel-Abfrage fehlschlug (für passende Nutzer-Meldungen). */
export type FoodLookupFailure = 'offline' | 'rate-limit' | 'server' | 'timeout';

/** Zeitlimit für eine Lebensmittel-Abfrage (Suche und Barcode), danach Abbruch mit Meldung. */
export const FOOD_TIMEOUT_MS = 10000;

const HTTP_TOO_MANY_REQUESTS = 429;

/** Fehler einer Food-Abfrage mit klassifiziertem Grund. */
export class FoodLookupError extends Error {
  constructor(
    readonly reason: FoodLookupFailure,
    message: string,
  ) {
    super(message);
    this.name = 'FoodLookupError';
  }
}

/** True, wenn der Browser sicher weiß, dass das Gerät offline ist. */
function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Klassifiziert einen HTTP-Fehler. Status 0 heißt: Browser hat keine Antwort
 * geliefert. Das ist „offline“, wenn das Gerät kein Netz hat — sonst hat der
 * Server die Anfrage verweigert (z. B. CORS, Proxy down) und es ist ein Serverproblem.
 */
export function toFoodLookupError(e: unknown): FoodLookupError {
  if (e instanceof FoodLookupError) return e;
  if (isTimeoutError(e)) return new FoodLookupError('timeout', 'Zeitlimit überschritten');
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return new FoodLookupError(isDeviceOffline() ? 'offline' : 'server', e.message);
    if (e.status === HTTP_TOO_MANY_REQUESTS) return new FoodLookupError('rate-limit', e.message);
    return new FoodLookupError('server', `HTTP ${e.status}: ${e.message}`);
  }
  return new FoodLookupError('server', e instanceof Error ? e.message : String(e));
}

/** Nutzerfreundliche Meldung für die UI. */
export function foodErrorMessage(e: unknown): string {
  if (!(e instanceof FoodLookupError)) return 'Abfrage fehlgeschlagen — bitte erneut versuchen.';
  switch (e.reason) {
    case 'rate-limit':
      return 'Zu viele Anfragen an die Lebensmittel-Datenbank — bitte kurz warten.';
    case 'timeout':
      return 'Die Lebensmittel-Datenbank antwortet gerade nicht — bitte erneut versuchen.';
    case 'offline':
      return 'Keine Verbindung zur Lebensmittel-Datenbank — Internet prüfen.';
    default:
      return 'Lebensmittel-Datenbank gerade nicht erreichbar — bitte später erneut versuchen.';
  }
}

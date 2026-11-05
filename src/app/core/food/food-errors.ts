import { HttpErrorResponse } from '@angular/common/http';

/** Warum eine Lebensmittel-Abfrage fehlschlug (für passende Nutzer-Meldungen). */
export type FoodLookupFailure = 'offline' | 'rate-limit' | 'server';

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

/**
 * Klassifiziert einen HTTP-Fehler. Status 0 heißt: Browser hat die Antwort
 * blockiert (CORS) oder es gibt kein Netz — beides „keine Verbindung“.
 */
export function toFoodLookupError(e: unknown): FoodLookupError {
  if (e instanceof FoodLookupError) return e;
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return new FoodLookupError('offline', e.message);
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
    case 'offline':
      return 'Keine Verbindung zur Lebensmittel-Datenbank — Internet prüfen.';
    default:
      return 'Lebensmittel-Datenbank gerade nicht erreichbar — bitte später erneut versuchen.';
  }
}

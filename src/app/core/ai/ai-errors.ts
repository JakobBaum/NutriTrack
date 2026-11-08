/** Gemeinsame, nutzerfreundliche Fehlertexte für Proxy- und Direkt-Anbieter. */

export const AI_ERROR_MESSAGES = {
  overloaded: 'Die KI ist gerade überlastet — bitte in einer Minute erneut versuchen.',
  rateLimited: 'Zu viele KI-Anfragen — bitte kurz warten und erneut versuchen.',
  offline: 'Keine Verbindung zur KI. Prüfe deine Internetverbindung.',
  unauthorized: 'KI-Zugang abgelehnt. Prüfe den Schlüssel unter Profil › KI-Verbindung.',
  timeout: 'Die KI antwortet gerade nicht - bitte erneut versuchen.',
  generic: 'Die KI-Anfrage ist fehlgeschlagen. Bitte erneut versuchen.',
} as const;

/** Client-seitiges Zeitlimit für einen KI-Aufruf (Proxy und Gemini direkt). */
export const AI_TIMEOUT_MS = 30000;

/** Bildet einen HTTP-Status (0 = Netzwerkfehler) auf eine deutsche Meldung ab. */
export function friendlyAiErrorMessage(status: number): string {
  if (status === 0) return AI_ERROR_MESSAGES.offline;
  if (status === 429) return AI_ERROR_MESSAGES.rateLimited;
  if (status === 401 || status === 403) return AI_ERROR_MESSAGES.unauthorized;
  if (status === 503 || status === 502 || status === 504 || status === 500) return AI_ERROR_MESSAGES.overloaded;
  return AI_ERROR_MESSAGES.generic;
}

/** True bei einem rxjs-`timeout`-Fehler (TimeoutError). */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'TimeoutError';
}

/** Wandelt einen Zeitüberschreitungs-Fehler in die deutsche Meldung um; andere Fehler bleiben. */
export function mapTimeoutError(err: unknown): unknown {
  return isTimeoutError(err) ? new Error(AI_ERROR_MESSAGES.timeout) : err;
}

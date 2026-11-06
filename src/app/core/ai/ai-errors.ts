/** Gemeinsame, nutzerfreundliche Fehlertexte für Proxy- und Direkt-Anbieter. */

export const AI_ERROR_MESSAGES = {
  overloaded: 'Die KI ist gerade überlastet — bitte in einer Minute erneut versuchen.',
  rateLimited: 'Zu viele KI-Anfragen — bitte kurz warten und erneut versuchen.',
  offline: 'Keine Verbindung zur KI. Prüfe deine Internetverbindung.',
  unauthorized: 'KI-Zugang abgelehnt. Prüfe den Schlüssel unter Profil › KI-Verbindung.',
  generic: 'Die KI-Anfrage ist fehlgeschlagen. Bitte erneut versuchen.',
} as const;

/** Bildet einen HTTP-Status (0 = Netzwerkfehler) auf eine deutsche Meldung ab. */
export function friendlyAiErrorMessage(status: number): string {
  if (status === 0) return AI_ERROR_MESSAGES.offline;
  if (status === 429) return AI_ERROR_MESSAGES.rateLimited;
  if (status === 401 || status === 403) return AI_ERROR_MESSAGES.unauthorized;
  if (status === 503 || status === 502 || status === 504 || status === 500) return AI_ERROR_MESSAGES.overloaded;
  return AI_ERROR_MESSAGES.generic;
}

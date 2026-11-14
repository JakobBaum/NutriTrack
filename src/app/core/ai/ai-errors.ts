import { STATE_MESSAGES } from '../messages/state-messages';

/** Gemeinsame, nutzerfreundliche Fehlertexte für Proxy- und Direkt-Anbieter (Texte: core/messages). */

export const AI_ERROR_MESSAGES = {
  overloaded: STATE_MESSAGES.aiOverloaded,
  rateLimited: STATE_MESSAGES.rateLimited,
  offline: STATE_MESSAGES.offline,
  unauthorized: STATE_MESSAGES.aiUnavailable,
  linkBlocked: STATE_MESSAGES.aiLinkBlocked,
  unreadable: STATE_MESSAGES.aiUnreadable,
  timeout: STATE_MESSAGES.aiTimeout,
  generic: STATE_MESSAGES.aiGeneric,
} as const;

/** Client-seitiges Zeitlimit für einen KI-Aufruf (globaler Worker). */
export const AI_TIMEOUT_MS = 30000;

/** Bildet einen HTTP-Status (0 = Netzwerkfehler) auf eine deutsche Meldung ab; 422 beim Link-Import heißt: Seite gesperrt oder nicht abrufbar. */
export function friendlyAiErrorMessage(status: number, isLinkImport = false): string {
  if (status === 0) return AI_ERROR_MESSAGES.offline;
  if (status === 429) return AI_ERROR_MESSAGES.rateLimited;
  if (status === 422 && isLinkImport) return AI_ERROR_MESSAGES.linkBlocked;
  if (status === 422) return AI_ERROR_MESSAGES.unreadable;
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

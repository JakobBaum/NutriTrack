import { HttpErrorResponse } from '@angular/common/http';
import { isTimeoutError } from '../../ai/ai-errors';

export type OnlineSearchFailure = 'no-key' | 'auth' | 'quota' | 'rate-limit' | 'offline' | 'timeout' | 'server';

/** Fehler der Online-Rezeptsuche mit fertiger deutscher Meldung. */
export class OnlineSearchError extends Error {
  constructor(readonly reason: OnlineSearchFailure, message: string) {
    super(message);
    this.name = 'OnlineSearchError';
  }
}

export const ONLINE_SEARCH_MESSAGES: Readonly<Record<OnlineSearchFailure, string>> = {
  'no-key': 'Die Rezept-Suche ist nicht eingerichtet. Du kannst unter Profil › Rezept-Suche einen eigenen Schlüssel eintragen.',
  auth: 'Der Schlüssel wurde abgelehnt. Prüfe ihn unter Profil › Rezept-Suche.',
  quota: 'Das Tageslimit von spoonacular ist erreicht. Morgen geht es weiter.',
  'rate-limit': 'Zu viele Anfragen. Bitte kurz warten und erneut suchen.',
  offline: 'Keine Verbindung. Prüfe deine Internetverbindung.',
  timeout: 'Die Rezept-Suche antwortet gerade nicht. Bitte erneut versuchen.',
  server: 'spoonacular ist gerade nicht erreichbar. Bitte später erneut versuchen.',
};

/** Bildet einen HTTP-Status (0 = keine Antwort) auf einen Fehlergrund ab. */
export function failureForStatus(status: number, isOffline: boolean): OnlineSearchFailure {
  if (status === 0) return isOffline ? 'offline' : 'server';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 429) return 'rate-limit';
  return 'server';
}

const NOT_CONFIGURED_PATTERN = /nicht eingerichtet/i;

/** Der Worker meldet fehlenden Server-Key als 503 mit „nicht eingerichtet“. */
function isNotConfigured(e: HttpErrorResponse): boolean {
  if (e.status !== 503) return false;
  const message = (e.error as { error?: unknown } | null)?.error;
  return typeof message === 'string' && NOT_CONFIGURED_PATTERN.test(message);
}

function failureFor(e: unknown, isOffline: boolean): OnlineSearchFailure {
  if (isTimeoutError(e)) return 'timeout';
  if (!(e instanceof HttpErrorResponse)) return 'server';
  return isNotConfigured(e) ? 'no-key' : failureForStatus(e.status, isOffline);
}

/** Wandelt beliebige Fehler (HttpErrorResponse, OnlineSearchError, Timeout, …) in einen OnlineSearchError. */
export function toOnlineSearchError(e: unknown, isOffline: boolean): OnlineSearchError {
  if (e instanceof OnlineSearchError) return e;
  const reason = failureFor(e, isOffline);
  return new OnlineSearchError(reason, ONLINE_SEARCH_MESSAGES[reason]);
}

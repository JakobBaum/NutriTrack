import { HttpErrorResponse } from '@angular/common/http';

export type OnlineSearchFailure = 'no-key' | 'auth' | 'quota' | 'rate-limit' | 'offline' | 'server';

/** Fehler der Online-Rezeptsuche mit fertiger deutscher Meldung. */
export class OnlineSearchError extends Error {
  constructor(readonly reason: OnlineSearchFailure, message: string) {
    super(message);
    this.name = 'OnlineSearchError';
  }
}

export const ONLINE_SEARCH_MESSAGES: Readonly<Record<OnlineSearchFailure, string>> = {
  'no-key': 'Kein Schlüssel hinterlegt. Trage ihn unter Profil › Rezept-Suche ein.',
  auth: 'Der Schlüssel wurde abgelehnt. Prüfe ihn unter Profil › Rezept-Suche.',
  quota: 'Das Tageslimit von spoonacular ist erreicht. Morgen geht es weiter.',
  'rate-limit': 'Zu viele Anfragen. Bitte kurz warten und erneut suchen.',
  offline: 'Keine Verbindung. Prüfe deine Internetverbindung.',
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

/** Wandelt beliebige Fehler (HttpErrorResponse, OnlineSearchError, …) in einen OnlineSearchError. */
export function toOnlineSearchError(e: unknown, isOffline: boolean): OnlineSearchError {
  if (e instanceof OnlineSearchError) return e;
  const reason = e instanceof HttpErrorResponse ? failureForStatus(e.status, isOffline) : 'server';
  return new OnlineSearchError(reason, ONLINE_SEARCH_MESSAGES[reason]);
}

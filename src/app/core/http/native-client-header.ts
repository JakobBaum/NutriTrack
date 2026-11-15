/**
 * Kennzeichnet Aufrufe der nativen App gegenüber dem Worker. Ein von JS gesetzter Origin-Header
 * ist in WebKit verboten und wird bei fetch und bei GET-Aufrufen über den Capacitor-Proxy verworfen;
 * der Worker akzeptiert deshalb bei REQUIRE_ORIGIN diesen Header statt eines Origin.
 */
export const NATIVE_CLIENT_HEADER = 'X-NutriTrack-Client';

export const NATIVE_CLIENT_VALUE = 'ios';

/** Gehört die Ziel-URL zur Worker-Basis-URL (gleiche Adresse oder darunter, nicht nur gleiches Präfix)? */
function isWorkerUrl(url: string, workerBaseUrl: string): boolean {
  if (!url.startsWith(workerBaseUrl)) return false;
  const next = url.charAt(workerBaseUrl.length);
  return next === '' || next === '/' || next === '?' || next === '#';
}

/** Reine Entscheidung: Header nur nativ und nur für Aufrufe an den Worker. */
export function shouldMarkAsNativeClient(url: string, workerBaseUrl: string, isNative: boolean): boolean {
  return isNative && workerBaseUrl !== '' && isWorkerUrl(url, workerBaseUrl);
}

export function nativeClientHeaders(): Readonly<Record<string, string>> {
  return { [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE };
}

/** localStorage-Schlüssel für den Debug-Modus (überlebt Navigation und Reload). */
export const DEBUG_STORAGE_KEY = 'nt.debug';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function readFlag(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(storage: StorageLike | null, enabled: boolean): void {
  if (!storage) return;
  try {
    if (enabled) storage.setItem(DEBUG_STORAGE_KEY, '1');
    else storage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // Speicher gesperrt (privater Modus o. Ä.): Flag gilt nur für diese Sitzung.
  }
}

/**
 * Ermittelt, ob Entwickler-Werkzeuge (Debug-Log, Verbindungstest) sichtbar sind.
 * `?debug=1` schaltet ein und merkt sich das Flag, `?debug=0` schaltet aus.
 * Ohne Query-Parameter entscheidet das gespeicherte Flag.
 */
export function resolveDebugMode(search: string, storage: StorageLike | null): boolean {
  const param = new URLSearchParams(search).get('debug');
  if (param === '1') {
    writeFlag(storage, true);
    return true;
  }
  if (param === '0') {
    writeFlag(storage, false);
    return false;
  }
  return readFlag(storage);
}

/** Liefert `window.localStorage` oder `null`, falls der Zugriff verweigert wird. */
export function safeLocalStorage(win: Window | null): StorageLike | null {
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

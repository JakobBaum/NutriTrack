import { AiConfig } from '../core/models';

export type AiConnection = 'none' | 'server' | 'ownKey';

/** Bekannte Gemini-Modelle; leerer Wert = automatisch (App wählt). */
export const KNOWN_MODELS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Automatisch (empfohlen)' },
  { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash (schnell)' },
  { value: 'gemini-3.8-pro', label: 'gemini-3.8-pro (gründlicher)' },
];

/** Welche Verbindung tatsächlich aktiv ist (Server hat Vorrang vor eigenem Schlüssel). */
export function aiConnection(cfg: Pick<AiConfig, 'proxyUrl' | 'apiKey'>): AiConnection {
  if (cfg.proxyUrl?.trim()) return 'server';
  if (cfg.apiKey?.trim()) return 'ownKey';
  return 'none';
}

export function aiStatusLabel(connection: AiConnection): string {
  switch (connection) {
    case 'server': return 'Aktiv (KI-Server)';
    case 'ownKey': return 'Aktiv (eigener Schlüssel)';
    default: return 'Nicht verbunden';
  }
}

/** Modell-Auswahl inkl. eines bereits gespeicherten, unbekannten Modells. */
export function modelOptions(current: string | undefined): { value: string; label: string }[] {
  const known = KNOWN_MODELS.map((m) => ({ ...m }));
  const cur = current?.trim();
  return cur && !known.some((m) => m.value === cur) ? [...known, { value: cur, label: cur }] : known;
}

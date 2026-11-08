import { AiConfig } from '../core/models';
import { resolveAiRoutes } from '../core/ai/ai-route';

export type AiConnection = 'none' | 'server' | 'ownKey';

/** Bekannte Gemini-Modelle; leerer Wert = automatisch (App wählt). */
export const KNOWN_MODELS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Automatisch (empfohlen)' },
  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (schnell)' },
  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (günstig)' },
];

/** Aktiver Weg: eigener Schlüssel (Gemini direkt) vor KI-Server; sonst nicht verbunden. */
export function aiConnection(cfg: Partial<Pick<AiConfig, 'provider' | 'proxyUrl' | 'apiKey'>>): AiConnection {
  const [route] = resolveAiRoutes(cfg);
  if (route === 'ownKey') return 'ownKey';
  if (route === 'proxy') return 'server';
  return 'none';
}

export function aiStatusLabel(connection: AiConnection): string {
  switch (connection) {
    case 'ownKey': return 'Eigener Schlüssel aktiv';
    case 'server': return 'Globaler KI-Server aktiv';
    default: return 'Nicht verbunden';
  }
}

/** Modell-Auswahl inkl. eines bereits gespeicherten, unbekannten Modells. */
export function modelOptions(current: string | undefined): { value: string; label: string }[] {
  const known = KNOWN_MODELS.map((m) => ({ ...m }));
  const cur = current?.trim();
  return cur && !known.some((m) => m.value === cur) ? [...known, { value: cur, label: cur }] : known;
}

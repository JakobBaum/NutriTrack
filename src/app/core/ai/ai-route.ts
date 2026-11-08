import { AiConfig } from '../models';
import { effectiveProxyUrl } from './ai-endpoint';

/** Ein Weg, über den KI-Aufrufe laufen können. */
export type AiRoute = 'ownKey' | 'proxy';

/** Anzeigename je Weg (Debug-Log, Test-Meldungen). */
export const AI_ROUTE_LABELS: Readonly<Record<AiRoute, string>> = {
  ownKey: 'Gemini direkt (eigener Schlüssel)',
  proxy: 'KI-Server (Worker)',
};

export const NO_AI_ROUTE_MESSAGE = 'Keine KI-Verbindung eingerichtet.';

type RouteConfig = Partial<Pick<AiConfig, 'provider' | 'apiKey' | 'proxyUrl'>>;

/**
 * Nutzbare Wege in Prioritätsreihenfolge: eigener Gemini-Key (direkt) zuerst,
 * danach der globale KI-Server (Worker; eigene Adresse oder Standard aus der Umgebung).
 * Leeres Array = keine Verbindung (nur wenn auch kein Standard-Server konfiguriert ist).
 */
export function resolveAiRoutes(cfg: RouteConfig): AiRoute[] {
  const routes: AiRoute[] = [];
  if (cfg.provider === 'gemini' && cfg.apiKey?.trim()) routes.push('ownKey');
  if (effectiveProxyUrl(cfg)) routes.push('proxy');
  return routes;
}

/**
 * Führt `run` mit dem ersten Weg aus. Schlägt er fehl, wird der nächste Weg
 * versucht. Scheitern alle, wird der Fehler des PRIMÄREN Weges geworfen, weil
 * er die meiste Aussagekraft für den Nutzer hat (z. B. „Schlüssel abgelehnt“).
 */
export async function runWithFallback<T>(
  routes: readonly AiRoute[],
  run: (route: AiRoute) => Promise<T>,
  onFallback?: (failed: AiRoute, err: unknown) => void,
): Promise<T> {
  const [primary, ...fallbacks] = routes;
  if (primary === undefined) throw new Error(NO_AI_ROUTE_MESSAGE);

  try {
    return await run(primary);
  } catch (primaryError) {
    let failed: AiRoute = primary;
    let lastError: unknown = primaryError;
    for (const route of fallbacks) {
      onFallback?.(failed, lastError);
      try {
        return await run(route);
      } catch (err) {
        failed = route;
        lastError = err;
      }
    }
    throw primaryError;
  }
}

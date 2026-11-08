import { environment } from '../../../environments/environment';
import { AiConfig } from '../models';

/** Globaler KI-Server (Cloudflare-Worker) aus der Umgebung; Standard für alle Nutzer. */
export function defaultAiProxyUrl(): string {
  return environment.aiProxyUrl.trim().replace(/\/+$/, '');
}

/**
 * Effektive Adresse des KI-Servers: eigene Adresse aus den Einstellungen (falls gesetzt),
 * sonst der globale Standard. Ohne abschließenden Schrägstrich.
 */
export function effectiveProxyUrl(cfg: Partial<Pick<AiConfig, 'proxyUrl'>>): string {
  const custom = cfg.proxyUrl?.trim().replace(/\/+$/, '');
  return custom || defaultAiProxyUrl();
}

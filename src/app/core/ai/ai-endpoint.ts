import { environment } from '../../../environments/environment';

/** Globaler KI-Server (Cloudflare-Worker) aus der Umgebung; einziger Weg für alle KI-Aufrufe. */
export function defaultAiProxyUrl(): string {
  return environment.aiProxyUrl.trim().replace(/\/+$/, '');
}

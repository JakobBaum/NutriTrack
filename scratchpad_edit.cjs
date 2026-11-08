const fs=require('fs');
function edit(p,pairs){let s=fs.readFileSync(p,'utf8');for(const [a,b] of pairs){if(!s.includes(a))throw new Error(p+' missing: '+a.slice(0,50));s=s.replace(a,()=>b);}fs.writeFileSync(p,s);}
edit('core/ai/ai-route.ts',[
["import { AiConfig } from '../models';","import { AiConfig } from '../models';\nimport { effectiveProxyUrl } from './ai-endpoint';"],
["danach der KI-Server (Worker). Leeres Array = keine Verbindung.","danach der globale KI-Server (Worker; eigene Adresse oder Standard aus der Umgebung).\n * Leeres Array = keine Verbindung (nur wenn auch kein Standard-Server konfiguriert ist)."],
["if (cfg.proxyUrl?.trim()) routes.push('proxy');","if (effectiveProxyUrl(cfg)) routes.push('proxy');"],
]);
edit('core/ai/ai-errors.ts',[
["  generic:","  timeout: 'Die KI antwortet gerade nicht - bitte erneut versuchen.',\n  generic:"],
["/** Bildet","/** Client-seitiges Zeitlimit für einen KI-Aufruf (Proxy und Gemini direkt). */\nexport const AI_TIMEOUT_MS = 30000;\n\n/** Bildet"],
]);
fs.appendFileSync('core/ai/ai-errors.ts',`
/** True bei einem rxjs-\`timeout\`-Fehler (TimeoutError). */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'TimeoutError';
}

/** Wandelt einen Zeitüberschreitungs-Fehler in die deutsche Meldung um; andere Fehler bleiben. */
export function mapTimeoutError(err: unknown): unknown {
  return isTimeoutError(err) ? new Error(AI_ERROR_MESSAGES.timeout) : err;
}
`);
edit('core/ai/proxy-ai-provider.ts',[
["import { firstValueFrom } from 'rxjs';","import { firstValueFrom, timeout } from 'rxjs';"],
["import { friendlyAiErrorMessage } from './ai-errors';","import { AI_TIMEOUT_MS, friendlyAiErrorMessage, mapTimeoutError } from './ai-errors';\nimport { effectiveProxyUrl } from './ai-endpoint';"],
["    const url = this.settings.ai().proxyUrl?.trim();\n    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');\n    this.log.info","    const url = effectiveProxyUrl(this.settings.ai());\n    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');\n    this.log.info"],
["{ headers: { 'content-type': 'application/json' } }),\n      );\n      this.log.success","{ headers: { 'content-type': 'application/json' } })\n          .pipe(timeout(AI_TIMEOUT_MS)),\n      );\n      this.log.success"],
["      this.log.error(`✗ ${fn}: ${(err as Error).message}`);\n      throw err;","      this.log.error(`✗ ${fn}: ${(err as Error).message}`);\n      throw mapTimeoutError(err);"],
["    const url = this.settings.ai().proxyUrl?.trim();\n    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');\n    try {","    const url = effectiveProxyUrl(this.settings.ai());\n    if (!url) throw new Error('Keine KI-Proxy-URL konfiguriert.');\n    try {"],
["{ headers: { 'content-type': 'application/json' } }),\n      );\n    } catch (err: unknown) {\n      if (isUnknownFunctionResponse(err)) return;","{ headers: { 'content-type': 'application/json' } })\n          .pipe(timeout(AI_TIMEOUT_MS)),\n      );\n    } catch (err: unknown) {\n      if (isUnknownFunctionResponse(err)) return;\n      if (isTimeoutError(err)) throw new Error(AI_ERROR_MESSAGES.timeout);"],
["import { AI_TIMEOUT_MS, friendlyAiErrorMessage, mapTimeoutError }","import { AI_ERROR_MESSAGES, AI_TIMEOUT_MS, friendlyAiErrorMessage, isTimeoutError, mapTimeoutError }"],
["Alle Nutzer teilen sich EINEN serverseitigen Gemini-Key; die App sendet\n * nur `{ fn, payload }` an die konfigurierte Proxy-URL","Alle Nutzer teilen sich EINEN serverseitigen Gemini-Key; die App sendet\n * nur `{ fn, payload }` an die effektive Proxy-URL (eigene Adresse oder Standard)"],
]);
edit('core/ai/gemini-ai-provider.ts',[
["import { firstValueFrom } from 'rxjs';","import { firstValueFrom, timeout } from 'rxjs';"],
["import { friendlyAiErrorMessage } from './ai-errors';","import { AI_ERROR_MESSAGES, AI_TIMEOUT_MS, friendlyAiErrorMessage, isTimeoutError, mapTimeoutError } from './ai-errors';"],
["// Ein Modell für alles — Gemini 3.8 Flash ist multimodal (Text + Vision).\nconst MODEL_DEFAULT = 'gemini-3.8-flash';","// Ein Modell für alles — Gemini 3.6 Flash ist multimodal (Text + Vision).\nconst MODEL_DEFAULT = 'gemini-3.6-flash';"],
["this.http.get(`${base}?pageSize=1`, { headers: { 'x-goog-api-key': cfg.apiKey.trim() } }),","this.http.get(`${base}?pageSize=1`, { headers: { 'x-goog-api-key': cfg.apiKey.trim() } })\n          .pipe(timeout(AI_TIMEOUT_MS)),"],
["      const status = e instanceof HttpErrorResponse ? e.status : 0;\n      // Google","      if (isTimeoutError(e)) throw new Error(AI_ERROR_MESSAGES.timeout);\n      const status = e instanceof HttpErrorResponse ? e.status : 0;\n      // Google"],
["this.http.post<GeminiResponse>(url, body, { headers }));","this.http.post<GeminiResponse>(url, body, { headers }).pipe(timeout(AI_TIMEOUT_MS)));"],
["    throw lastErr;\n  }","    throw mapTimeoutError(lastErr);\n  }"],
]);
edit('core/food/openfoodfacts.provider.ts',[
["    const proxy = this.settings.ai().proxyUrl?.trim();\n    return proxy ? `${proxy.replace(/\/+$/, '')}/off-search` : SEARCH_URL_DEFAULT;","    const proxy = this.settings.ai().proxyUrl?.trim();\n    return proxy ? `${proxy.replace(/\/+$/, '')}/off-search` : SEARCH_URL_DEFAULT;"],
]);
edit('settings/ai-status.ts',[
["  { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash (schnell)' },\n  { value: 'gemini-3.8-pro', label: 'gemini-3.8-pro (gründlicher)' },","  { value: 'gemini-3.6-flash', label: 'gemini-3.6-flash (schnell)' },\n  { value: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (günstig)' },"],
["case 'ownKey': return 'Aktiv: eigener Schlüssel (Gemini direkt)';\n    case 'server': return 'Aktiv: KI-Server (Worker)';","case 'ownKey': return 'Eigener Schlüssel aktiv';\n    case 'server': return 'Globaler KI-Server aktiv';"],
]);

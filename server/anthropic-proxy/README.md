# NutriTrack KI-Proxy

Ein schlanker serverless Endpoint, damit **alle App-Nutzer denselben, internen**
Anthropic-API-Key verwenden. Der Key liegt **nur serverseitig** (Umgebungsvariable),
nie in der App. System-Prompts sind serverseitig fix hinterlegt (`worker.mjs`).

## Warum ein Proxy?

Ein API-Key darf **niemals** in einen Client (Browser/Mobile-App) eingebettet werden —
er ließe sich auslesen und das Konto leerräumen. Der Proxy hält den Key geheim und
teilt ihn für alle Nutzer über **einen** Endpoint.

## Request-Format

`POST /` mit JSON:

```json
{ "fn": "computeTargets", "payload": { ...} }
```

`fn` ∈ `computeTargets` | `generateShoppingList` | `recognizeLabel` | `suggestFastfood`.
Antwort: bereits auf das App-Schema gemapptes JSON.

## Deploy — Cloudflare Workers (empfohlen, kostenlos)

```bash
cd server/anthropic-proxy
npm i -g wrangler            # einmalig
wrangler secret put ANTHROPIC_API_KEY   # Key sicher hinterlegen (nicht im Code!)
wrangler deploy             # liefert die URL, z.B. https://nutritrack-ai.<account>.workers.dev
```

`wrangler.toml` (Beispiel):

```toml
name = "nutritrack-ai"
main = "worker.mjs"
compatibility_date = "2026-01-01"
# optional: ALLOWED_ORIGIN per [vars] auf die eigene Domain beschränken
```

## Deploy — Vercel (Edge Function)

`worker.mjs` exportiert `{ fetch }`. In `api/ai.mjs`:

```js
export { default as default } from '../server/anthropic-proxy/worker.mjs';
export const config = { runtime: 'edge' };
```

Env-Var `ANTHROPIC_API_KEY` im Vercel-Projekt setzen.

## Deploy — Node (Express), falls kein Serverless

```js
import { createServer } from 'http';
import worker from './worker.mjs';
createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const request = new Request('http://local' + req.url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
  const r = await worker.fetch(request, process.env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text());
}).listen(8787);
```

## App-Anbindung

In der App unter **Profil → Einstellungen → KI** nur die **Proxy-URL** eintragen
(kein Key nötig). Ist eine Proxy-URL gesetzt, nutzt die App automatisch den Proxy
(`ProxyAiProvider`); sonst Fallback auf den optionalen eigenen Key oder den Mock.

## Sicherheit / Betrieb

- `ANTHROPIC_API_KEY` ausschließlich als Server-Secret.
- Optional `ALLOWED_ORIGIN` auf die App-Domain setzen (CORS).
- Empfohlen: einfache Rate-Limits / Turnstile vor dem Endpoint, da öffentlich.

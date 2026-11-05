# Security-Audit NutriTrack — 2026-11-04

**Methodik:** Anthropic [`claude-code-security-review`](https://github.com/anthropics/claude-code-security-review)
(offizielles Repo, ~6,7k Sterne): Kontext → Vergleich → Datenfluss, nur Funde mit hoher Konfidenz,
danach Filter gegen False Positives. Ergänzt um zwei Skills aus
[`trailofbits/skills`](https://github.com/trailofbits/skills) (~8k Sterne): `insecure-defaults` und
`supply-chain-risk-auditor`.

**Scope:** `worker.js` (Cloudflare-Worker = einzige Server-Komponente), Angular/Ionic-Client (`src/`),
Abhängigkeiten (`npm audit`), Build-/Deploy-Konfiguration.

## Behobene Funde

| # | Schwere | Fund | Ort | Fix |
|---|---|---|---|---|
| 1 | HOCH | **Offener KI-Proxy ohne Missbrauchsschutz.** Jede Website und jedes Skript konnte `POST /` mit beliebig großen Payloads aufrufen und so Kosten auf dem Gemini-Key erzeugen (CORS `*`, keine Limits, keine Validierung). | `worker.js` | Origin-Allowlist (`ALLOWED_ORIGINS`), Rate-Limit-Binding `AI_LIMITER` (20/min/IP), Body-Limit 10 MB, Schema-Validierung je Funktion, 503 ohne Key |
| 2 | MITTEL | **SSRF / offener Fetch-Proxy beim Rezept-Import.** `importRecipe` holte jede URL (Host und Protokoll vom Angreifer gewählt), folgte Weiterleitungen und las unbegrenzt viel. | `worker.js` `importRecipe` | Nur öffentliche http(s)-Hosts. Keine IP-Literale aus privaten Netzen und kein localhost. Jede Weiterleitung wird neu geprüft, Content-Type wird geprüft, 1-MB-Cap, Timeout |
| 3 | NIEDRIG | API-Key als `?key=` in der URL, dadurch in Logs und Traces sichtbar | `worker.js` `gemini()` | Header `x-goog-api-key` |
| 4 | NIEDRIG | `/off-search` reichte alle Query-Parameter an OpenFoodFacts durch (offener Proxy) | `worker.js` | Parameter-Allowlist, `page_size` ≤ 50, `q` ≤ 200 Zeichen |
| 5 | NIEDRIG | Keine Content-Security-Policy (Defense in Depth gegen XSS) | `angular.json` | `security.autoCsp` (hash-basiert, `strict-dynamic`), in WebKit/Firefox/Chromium getestet |
| 6 | KRITISCH (dev) | `vitest` < 4.1.12 (kritische Advisory) | `package.json` | auf 4.1.12 gehoben |

Alle Fixes sind mit Tests abgedeckt: `npm run test:worker` (20 Tests) und `ng test` (67 Tests).

## Offene Punkte (deine Aktion nötig)

1. **Google-Cloud-Key absichern (wichtigster Kostenschutz).** Der Origin-Check hält nur Browser auf.
   Skripte können den Header fälschen, deshalb begrenzt das Rate-Limit nur pro IP. In der Google Cloud Console:
   - den Key auf *Generative Language API* beschränken,
   - eine Tagesquote setzen (z. B. 500 Requests/Tag),
   - einen Budget-Alarm anlegen.
2. **Angular-Update nach Cooldown.** `@angular/build`/`@angular/cli` 22.2.5 und `@angular/*` 22.2.4 beheben
   kritische/hohe Advisories in Build-Tools (piscina, vite) und einen SSR-DoS im Router.
   Letzterer betrifft NutriTrack nicht, weil kein SSR läuft. Die Versionen sind erst ~1 Woche alt.
   Nach der Supply-Chain-Faustregel ab ~12.11. aktualisieren:
   `npm i @angular/{common,compiler,core,forms,platform-browser,platform-browser-dynamic,router}@22.2.4 && npm i -D @angular/{build,cli}@22.2.5 @angular/{compiler-cli,language-service}@22.2.4`
3. **Rate-Limit-Binding prüfen.** Nach dem nächsten Worker-Deploy unter Cloudflare → Worker → Settings →
   Bindings nachsehen, ob `AI_LIMITER` existiert. Fehlt es (ältere Wrangler-Version im Build), läuft der
   Worker ohne Limit weiter.
4. **Eigener API-Key im Client** (Modus „Gemini direkt“): liegt im Klartext in `localStorage`. Für dich
   persönlich ok. Für andere Nutzer nur den Proxy-Modus anbieten.

## Geprüft, kein Fund

- **XSS:** keine `innerHTML`, kein `bypassSecurityTrust*`, kein `eval`. Angular escaped alle Bindings.
- **Secrets im Repo/Verlauf:** keine Keys (`AIza…`) in Dateien oder in der Git-Historie. `.env*` und
  `environment.secret.ts` stehen in `.gitignore`.
- **Externe Links:** `target="_blank"` mit `rel="noopener"`.
- **Gesundheitsdaten:** Gewicht, Größe und Alter werden lokal berechnet (`NutritionCalcService`). Der
  KI-Pfad `computeTargets` wird von der UI nicht aufgerufen, die Daten verlassen das Gerät also nicht.

# KI-Worker (Cloudflare)

## Was der Worker tut
`worker.js` ist der globale KI-Server von NutriTrack. Alle Nutzer teilen sich EINEN Gemini-Schluessel, der nur als Secret im Worker liegt. Die App sendet `{ fn, payload }` per POST auf `/`; der Worker prueft die Eingabe, ruft Gemini auf und liefert das fertige Ergebnis.

- `POST /` - KI-Funktionen (Etikett, Rezept-Import, Einkaufsliste, Fastfood). Der Tagesbedarf wird nur noch lokal in der App berechnet (`computeTargets` wurde entfernt).
- `GET /off-search` - OpenFoodFacts-Suche (CORS-Proxy)
- `GET /recipes/complexSearch` - spoonacular-Rezeptsuche (siehe unten)
- `GET /health` - Status: `{ ok, hasKey, hasRecipeKey, hasRateLimiter, hasDailyCap, model, fallbackModel, warning? }` (nie der Schluessel selbst). `warning` erscheint, solange kein Tagesdeckel aktiv ist.

Modelle: Hauptmodell `gemini-3.6-flash`, Fallback `gemini-3.5-flash-lite`. Ist ein Modell unbekannt (404 oder 400 "model"), wechselt der Worker sofort aufs Fallback. Zeitbudget: 25 s gesamt, 12 s je Versuch, 1 Wiederholung. Die App bricht nach 30 s mit einer klaren Meldung ab.

Aenderbar ohne Code (Variablen in `wrangler.toml` oder Dashboard): `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `ALLOWED_ORIGINS`, `DAILY_AI_CAP`.

## Kostenschutz und Missbrauch
- **Rate-Limit je IP** (`AI_LIMITER`, 20/min) fuer KI und Rezept-Suche; `/off-search` nutzt `OFF_LIMITER` (optional, sonst `AI_LIMITER`) und zaehlt nur Cache-Misses.
- **Globaler Tagesdeckel** (`DAILY_KV` + `DAILY_AI_CAP`, Standard 2000 KI-Aufrufe pro UTC-Tag): mit Binding hartes 429 bei Erreichen; ohne Binding laeuft der Worker ohne Deckel weiter (`/health`: `hasDailyCap: false` + `warning`). KV ist nicht atomar, der Deckel kann bei gleichzeitigen Anfragen knapp ueberschritten werden. Einrichten:
  1. `npx wrangler kv namespace create DAILY_KV` (gibt eine `id` aus)
  2. In `wrangler.toml` den Block `[[kv_namespaces]]` einkommentieren und die `id` eintragen; optional `[vars] DAILY_AI_CAP`
  3. `npx wrangler deploy`, dann `/health` pruefen (`hasDailyCap: true`)
- **Limits**: Body max. 5 MB (hart gelesen, auch ohne Content-Length), Foto max. 4 Mio. Base64-Zeichen (~3 MB), Freitexte gekuerzt, `maxOutputTokens` je Funktion (Etikett 1024, Liste 4096, Fastfood 2048, Import 8192), `temperature 0`.
- **SSRF** (Rezept-Import): nur http/https auf Port 80/443, keine IP-Literale aus privaten Netzen, kein `localhost` (auch `localhost.`), keine IPv6-Literale; Weiterleitungen werden erneut geprueft.
- **Fehlertexte**: Der Client bekommt nur generische Meldungen; Details stehen im Worker-Log (`npx wrangler tail`). Blockierte, leere oder nicht lesbare KI-Antworten kommen als 422 (nicht als "ueberlastet").

## Deploy
Im Projektordner:

```
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Beim zweiten Befehl den Gemini-Schluessel einfuegen (Google AI Studio). Die App-Adresse steht in `src/environments/environment*.ts` (`aiProxyUrl`).

## Rezept-Suche (spoonacular)
Die Online-Rezeptsuche laeuft ebenfalls global ueber den Worker. Der spoonacular-Schluessel liegt nur als Secret `SPOONACULAR_API_KEY` im Worker; die App braucht keinen eigenen Schluessel. Ein eigener Schluessel unter Profil > Rezept-Suche > Erweitert bleibt optional und hat Vorrang (direkter Aufruf von api.spoonacular.com).

Einrichten:
1. Schluessel holen: https://spoonacular.com/food-api/console#Dashboard
2. `npx wrangler secret put SPOONACULAR_API_KEY` (Schluessel einfuegen)
3. `npx wrangler deploy`

- Route: `GET /recipes/complexSearch` - nur die Parameter der App-Suche werden weitergereicht (`query`, `number` max. 20, `offset`, `maxCalories`, `maxReadyTime`, `diet`, `addRecipeNutrition`, `addRecipeInstructions`, `fillIngredients`, `instructionsRequired`); ein mitgeschickter `apiKey` wird verworfen. Der Header `X-Api-Quota-Left` wird an die App durchgereicht. Erfolgreiche Antworten werden 6 h im Worker-Cache gehalten (gleiche Suche = kein weiterer Quota-Verbrauch; der Quota-Wert ist dann der des Cache-Zeitpunkts).
- Status: `GET /health` liefert zusaetzlich `hasRecipeKey` (true/false, nie der Wert).
- Fehler: ohne Secret antwortet die Route mit 503 "Rezept-Suche nicht eingerichtet."; ein vom Anbieter abgelehnter Server-Schluessel wird als 502 gemeldet; Zeitlimit 12 s (504). Ist `AI_LIMITER` gebunden, gilt dasselbe Rate-Limit wie bei der KI.
- Quota: Der kostenlose Plan hat ca. 50 Punkte pro Tag, geteilt fuer alle Nutzer des globalen Servers. Ist das Limit erreicht (402), zeigt die App "Tageslimit erreicht"; einzelne Nutzer koennen einen eigenen Schluessel eintragen.

## Uebersetzung (translateRecipe, translateSearchQuery)
Spoonacular liefert nur Englisch. Die App uebersetzt Rezepte in die App-Sprache (`appLanguage`, derzeit `de`).
- `translateRecipe` `{ texts: { title, ingredients[], steps[] }, lang }`: Gemini mit festem JSON-Schema, Temperatur 0. Zutatennamen werden zur Einkaufs-Grundform normalisiert (z. B. "pork shoulder" -> "Schweineschulter", "chopped fresh rosemary" -> "Rosmarin, frisch"). Der Worker gleicht die Listenlaengen serverseitig an.
- `translateSearchQuery` `{ query, lang }`: deutscher Suchbegriff -> englischer Suchbegriff.
- Beide nutzen Tageszaehler und Rate-Limit wie alle KI-Funktionen. Ohne neuen Worker faellt die App ehrlich auf das Woerterbuch zurueck ("nicht uebersetzt").
- Ergebnisse werden lokal zwischengespeichert (`nutritrack:translations`, nicht im Backup); nichts wird doppelt uebersetzt.

## Testen
```
curl https://nutritrack.baumgartner-jakob12.workers.dev/health
```
Erwartet: `{"ok":true,"hasKey":true,"hasRecipeKey":true,"hasRateLimiter":true,"hasDailyCap":true,"model":"gemini-3.6-flash","fallbackModel":"gemini-3.5-flash-lite"}` (ohne KV-Binding: `hasDailyCap:false` plus `warning`).

Lokale Tests: `node --test worker.test.mjs`

## Fehlerbehebung
- `hasKey: false` - Secret fehlt: `npx wrangler secret put GEMINI_API_KEY`, danach `npx wrangler deploy`.
- App meldet "KI-Zugang abgelehnt" - Schluessel ungueltig oder gesperrt; Secret neu setzen.
- "Die KI ist gerade ueberlastet" (503) - Gemini ist ausgelastet; spaeter erneut versuchen.
- "Die KI antwortet gerade nicht" - Zeitlimit; erneut versuchen, ggf. `/health` pruefen.
- Browser meldet CORS-Fehler - Origin der App fehlt in `ALLOWED_ORIGINS` bzw. `DEFAULT_ORIGINS` in `worker.js`.
- 429 "Tageslimit" - globaler Deckel `DAILY_AI_CAP` erreicht; setzt sich um 00:00 UTC zurueck oder Wert erhoehen.
- Die KI-Verbindung ist nur global: Nutzer koennen keinen eigenen Gemini-Schluessel und keine eigene Server-Adresse eintragen. Profil > KI-Verbindung zeigt nur den Status (erreichbar / nicht erreichbar). Alte lokal gespeicherte Werte (`ai-config`) werden beim Start geloescht und nie ins Backup exportiert oder daraus importiert. Ohne konfigurierte `aiProxyUrl` nutzt die App den Mock. Ausnahme: der eigene spoonacular-Schluessel (Rezept-Suche) bleibt moeglich.

# KI-Worker (Cloudflare)

## Was der Worker tut
`worker.js` ist der globale KI-Server von NutriTrack. Alle Nutzer teilen sich EINEN Gemini-Schluessel, der nur als Secret im Worker liegt. Die App sendet `{ fn, payload }` per POST auf `/`; der Worker prueft die Eingabe, ruft Gemini auf und liefert das fertige Ergebnis.

- `POST /` - KI-Funktionen (Etikett, Rezept-Import, Einkaufsliste, Fastfood, Tagesbedarf)
- `GET /off-search` - OpenFoodFacts-Suche (CORS-Proxy)
- `GET /recipes/complexSearch` - spoonacular-Rezeptsuche (siehe unten)
- `GET /health` - Status: `{ ok, hasKey, hasRecipeKey, model, fallbackModel }` (nie der Schluessel selbst)

Modelle: Hauptmodell `gemini-3.6-flash`, Fallback `gemini-3.5-flash-lite`. Ist ein Modell unbekannt (404 oder 400 "model"), wechselt der Worker sofort aufs Fallback. Zeitbudget: 25 s gesamt, 12 s je Versuch, 1 Wiederholung. Die App bricht nach 30 s mit einer klaren Meldung ab.

Aenderbar ohne Code (Variablen in `wrangler.toml` oder Dashboard): `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `ALLOWED_ORIGINS`.

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

- Route: `GET /recipes/complexSearch` - nur die Parameter der App-Suche werden weitergereicht (`query`, `number` max. 20, `offset`, `maxCalories`, `maxReadyTime`, `diet`, `addRecipeNutrition`, `addRecipeInstructions`, `fillIngredients`, `instructionsRequired`); ein mitgeschickter `apiKey` wird verworfen. Der Header `X-Api-Quota-Left` wird an die App durchgereicht.
- Status: `GET /health` liefert zusaetzlich `hasRecipeKey` (true/false, nie der Wert).
- Fehler: ohne Secret antwortet die Route mit 503 "Rezept-Suche nicht eingerichtet."; ein vom Anbieter abgelehnter Server-Schluessel wird als 502 gemeldet; Zeitlimit 12 s (504). Ist `AI_LIMITER` gebunden, gilt dasselbe Rate-Limit wie bei der KI.
- Quota: Der kostenlose Plan hat ca. 50 Punkte pro Tag, geteilt fuer alle Nutzer des globalen Servers. Ist das Limit erreicht (402), zeigt die App "Tageslimit erreicht"; einzelne Nutzer koennen einen eigenen Schluessel eintragen.

## Testen
```
curl https://nutritrack.baumgartner-jakob12.workers.dev/health
```
Erwartet: `{"ok":true,"hasKey":true,"hasRecipeKey":true,"model":"gemini-3.6-flash","fallbackModel":"gemini-3.5-flash-lite"}`

Lokale Tests: `node --test worker.test.mjs`

## Fehlerbehebung
- `hasKey: false` - Secret fehlt: `npx wrangler secret put GEMINI_API_KEY`, danach `npx wrangler deploy`.
- App meldet "KI-Zugang abgelehnt" - Schluessel ungueltig oder gesperrt; Secret neu setzen.
- "Die KI ist gerade ueberlastet" (503) - Gemini ist ausgelastet; spaeter erneut versuchen.
- "Die KI antwortet gerade nicht" - Zeitlimit; erneut versuchen, ggf. `/health` pruefen.
- Browser meldet CORS-Fehler - Origin der App fehlt in `ALLOWED_ORIGINS` bzw. `DEFAULT_ORIGINS` in `worker.js`.
- Einzelne Nutzer koennen unter Profil > KI-Verbindung > Erweitert einen eigenen Schluessel oder Server eintragen.

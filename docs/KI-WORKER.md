# KI-Worker (Cloudflare)

## Was der Worker tut
`worker.js` ist der globale KI-Server von NutriTrack. Alle Nutzer teilen sich EINEN Gemini-Schluessel, der nur als Secret im Worker liegt. Die App sendet `{ fn, payload }` per POST auf `/`; der Worker prueft die Eingabe, ruft Gemini auf und liefert das fertige Ergebnis.

- `POST /` - KI-Funktionen (Etikett, Rezept-Import, Einkaufsliste, Fastfood, Tagesbedarf)
- `GET /off-search` - OpenFoodFacts-Suche (CORS-Proxy)
- `GET /health` - Status: `{ ok, hasKey, model, fallbackModel }` (nie der Schluessel selbst)

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

## Testen
```
curl https://nutritrack.baumgartner-jakob12.workers.dev/health
```
Erwartet: `{"ok":true,"hasKey":true,"model":"gemini-3.6-flash","fallbackModel":"gemini-3.5-flash-lite"}`

Lokale Tests: `node --test worker.test.mjs`

## Fehlerbehebung
- `hasKey: false` - Secret fehlt: `npx wrangler secret put GEMINI_API_KEY`, danach `npx wrangler deploy`.
- App meldet "KI-Zugang abgelehnt" - Schluessel ungueltig oder gesperrt; Secret neu setzen.
- "Die KI ist gerade ueberlastet" (503) - Gemini ist ausgelastet; spaeter erneut versuchen.
- "Die KI antwortet gerade nicht" - Zeitlimit; erneut versuchen, ggf. `/health` pruefen.
- Browser meldet CORS-Fehler - Origin der App fehlt in `ALLOWED_ORIGINS` bzw. `DEFAULT_ORIGINS` in `worker.js`.
- Einzelne Nutzer koennen unter Profil > KI-Verbindung > Erweitert einen eigenen Schluessel oder Server eintragen.

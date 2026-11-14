# Code-Review 3 (Logik: TypeScript, worker.js, index.html/CSP, Konfiguration)

Stand 2026-11-14. Nur gelesen, nichts gebaut oder getestet. Layout-Dateien (SCSS, Templates) ausgenommen, ausser wo ein Befund daran haengt.

## Zusammenfassung

| Grad | Anzahl |
|------|--------|
| KRITISCH | 0 |
| HOCH | 1 |
| MITTEL | 18 Zeilen (16 verschiedene; 8.1 = 7.4, 8.6 = 7.3) |
| NIEDRIG | 27 Zeilen |

Keine Secrets im Repo gefunden (Treffer fuer `apiKey=` sind nur minifizierte, nicht versionierte Build-Kopien unter android/ios public und ein Worker-Test). `android/.../public` und `ios/.../public` sind per .gitignore ausgeschlossen, `git ls-files` liefert 0 Dateien dort. Der Worker prueft Payloads, Body-Groesse, SSRF und Origin sauber; alle Worker-fetch haben ein Timeout.

## 1. Dateien ueber 400 Zeilen (ohne Specs, ohne SCSS)

| Nr | Grad | Datei | Befund | Vorschlag |
|----|------|-------|--------|-----------|
| 1.1 | MITTEL | worker.js (940) | Routing, CORS, Rate-Limit, SSRF, Gemini-Client, 6 KI-Funktionen in einer Datei | Aufteilen in `ai/gemini.js`, `ssrf.js`, `validate.js`, `routes/*.js` (Worker-Module sind mit wrangler moeglich) |
| 1.2 | MITTEL | src/app/diary/add-entry-sheet/add-entry-sheet.component.ts (679) | Quellen, Formular, Speichern, Favoriten in einer Klasse | Quellen-Logik (Scan/Suche/Rezept) und Speichern in `add-entry-logic` verschieben, das dort schon teilweise liegt |
| 1.3 | MITTEL | src/app/recipes/recipes.page.ts (642) | Liste, Formular, Import (Text/Foto/Link), Detail | Import-Fluss (ab Zeile ~205) in eigenen Service/Sheet auslagern |
| 1.4 | MITTEL | src/app/shopping/shopping.page.ts (608) | Generator, Wochenplan, Liste, Teilen, Loeschen | Generator-Sheet und Teilen-Logik (440-470) auslagern |
| 1.5 | NIEDRIG | src/app/diary/diary.page.ts (497) | knapp ueber Grenze | bei naechster Aenderung Sheet-Handler auslagern |
| 1.6 | NIEDRIG | src/app/recipes/recipes.page.html (492), shopping.page.html (405) | Templates | Teilkomponenten je Ansicht |

Specs ueber 400 Zeilen: keine (groesste shopping.page.spec.ts 372).

## 2. Duplikate

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 2.1 | MITTEL | server/gemini-proxy/worker.mjs (213) vs worker.js | Veralteter Proxy-Entwurf mit offenem CORS und altem Modellnamen (`gemini-3.8-flash`), nur per README als veraltet markiert | Ordner loeschen (Git-Historie reicht) |
| 2.2 | NIEDRIG | worker.js:379-403 und 582-603 | Zwei Varianten "Body/Seite mit Byte-Limit lesen" | eine Funktion `readCapped(stream, max, {fail})` |
| 2.3 | NIEDRIG | worker.js:257 vs 331-348 | Zwei Timeout-Muster (`AbortSignal.timeout` vs. AbortController+Timer) | ueberall `AbortSignal.timeout` (AbortError-Name beachten, Zeile 344) |
| 2.4 | NIEDRIG | food-errors.ts:26, recipes.page.ts:443, week-plan.service.ts:78 und 131, spoonacular.provider.ts:69 | `navigator.onLine === false` fuenfmal | `isOffline()` aus food-errors.ts nutzen |
| 2.5 | NIEDRIG | recipes.page.ts:~250-260, food-sources.component.ts:178-187 | `fileToBase64` doppelt | nach `core/scan/label-image.ts` verschieben |
| 2.6 | NIEDRIG | backup.service.ts:142-157, shopping.page.ts:440-470 | Share-API mit AbortError und Fallback zweimal | gemeinsamer `shareOrFallback()` |
| 2.7 | NIEDRIG | worker.js:64-76 vs spoonacular.query.ts | Parameter-Whitelist gespiegelt (im Code vermerkt) | Test, der beide Listen vergleicht |

## 3. Fehlerbehandlung

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 3.1 | MITTEL | storage.service.ts:178-189, week via backup.service.ts:114-120 | `clearAll` schluckt Fehler (nur console.error), `completeReset` meldet trotzdem Erfolg, Settings zeigt "Alle Daten wurden zurueckgesetzt" | `clearAll(): boolean` zurueckgeben, bei false Fehlertext zeigen |
| 3.2 | MITTEL | week-plan-cards.component.ts:37 und 45 | `void service.ensureTranslated()` und `retryTranslation()`: Rejection (z. B. aus Store/Shopping) ist unbehandelt, kein Fehlerhinweis | `.catch` mit `error.set(...)` |
| 3.3 | NIEDRIG | settings.page.ts:293, 302, 313 | Diagnose-fetch ohne Timeout (nur `?debug=1`) | `AbortSignal.timeout(10000)` |
| 3.4 | NIEDRIG | worker.js:617 | `new URL(location, current)` wirft bei kaputtem Location-Header TypeError, Client sieht 500 statt 422 | try/catch, ClientError(422) |
| 3.5 | NIEDRIG | add-entry-sheet.component.ts:623-626, open-prices.provider.ts:47 | Preis-Hinweis schweigt bei Fehler (gewollt, best effort) | ok, nur dokumentiert |
| 3.6 | NIEDRIG | storage.service.ts:362-368 | Scheitert `restoreRaw` nach fehlgeschlagenem Import, steht trotzdem "Daten unveraendert" (settings.page.ts:229) | `restoreRaw` Ergebnis zurueckgeben, Text anpassen |

Leere catch-Bloecke mit Folgehandlung (Fallback, Meldung) sind in label-scan.ts:77, recipe-translate.ts:103/127, barcode-scanner.component.ts:101, backup.service.ts:63 ok. Fire-and-forget `.catch(() => undefined)` nur beim Terminieren von Ressourcen (idle-resource.ts:32/51), unkritisch.

## 4. Rohe fetch() ohne Timeout

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 4.1 | NIEDRIG | settings.page.ts:293, 302, 313 | siehe 3.3 | siehe 3.3 |

Worker: alle fetch mit Timeout (worker.js:255, 331-336, 610-614, 675-680). App: alle Netzaufrufe laufen ueber HttpClient mit rxjs `timeout` (proxy-ai-provider.ts:45/98, openfoodfacts.provider.ts:99/129, open-prices.provider.ts:45, spoonacular.provider.ts:63). Hinweis: Capacitor patcht fetch nativ (capacitor.config.ts), Timeout bleibt trotzdem noetig.

## 5. Fehlende Tests

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 5.1 | MITTEL | worker.js:606-628 | `fetchPublicPage`: Redirect auf private Ziele ist ungetestet (Tests decken nur Start-URLs ab, worker.test.mjs:283-285). Kritischer SSRF-Pfad | Test: 302 auf http://169.254.169.254/ und 4 Weiterleitungen |
| 5.2 | MITTEL | week-plan.service.ts:166-170 | Kein Test fuer Entfernen/Neuerstellen waehrend Nachuebersetzung (siehe H1) | Race-Test in week-plan.retry.spec.ts |
| 5.3 | MITTEL | settings.page, diary.page, recipes.page, dashboard.page, fastfood-sheet, online-search.component, profile-sheet | Kein Unit-Spec (Treffer in Specs: 0); Abdeckung nur durch E2E | Logik in reine Funktionen/Services ziehen und dort testen; fuer fastfood-sheet Test auf veraltete Antwort (7.4) |
| 5.4 | NIEDRIG | profile.store.ts, week-plan.store.ts (Laden), translation-cache.ts | Laden kaputter Daten ungetestet (kein Sanitizing, siehe 6.6) | Tests mit Muellwerten |

Services/Stores ohne eigenen Spec, aber ueber andere Specs abgedeckt: diary.store, custom-food.store, profile.store (nur indirekt), camera/barcode-scanner.service. Coverage wurde nicht gemessen.

## 6. Sicherheit

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 6.1 | MITTEL | worker.js:320-349, 328 | Rezept-Route nutzt nur Rate-Limit (20/min/IP, geteilt mit KI), keinen Tagesdeckel. Cache-Key enthaelt alle erlaubten Parameter, Varianten umgehen den Cache. Mit mehreren IPs laesst sich das spoonacular-Tageskontingent leeren (Rezeptsuche fuer alle aus). Kein Kostenrisiko, aber Verfuegbarkeit | Eigenen Tageszaehler (DAILY_KV, Schluessel `recipes:`) und `RECIPE_LIMITER` |
| 6.2 | MITTEL | proxy-ai-provider.ts:61-70, shopping.store.ts:181-189, worker.js:804 | KI-Antworten fuer Einkaufsliste/Etikett/Fastfood werden weder im Worker (kein responseSchema, anders als Uebersetzung) noch in der App geprueft. `result.items` undefined fuehrt zu TypeError, dessen Text direkt angezeigt wird (shopping.page.ts:~380). Import und Uebersetzung sind normalisiert (recipe-import-normalize.ts) | `normalizeShoppingPlan` analog `normalizeRecipeImport`; responseSchema im Worker |
| 6.3 | NIEDRIG | proxy-ai-provider.ts:64-66, food-sources.component.ts:152-153 | `res.facts` ungeprueft emittiert. Wirkung gering: Eintrag laeuft ueber Formular (Nutzer sieht Werte) und `diary.add` bereinigt Facts (diary.store.ts:130) | Normalizer wie 6.2 |
| 6.4 | MITTEL | profile.store.ts:18-20, shopping.store.ts:153-155, week-plan.store.ts:13-15, backup.ts:21-22 und 139-143 | Profil, Einkaufsliste und Wochenplan werden beim Laden nicht bereinigt; Backup-Import prueft bei `profile`/`shopping` nur "ist Objekt". Ein handbearbeitetes oder fremdes Backup (z. B. `shopping: {}`) landet in localStorage und laesst die Seite bei jedem Start abstuerzen; Ausweg nur Reset | `sanitizeShopping/Profile/WeekPlan` mit Quarantaene wie bei Listen (getSanitized) |
| 6.5 | NIEDRIG | worker.js:144-147 | Ohne Origin-Header wird alles zugelassen (dokumentiert, Header-Kommentar Zeile 31-33) | Rate-Limit und Tagesdeckel sind der Schutz; ok |
| 6.6 | NIEDRIG | worker.js:57-58 | `http://localhost` und `https://localhost` in DEFAULT_ORIGINS: jede lokale Webseite/App auf dem Geraet darf den Worker per Browser nutzen | in Produktion ueber `ALLOWED_ORIGINS` entfernen |
| 6.7 | NIEDRIG | src/index.html:13 | CSP: `style-src 'unsafe-inline'` (Ionic noetig), `img-src https:` offen (Rezeptbilder beliebiger Hosts), `ws://localhost:*` auch im Produktions-HTML; `script-src` ist streng, kein eval. Als meta-Tag kein `frame-ancestors` moeglich | Dev-ws nur per Build-Ersetzung; sonst akzeptabel |
| 6.8 | NIEDRIG | worker.js:562-580 | SSRF-Filter prueft nur Literale, kein DNS (z. B. `x.127.0.0.1.nip.io`). Cloudflare-Worker erreichen keine internen Netze, daher Resteinfluss gering. Redirect-Pruefung pro Hop vorhanden (606-628) | akzeptieren, in Doku vermerken |
| 6.9 | NIEDRIG | worker.js:84, 234-241 | `/off-search`: `page`, `fields`, `langs`, `sort_by` ungeprueft durchgereicht; jede Variante ist Cache-Miss | Werte whitelisten (`page` Zahl, `fields` Liste) |
| 6.10 | NIEDRIG | worker.js:424-438 | Tagesdeckel nicht atomar (dokumentiert) und ein Angreifer kann den Deckel (500) fuer alle ausschoepfen | Rate-Limit pro IP schon vorhanden; ok |

innerHTML, bypassSecurityTrust, eval, document.write: keine Treffer. `[href]`-Bindings (online-search.component.html:67) laufen durch Angular-Sanitizer. Backup: Schluessel-Whitelist, `__proto__` blockiert, 20-MB-Grenze, Endpunkte und API-Key werden nicht aus dem Backup uebernommen (backup.ts:101-108, 229-252) - gut.

## 7. Datenverlust-Risiken

| Nr | Grad | Datei:Zeile | Befund | Vorschlag |
|----|------|-------------|--------|-----------|
| 7.1 | HOCH | week-plan.service.ts:166-170 (`retranslate`), 125-132 (`ensureTranslated`); week-plan-cards.component.html:37, .ts:37 | Race: `retranslate` haelt den Plan von vor der Uebersetzung (Dauer bis ~20 s) und schreibt danach `{...plan, recipes}` zurueck. Entfernt der Nutzer in der Zeit ein Rezept (Menue ist nur bei `busyId` gesperrt, nicht waehrend `progress`) oder erzeugt einen neuen Plan, wird das entfernte Rezept wieder eingesetzt bzw. der neue Plan durch den alten ersetzt, samt Einkaufsliste (`applyWeekPlan`). Erreichbar: `ensureTranslated` startet beim Oeffnen der Karten fuer jeden nicht uebersetzten Plan | Nach dem Await `current = planStore.plan()` lesen, bei geaenderter `id`/Rezeptliste nur die uebersetzten Texte je Rezept-ID mergen (wie in `replaceRecipe`, Zeile 134-137); Menue waehrend `progress()` sperren |
| 7.2 | MITTEL | storage.service.ts:64, 123-160, 295-298; status-banner.component.ts:31 | `schemaNewer` soll Daten "nicht veraendern" (Doc-Kommentar Zeile 64), aber `set`/`flush` blockieren nicht. Nach App-Downgrade ueberschreiben Stores Daten einer neueren Version. Heute theoretisch (CURRENT_SCHEMA_VERSION = 1), wird mit Schema 2 real | in `set` bei `_schemaNewer()` nicht schreiben, Banner mit Hinweis |
| 7.3 | MITTEL | translation-cache.ts:8, 43-46 | Bis 120 Uebersetzungen (je bis 40 Schritte x 1200 Zeichen) liegen in localStorage (ca. 5 MB Quota) und konkurrieren mit Tagebuch und Auto-Sicherung (backup.service.ts:75-79 verdoppelt den Bedarf beim Import) | Limit senken (z. B. 40) oder Gesamtgroesse begrenzen; Cache vor Quota-Fehlern zuerst verwerfen |
| 7.4 | MITTEL | fastfood-sheet.component.ts:44-48 und 78-100 | Antwort einer laufenden Anfrage (bis AI_TIMEOUT) wird nach Schliessen/Wiederoeffnen gesetzt: `startSearch` setzt `ffLoading` nicht zurueck, alte Ergebnisse erscheinen im neuen Lauf, Knopf bleibt gesperrt bis die alte Anfrage endet. (Klasse K1 "offen" in review-2) | Sequenznummer wie in diary-search.ts:81 und `ffLoading.set(false)` in `startSearch` |
| 7.5 | NIEDRIG | storage.service.ts:49, 280-283 | Nach zwei Wiederholungen (5 s, 60 s) keine Wiederholung mehr bis zum naechsten `set` oder pagehide; Banner bleibt. Daten bleiben im RAM | dritte Stufe oder Wiederholung bei `visibilitychange` (flush dort vorhanden) |
| 7.6 | NIEDRIG | storage.service.ts (kein `storage`-Event) | Zwei Tabs (nur PWA) ueberschreiben sich gegenseitig ganze Listen | `storage`-Event hoeren und Stores neu laden, oder Hinweis |

Positiv: gebuendeltes Schreiben mit Flush bei pagehide, Quota-Banner, Quarantaene fuer defekte Daten, Backup-Import mit Rollback (storage.service.ts:218-234) und Auto-Sicherung vor Import/Reset. Migration hat nur Schritt 1 (leer), idempotent.

## 8. Fehlerklassen (docs/review-2/FEHLERKLASSEN.md)

| Nr | Grad | Klasse | Datei:Zeile | Befund | Vorschlag |
|----|------|--------|-------------|--------|-----------|
| 8.1 | MITTEL | K1/K5 | fastfood-sheet.component.ts:44-48, 78 | siehe 7.4 (bestaetigt, jetzt reproduzierbar per Code-Pfad) | siehe 7.4 |
| 8.2 | NIEDRIG | K5 neu | online-search.component.ts:129-136 | `loadMore` nutzt aktuellen Suchbegriff statt dem der ersten Seite; bei geaendertem Feld haengen Treffer einer anderen Suche an | Filter der letzten Suche merken |
| 8.3 | NIEDRIG | K1 | online-search.component.ts:150-160 | `translating` wird vom zuerst fertigen von zwei parallelen `ensureTranslation` auf false gesetzt, Hinweis springt zu frueh | Zaehler statt Boolean |
| 8.4 | NIEDRIG | K2 | recipes.page.ts:218-230 vs food-sources.component.ts:107-118 | Foto-Import: Fehlertext je Pfad aus anderer Funktion (`importErrorMessage` vs `fail`), Eingabe-Reset an unterschiedlichen Stellen; kein Bug gefunden | bei Refactor 2.5 vereinheitlichen |
| 8.5 | NIEDRIG | K6 | week-plan-cards.component.html:37 | Menue-Knopf bleibt waehrend Uebersetzung aktiv, obwohl die Aktion dann verloren gehen kann (7.1) | sperren |
| 8.6 | MITTEL | K7 | translation-cache.ts, storage.service.ts | weitere Cache-Klasse "Cache waechst unbegrenzt in knappem Speicher" (7.3) | Groessenlimit |

Vorschlag neue Klassen:
- K8 "Async-Ergebnis ueberschreibt neueren Zustand" (Stale-Write): Muster `const x = state(); await ...; set({...x})`. Vorkommen: week-plan.service.ts:166-170 (Fehler), `replaceRecipe` (korrekt, 134-137), fastfood-sheet (7.4), online-search loadMore (8.2). Check: alle `await` zwischen Lesen und Schreiben eines Stores.
- K9 "Ungepruefte Fremddaten werden persistiert" (KI-Antwort, Backup, localStorage): shopping.store.ts:153, profile.store.ts:18, week-plan.store.ts:13, KI-Ergebnisse (6.2).
- K10 "Erfolgsmeldung trotz verschluckten Fehlers" (Reset 3.1, Import-Rollback 3.6).

## Nicht geprueft

Nichts ausgefuehrt (kein Build, keine Tests, keine Coverage). Native Teile (android/, ios/, codemagic.yaml-Signing), Layout/SCSS und echtes Geraeteverhalten (WKWebView-Speicherbereinigung) nicht beurteilt. Worker-Verhalten live (Cloudflare Rate-Limit-Binding, KV) nicht getestet, nur Quelltext und wrangler.toml gelesen.

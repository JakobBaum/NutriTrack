# Gesamtprüfung NutriTrack (statisch, Stand 2026-11-14)

Gelesen wurde der Code im Stand HEAD (src, worker.js, e2e). Jeder Befund beruht auf einer gelesenen Zeile; unsichere sind als "Verdacht" markiert. Fehlerklassen K8 bis K10 stehen in `docs/review-2/FEHLERKLASSEN.md`.

## Zusammenfassung

| Schweregrad | Anzahl |
|---|---|
| kritisch | 0 |
| hoch | 1 |
| mittel | 15 |
| niedrig | 8 |

Kein Datenverlust- oder Sicherheitsloch im normalen Gebrauch gefunden. Wichtigster Punkt: Open-Food-Facts-Werte ohne Plausibilitätsprüfung (Kalorien sind Kernwert).

## Befunde

| Nr | Schweregrad | Klasse | Befund | Datei:Zeile | Vorschlag |
|---|---|---|---|---|---|
| 1 | hoch | K9 | OFF-Nährwerte werden nur auf >= 0 begrenzt, absurde Werte (z. B. 9999 kcal/100 g) landen im Tagebuch. | src/app/core/food/openfoodfacts.provider.ts:~150-190 | Plausibilitätsgrenzen (kcal, Atwater-Abgleich) wie in fastfood-sanitize anwenden und unplausible Treffer verwerfen. |
| 2 | mittel | K10 | Zurücksetzen zeigt Erfolg, auch wenn `clearAll()` Fehler verschluckt. | src/app/settings/settings.page.ts:142-285; src/app/core/storage/storage.service.ts:178-189 | `clearAll` Ergebnis zurückgeben und im Fehlerfall Fehlermeldung zeigen. |
| 3 | mittel | K10 | `restoreRaw` schluckt Fehler, Import-Rollback kann Erfolg melden (alter Befund 3.6). | src/app/core/storage/storage.service.ts:362-368 | Fehler zurückgeben und im Import-Dialog melden. |
| 4 | mittel | K9 | `set` ignoriert `schemaNewer`, neuere Daten können von älterer App überschrieben werden (alt 7.2). | src/app/core/storage/storage.service.ts:123-126 | Schreiben bei neuerem Schema sperren oder Nutzer warnen. |
| 5 | mittel | K9 | KI-Antworten für Einkaufsliste und Etikett werden roh übernommen. | src/app/core/ai/proxy-ai-provider.ts:61-66; src/app/core/state/shopping.store.ts:188 | Antworten wie Fastfood über einen Sanitizer mit Typ- und Wertegrenzen führen. |
| 6 | mittel | K9 | Profil und Wochenplan werden beim Laden und im Backup nur teilweise geprüft. | src/app/core/state/profile.store.ts:42; src/app/core/state/week-plan.store.ts:13-15; src/app/core/backup/backup.ts:22 | Beim Laden und Import Schema prüfen, kaputte Teile verwerfen. |
| 7 | mittel | K9 | Rezept-Import-Normalizer ohne Längen- und Mengengrenzen. | src/app/core/recipes/import/recipe-import-normalize.ts | Maximalzahlen für Zutaten, Schritte und Textlängen einführen. |
| 8 | mittel | K8 | Preishinweis wird nach `await` ohne Prüfung auf aktuelle Zutat gesetzt. | src/app/diary/add-entry-sheet/add-entry-sheet.component.ts:612-626 | Sequenz-Token wie in fastfood-sheet verwenden. |
| 9 | mittel | K8 | Online-Suche: `loadMore` und Filterwechsel ohne Token, zwei Filtersätze können sich mischen (alt 8.2). | src/app/recipes/online-search/online-search.component.ts:157-172, 117-123 | `requestSeq` einführen und Filter beim Start einfrieren. |
| 10 | mittel | K8 | `translating` ist ein Boolean, wechselt bei parallelen Übersetzungen zu früh (alt 8.3). | src/app/recipes/online-search/online-search.component.ts:187-197 | Zustand je Rezept-id führen. |
| 11 | mittel | K8 | Verdacht: Rezeptimport überschreibt `form` nach `await`, Schließen nicht gesperrt. | src/app/recipes/recipes.page.ts:419-439 | Beim Schließen Anfrage verwerfen oder `form` nach `await` neu prüfen. |
| 12 | mittel | K10 | Verdacht: Backup-Export meldet "heruntergeladen" über `<a download>` in WKWebView ohne Wirkung. | src/app/core/backup/backup.service.ts (`deliver`) | Auf iOS nativen Share/Filesystem-Weg erzwingen und Erfolg nur dann melden. |
| 13 | mittel | Worker | OFF-Suchparameter werden nicht validiert. | worker.js:239-241 | Länge und Zeichensatz der Parameter begrenzen. |
| 14 | mittel | Worker | Rezeptsuche ohne Tageslimit (KV-Cap), nur Rate-Limit. | worker.js:340-369 | Tageslimit wie bei den KI-Routen ergänzen. |
| 15 | niedrig | Worker | `new URL` ohne Guard in `fetchPublicPage`; Fehler wird nur über generischen Handler abgefangen. | worker.js:663 | In try/catch mit 400-Antwort fassen. |
| 16 | niedrig | Wartung | Alter Proxy noch im Repo, README nennt ihn veraltet (alt 2.1). | server/gemini-proxy/worker.mjs | Entfernen oder klar archivieren. |
| 17 | niedrig | K8 | Profil-Sheet `save` nutzt Zustand vor dem `await`. | src/app/settings/profile-sheet/profile-sheet.component.ts:296-312 | Store nach `await` neu lesen. |
| 18 | niedrig | K8 | Verdacht: `editPrice(index)` arbeitet mit Index statt id. | src/app/shopping/shopping.page.ts:505-540 | Zeile per id adressieren. |
| 19 | niedrig | K5 | Rohes `fetch()` ohne Timeout (nur Diagnose). | src/app/settings/settings.page.ts:296,305,316 | `AbortController` mit Timeout. |
| 20 | niedrig | K9 | `isFacts` prüft nur Endlichkeit, keine Obergrenzen. | src/app/core/backup/backup-records.ts | Obergrenzen je Nährwert ergänzen. |
| 21 | niedrig | K9 | `isTexts` im Übersetzungs-Cache prüft Typ schwach; Mapper ruft `.trim()` auf evtl. Nicht-String. | src/app/core/recipes/translate/translation-cache.ts:43-46; src/app/core/recipes/online/spoonacular.mapper.ts | Typen strikt prüfen. |
| 22 | niedrig | K10 | `void` ohne `catch` bei Wochenplan-Karten. | src/app/shopping/week-plan/week-plan-cards.component.ts:37,45 | Fehler abfangen und Hinweis zeigen. |
| 23 | mittel | UX | Kein echter Offline-Hinweis in der UI (nur `navigator.onLine` in Services). | src/app/core/week-plan/week-plan.service.ts:85,139; src/app/recipes/recipes.page.ts:444 | Globalen Offline-Hinweis ergänzen. |
| 24 | mittel | Wartung | Dateien über 400 Zeilen: worker.js (995 im HEAD), add-entry-sheet.component.ts 679, recipes.page.ts 644, shopping.page.ts 608, diary.page.ts 497, recipes.page.html 494, dashboard.page.scss 435. | siehe Spalte Befund | Zuerst worker.js nach Routen/Validatoren und add-entry-sheet aufteilen. |

Funktionen über 50 Zeilen: per Heuristik keine gefunden (`save` in add-entry-sheet.component.ts:629 hat 46 Zeilen).

## Prüfpunkte ohne Befund

- Rohes `fetch()`: nur settings.page.ts (siehe Nr. 19); sonst HttpClient mit Timeout.
- Accessibility auf Grep-Ebene: keine Icon-Buttons ohne Label, keine klickbaren div/span ohne Rolle, keine img ohne alt, Suchleisten und Toggles beschriftet, eigene Chips mit role/aria-checked.
- Kein `innerHTML`, kein `bypassSecurityTrust*`.
- Worker: Validatoren (465-593), SSRF-Filter (597-626), Body-Größenlimit (398-423), generische Fehlerantworten ohne interne Details (174-182) wirken solide.
- Speicherfehler erreichen die Nutzer über das globale Banner (storage.service.ts:134-160, app.component.html:4).

## Stand alter Befunde (docs/review-3/CODE-REVIEW.md)

- behoben: 7.1 (week-plan.service.ts:176-184), 7.4/8.1 (fastfood-sheet requestSeq), 8.5, 5.1 (Redirect-SSRF-Tests worker.test.mjs:1078-1104).
- teilweise: 6.2, 6.4.
- offen: 6.1, 7.2 (Nr. 4), 7.3, 3.1 (Nr. 2), 3.2, 3.3/4.1, 3.4, 3.6 (Nr. 3), 8.2 (Nr. 9), 8.3 (Nr. 10), 2.1 (Nr. 16), 2.4, 6.9; Dateigrößen (Nr. 24; worker.js gewachsen von 940 auf 995).

## Nicht geprüft

- Keine Laufzeitprüfung, keine Builds, keine Tests ausgeführt.
- Keine Screenshots, kein echtes Gerät (iPhone, WKWebView, Safe Area, Tastatur).
- Leer-/Fehler-/Offline-Zustände je Tab und Sheet nur im Code gelesen, nicht ausprobiert.
- Funktionslänge nur per Heuristik, Accessibility nur per Grep und Skript (kein Screenreader, keine Kontrastmessung).
- Zeilenangaben mit "~" sind ungefähr. Im Arbeitsbaum geänderte Dateien anderer Agenten (Consent, Datenschutztexte, robots.txt, User-Agent, worker.js aktuell 1123 Zeilen) wurden bewusst nicht bewertet.
- Spoonacular- und Gemini-Antwortformate wurden nicht gegen echte Antworten verglichen.

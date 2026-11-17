# Review 4: Befunde (Stand 2026-11-15, Branch review-4-audit)

Ausgangslage vor der Prüfung: tsc und Lint sauber, 1958 Unit-Tests, 223 Worker-Tests, Build ok, `npm audit` 0.
Status je Befund: offen, behoben, bewusst offen (mit Grund).

## Security (Worker, CI, CSP)

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| S1 | mittel | worker/limits.js:35-40, worker/ai.js:39-43, worker/recipes.js:128-132 | Tagesdeckel von Dritten leerlaufbar; Rate-Limit je volle IPv6-Adresse (Rotation im /64 umgeht es). Fix: IPv6 auf /64 kürzen, Tageslimit je IP. | teilweise behoben (IPv6 /64; Tagesdeckel je IP bewusst offen) |
| S2 | mittel | worker/limits.js:54-63 | KV-Zähler nicht atomar (Lost Update); paralleles `put` kann scheitern und 503 liefern. Sauber nur mit Durable Object. | bewusst offen (braucht Durable Object) |
| S3 | niedrig | worker/ai.js:24-36 | Body lesen und validieren vor dem Rate-Limit. | behoben |
| S4 | niedrig | worker/ssrf.js:20-38 | Filter prüft Hostnamen, nicht die aufgelöste IP (auf Workers ohne Wirkung). | bewusst offen (auf Workers ohne Wirkung) |
| S5 | niedrig | worker/page.js:68 | Statuscode fremder Seiten wird an den Client gereicht. | behoben |
| S6 | niedrig | worker/ai.js:166-189 | importRecipe: Seiteninhalt ohne Daten-Begrenzer, kein responseSchema. | behoben |
| S7 | niedrig | worker/off.js:77-101 | Upstream-Fehlertexte von OFF durchgereicht; Timeout wird 500 statt 504. | behoben |
| S8 | niedrig | worker/recipes.js:94-105,142-145 | Spoonacular-Fehlertexte roh an den Client; Quota-Header gecacht. | behoben |
| S9 | niedrig | .github/workflows/ios.yml | kein `permissions:`-Block; Actions nicht auf SHA gepinnt. | teilweise behoben (permissions gesetzt; SHA-Pinning offen) |
| S10 | niedrig | src/index.html:11 | Meta-CSP kann Framing nicht verhindern (Pages ohne eigene Header). | bewusst offen (Pages ohne eigene Header) |
| S11 | niedrig | worker/limits.js:60 | Nicht numerischer KV-Wert wird zu 0 (Deckel beginnt neu). Fix: fail-closed. | behoben |

## Stille Fehler (querschnittlich)

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| F1 | mittel | src/app/recipes/recipe-form.ts:112-116 | Ungültige oder geleerte Nährwert-Eingabe einer Zutat wird zu 0 kcal. | behoben |
| F2 | mittel | src/app/core/recipes/translate/recipe-translate.ts:114-118 | KI-Fehler bei der Suchbegriff-Übersetzung ohne Log und ohne Wörterbuch-Rückfall; Ergebnis sieht aus wie "keine Treffer". | behoben |
| F3 | mittel (Verdacht) | src/app/core/food/openfoodfacts.provider.ts:176-185, spoonacular.mapper.ts:59-61 | Fehlende Makros werden zu 0 g. | behoben |
| F4 | mittel | src/app/core/state/*.store.ts (persist) | `StorageService.set()` liefert bei Schreibsperre `false`, Stores ignorieren es; Erfolgs-Toast trotz nicht gespeichert. | behoben |
| F5 | mittel | worker/ai.js:185-188 | importRecipe: Link nicht abrufbar und Text vorhanden: stiller Rückfall, Client meldet Import aus URL. | behoben |
| F6 | mittel | src/app/core/food/combined-food-search.ts:21-24 | Online-Suche fällt aus, eigene Treffer werden ohne Hinweis gezeigt. | behoben |
| F7 | niedrig | src/app/diary/add-entry-sheet/add-entry-sheet.component.ts:579-584 | quickAddRecipe ohne Werte: Tipp bewirkt nichts, keine Meldung. | behoben |
| F8 | niedrig | src/app/shared/barcode-scanner/barcode-scanner.component.ts:101-102 | Jeder Startfehler wird "Kamera nicht verfügbar", kein Log, keine eigene Meldung bei verweigerter Berechtigung. | behoben |
| F9 | niedrig | src/app/core/scan/barcode-scanner.service.ts:43-45, label-scan.ts:75-79, recipe-translate.ts:145 | catch ohne Log. | behoben |
| F10 | niedrig | src/app/settings/profile-sheet/profile-sheet.component.ts:311 | stummer return nach await. | behoben |
| F11 | niedrig | src/app/shopping/week-plan/week-plan-cards.component.ts:39,47 | `void` ohne catch (alt Nr. 22). | behoben |

## Daten (core/storage, core/state, core/backup, core/util)

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| D1 | hoch | storage/storage.service.ts:141-144,175-183 | `flush` mit leerer Warteschlange und `remove` setzen `lastError` nicht zurück: Fehler-Banner bleibt stehen, obwohl nichts aussteht. | behoben |
| D2 | hoch | storage/storage.service.ts:111-116,275-279; profile.store.ts:58-59; week-plan.store.ts:42-43 | Bereinigter Stand wird geschrieben bzw. Key entfernt, auch wenn die Quarantäne-Sicherung scheiterte (Speicher voll): verworfene Daten endgültig weg. | behoben |
| D3 | mittel | backup/backup.service.ts:93-99 | Nach `rollbackFailed` zweiter Importversuch auf halb geschriebenem Stand; Ergebnis wird nur als `failed` gemeldet. | behoben |
| D4 | mittel | storage/storage.service.ts:231-247 | `replaceAll` leert `pending` vorab; bei gescheitertem Import gehen ungespeicherte Änderungen verloren. | behoben |
| D5 | mittel | storage.service.ts, alle Stores | Kein `storage`-Event: zwei Tabs überschreiben sich gegenseitig (last writer wins). | behoben |
| D6 | mittel | backup/backup-records.ts:17-24,39-41,49,67-69 | Import lässt negative Werte zu; `ingredients[].facts` und `steps` ungeprüft. | behoben |
| D7 | mittel | state/record-sanitize.ts:90-101; diary.store.ts:157-188 | `baseFacts` nie geprüft; `update()` validiert `facts`/`servings`/`meal`/`unit` nicht (NaN macht Eintrag beim nächsten Start unsichtbar). | behoben |
| D8 | mittel (Verdacht) | state/shopping.store.ts:156-158 | Einkaufsliste wird ungeprüft geladen (`items` kein Array führt zum Absturz). | behoben |
| D9 | mittel | state/weight.store.ts:14-31 | Ungültige Gewichtseinträge werden beim Laden still verworfen (keine Quarantäne). | behoben |
| D10 | mittel (Verdacht) | storage.service.ts:253-268; storage-quarantine.ts:7-9 | Quarantäne ohne Größengrenze belegt das Kontingent. | behoben |
| D11 | mittel | storage.service.ts:208-223; backup.service.ts:62-69 | Unlesbare Schlüssel fehlen im Backup, Export meldet trotzdem Erfolg. | behoben |
| D12 | mittel (Verdacht) | diary.store.ts:243-267,295,310 | Zeitstempel mit Offset sortieren per `localeCompare` falsch. | behoben |
| D13 | niedrig | record-sanitize.ts:32; backup-records.ts:30; weight-math.ts:25,38 | Unmögliche Tage (`2026-02-31`) gelten in V8 als gültig. | behoben |
| D14 | niedrig | storage.service.ts:96,221 | `set(key, undefined)` schreibt "undefined" bzw. wirft im Snapshot. | behoben |
| D15 | niedrig | storage.service.ts:318-324 | Schreibfehler in der Migration nur per console.error. | behoben |
| D16 | niedrig | backup.service.ts:86-100; recipe.store.ts:107-110 | Nur eine Auto-Sicherung, wird ohne Warnung überschrieben. | bewusst offen |
| D17 | niedrig | util/number-input.ts:5-34 | "1.250" wird 1250; keine Obergrenze. | bewusst offen |
| D18 | niedrig | shopping.store.ts:202-204 | `Math.max(1, Math.floor(NaN))` ergibt NaN. | behoben |
| D19 | niedrig | week-plan-sanitize.ts:22-45; favorite.store.ts:57-60; backup-sanitize.ts:55-64 | Schwächere Prüfungen beim lokalen Laden als beim Import; negative Werte, Zusatzfelder ungeprüft. | behoben |

Refactor-Kandidaten Daten: gemeinsame `util/guards.ts` (isRec/isStr/isNum mehrfach definiert), `ISO_DATE_RE` an 5 Stellen, `snapshot`/`snapshotWithoutFlush` fast gleich, toter Code in backup-records.ts (`hasValidRecords`, `isShoppingList`, `isWeightList`), `sanitizeWeights` doppelt, Lade-Muster Profil/Wochenplan doppelt.

## Profil, Heute, Gewicht, Shell

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| P1 | mittel | core/nutrition/nutrition-calc.service.ts:153-158 | `achievedRateKgPerWeek` nutzt `Math.abs`: bei Abnehmen mit Mindestzufuhr über TDEE wird eine Abnahme angezeigt, obwohl ein Überschuss besteht; "Tempo senken" ohne Wirkung. | behoben |
| P2 | mittel | dashboard/week-strip.component.ts:39-50 | Wochenstreifen rechnet nach Mitternacht nicht neu. | behoben |
| P3 | mittel | shared/date-nav/date-nav.component.ts:31 | `maxDate` nur einmal gesetzt: nach Mitternacht ist der neue Tag im Kalender nicht wählbar. | behoben |
| P4 | mittel | status-banner/status-banner.component.ts:70-80 | Banner-Export wertet das Ergebnis nicht aus (`unverified` ohne Meldung). | behoben |
| P5 | mittel | weight/weight-card.component.ts:88-93 | "Ziel neu berechnen" blendet den Hinweis aus, bevor das Profil gespeichert wurde. | behoben |
| P6 | mittel | settings/profile-sheet/profile-sheet.component.html:107,148,198 | Drei kleine Text-Buttons ohne Mindest-Tippfläche. | behoben |
| P7 | niedrig | dashboard/dashboard.page.html:181 | `track item.label` (doppelte Namen ergeben doppelte Keys). | behoben |
| P8 | niedrig | settings/profile-sheet/profile-form-state.ts:66-96 | Wechsel von Halten zu Zunehmen wählt 0,4 statt Vorgabe 0,25 kg/Woche. | behoben |
| P9 | niedrig | settings/profile-sheet/profile-sheet.component.ts:239-284 | Keine Rückfrage bei ungespeicherten Änderungen im Profil-Sheet. | behoben |
| P10 | niedrig | dashboard/dashboard.page.html:81-83 | Gewichtskachel erst nach erstem Essenseintrag, Text empfiehlt "morgens nüchtern". | bewusst offen (Entscheidung Review 2, Frage an Jakob) |
| P11 | niedrig | settings/settings.page.ts:176; settings.page.html:127-129 | Begriffe zurücksetzen/löschen uneinheitlich. | behoben |
| P12 | niedrig (Verdacht) | settings/settings.page.ts:237-253 | `onBackupFileSelected` ohne catch. | behoben |
| P13 | niedrig | weight/weight-card.component.html:17 | aria-label nennt 5 Einträge, Diagramm zeigt alle; Achse ohne Jahr. | behoben |
| P14 | niedrig | weight/weight-card.component.ts:22-27 | "+0,0 kg pro Woche" (Vorzeichen vor Rundung). | behoben |
| P15 | niedrig | settings/profile-sheet/profile-sheet.component.ts:164-168 | "≈ −0 kcal/Tag" vor Gewichtseingabe. | behoben |
| P16 | niedrig (Verdacht) | core/nutrition/nutrition-calc.service.ts:189-191 | `scaleToGrams` bei perPortion ohne portionG rechnet still mit 100 g. | nicht bestätigt |
| P17 | niedrig (Verdacht) | dashboard/week-strip.component.html:5 | `li role="img"` zerstört Listensemantik. | behoben |
| P18 | niedrig | settings/profile-sheet/profile-sheet.component.ts:275-278 | `addDislike` leert das Feld auch bei Duplikat/Limit; Enter umgeht das Limit-Disable. | behoben |
| P19 | niedrig (Verdacht) | dashboard/dashboard.page.html:155 | Drill-Inhalt verschwindet während der Schließ-Animation. | behoben |

Refactor-Kandidaten: settings.page.ts (Backup/Reset-Dialoge auslagern, ungenutztes `formatDecimal`), nutrition-calc (wirkungsloses `Math.min`, Wrapper `minKcal`), app.module `prefersReducedMotion` doppelt, dashboard `factValue`/`drillData` nach dashboard-math, `shortDate`/`round1` doppelt.

## KI, Lebensmittel, Scan, Nährwerte

Hinweis: Nr. 1, 5, 7 aus docs/review-3/GESAMTPRUEFUNG.md sind im Code bereits behoben (Dokument veraltet).

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| K1 | hoch | shared/barcode-scanner/barcode-scanner.component.ts:94-105,145-149 | `startScan` setzt `controls` nach dem await ohne Prüfung, ob das Modal schon zu ist: Kamera läuft weiter, nächster Scan zeigt totes Video. | behoben |
| K2 | mittel | shared/food-sources/food-sources.component.ts (Kamera-Abbruch) | Abbruch der nativen Kamera zeigt englischen Systemtext als Scan-Fehler. | behoben |
| K3 | mittel | core/recipes/translate/recipe-translate.ts, translate-normalize.ts (pairwise) | Falsche Anzahl übersetzter Zeilen: Original wird als vollständig übersetzt gecacht. | behoben |
| K4 | mittel | core/food/openfoodfacts.provider.ts:156-186 | Kein Abgleich kcal gegen Makros (kJ im kcal-Feld, kcal 0 bei vollen Makros). | behoben |
| K5 | mittel | core/ai/label-sanitize.ts:20-61; core/ai/recipe-import-normalize.ts:45-51 | Kein Atwater-Abgleich; Import ohne Plausibilitätsprüfung je 100 g. | behoben |
| K6 | mittel | diary/diary-search.ts:34-46 | `reset()`/`clearAfterPick()` erhöhen `seq` nicht: späte Antwort füllt die Liste bei leerem Suchfeld. | behoben |
| K7 | mittel | core/scan/barcode-scanner.service.ts:30,43-45 | Gescheiterter zxing-Import bleibt als abgelehntes Promise stehen: Scan bis Neustart kaputt. | behoben |
| K8 | mittel | core/nutrition/recipe-nutrition.ts:124-128 | Unbekannte Einheit mit Werten je 100 g zählt als 100 g je Einheit (2 Msp Zimt = 200 g). | behoben |
| K9 | mittel | core/ai/ai.service.ts:73-76; openfoodfacts.provider.ts:93,127; settings/ai-status-row | Nach Widerruf laufen `ping`, OFF-Suche und Barcode-Abfrage weiter; Text sagt "nichts mehr an Dritte". | behoben |
| K10 | mittel (Verdacht) | Zustimmungstext | Freitext "Essen beschreiben", Einkaufsliste (Titel, Budget, Markt) und Abneigungen gehen an Gemini, stehen aber nicht im Zustimmungstext. | behoben |
| K11 | mittel (Verdacht) | core/diet/intolerance-rules.ts:41-46 | Allergen-Filter lückenhaft (Rührei, Spiegelei, Eiersalat, Omelett; Pecorino, Gorgonzola, Burrata). | behoben |
| K12 | niedrig | core/recipes/translate/translation-cache.ts (isTexts) | Prüft nur Array, nicht Elemente (alt Nr. 21). | behoben |
| K13 | niedrig | openfoodfacts.provider.ts:132-135,174-175 | Produkt ohne Nährwerte wird als "kein Produkt gefunden" gemeldet. | behoben |
| K14 | niedrig | openfoodfacts.provider.ts:144-180; spoonacular.mapper.ts:59-61 | Fehlende Makros werden 0 g statt "unvollständig" (= F3). | behoben |
| K15 | niedrig (Verdacht) | number-input.ts über OFF/Import | Tausenderpunkt-Heuristik auch für Fremddaten ("1.500" wird 1500). | behoben |
| K16 | niedrig | core/scan/label-scan.ts:59 | OCR-Etikett nur mit Portionsspalte ohne Portionsgröße: still 100 g angenommen (= P16). | behoben |
| K17 | niedrig | core/scan/nutrition-label-parser.ts:22-24,156-159 | Grenzen 950 kcal/100 g auch je Portion; "1 046 kJ" wird als 046 gelesen. | behoben |
| K18 | niedrig (Verdacht) | core/scan/idle-resource.ts:29-34; label-ocr.service.ts:40 | Fehler eines Jobs beendet geteilten Worker trotz laufendem zweiten Job; kein OCR-Zeitlimit. | behoben |
| K19 | niedrig (Verdacht) | core/recipes/online/spoonacular.mapper.ts:45-48,163 | Spoonacular-Nährwerte ohne Grenzen. | behoben |
| K20 | niedrig | barcode-scanner.component.ts:109-116,158-165 | Schließen während `lookup`: Treffer geht verloren, `pendingHit` bleibt stehen. | behoben |
| K21 | niedrig | barcode-scanner.service.ts:79-81 | Verweigerte Berechtigung und fehlende Kamera: gleiche Meldung (= F8). | behoben |
| K22 | niedrig | diet-translate.service.ts:278 u. a. | console.error statt DebugLogService. | behoben |
| K23 | niedrig | src/environments/environment.ts:7 | Dev-Umgebung zeigt auf den produktiven Worker. | bewusst offen (Jakob testet mit echtem Worker) |

Refactor-Kandidaten: Plausibilitätsgrenzen mehrfach (`MAX_KCAL_PER_100G` an 4 Stellen, einmal 950), `GRAM_UNITS` doppelt, `cleanText`/`isInRange` doppelt, `isDeviceOffline` doppelt, toter Code (`OpenFoodFactsProvider.autocomplete`, `EMPTY_FILTERS`, `scaleToPortions`).

## Einkauf und Wochenplan

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| E1 | hoch | shopping/shopping.page.ts:505-543; core/state/shopping.store.ts:294-299 | `editPrice` adressiert die Zeile nach dem Alert über den alten Index (keine id): nach Ablauf eines Undo trifft Preis/Löschen die falsche Position. | behoben |
| E2 | mittel | shopping.page.ts:332-384; shopping.page.html:121-136 | "Abbrechen" während des Erzeugens bricht nichts ab; Ergebnis überschreibt die Liste trotzdem. | behoben |
| E3 | mittel | shopping.page.ts:332-367,505-573 | Kein Doppel-Tipp-Schutz (zwei Bestätigungen, zwei parallele Läufe, zwei Overlays). | behoben |
| E4 | mittel | core/state/shopping.store.ts:115-122 (mergeKept) | Eigener Preis auf erzeugter, nicht abgehakter Position geht beim Rezepttausch verloren. | behoben |
| E5 | mittel | core/shopping/package-size.ts:18-24,75-77 | `includes` ohne Wortgrenze: Preiselbeeren trifft "reis", Zuckerschoten trifft "zucker". | behoben |
| E6 | mittel | core/shopping/shopping-generator.ts:25-40; shopping.store.ts:228 | Erst summieren, dann runden: zwei Zeilen "Zwiebel … Stk". | behoben |
| E7 | mittel | shopping.page.ts:362-384 | "Plan aus meinen Rezepten" lässt den alten Online-Wochenplan stehen; dessen Karten bauen die Liste später aus dem alten Plan neu. | behoben |
| E8 | mittel (Verdacht) | core/week-plan/week-plan.service.ts:176-184 | Übersetzung ersetzt die Liste, während ein Undo offen ist (Index statt id). | behoben |
| E9 | mittel (Verdacht) | shopping.page.ts:428-432 | Zweites Löschen startet den Undo-Toast nicht neu. | behoben |
| E10 | niedrig | shopping.page.ts:233-257 | Generator-Navigation uneinheitlich; `error()` wird nicht zurückgesetzt. | behoben |
| E11 | niedrig | shopping.page.ts:577-602 | Add-Sheet: Feldfehler bleibt beim Tippen, leerer Name ohne Meldung, Einheit springt auf g, Preis 0 uneinheitlich. | behoben |
| E12 | niedrig | shopping.page.ts:517-541 | Platzhalter "0,00 €", aber "2,49 €" ist ungültig. | behoben |
| E13 | niedrig | core/shopping/units/unit-format.ts:27-30 | 975 bis 999 g werden "1.000 g" statt "1 kg". | behoben |
| E14 | niedrig | shopping/shopping-list.util.ts:91-94; shopping.page.ts:441-443 | Teilen nutzt rohe Kategorie; leere Liste meldet "alle erledigt". | behoben |
| E15 | niedrig | shopping.store.ts:100-108,136-141 | `userPrice` bleibt bei wachsender Menge; `withTotal` löscht jeden Hinweis. | behoben |
| E16 | niedrig | shopping.store.ts:276-289; shopping.page.html:149-152 | Manuelle Liste zeigt "Einkauf für 1 Person" und "Neu generieren". | behoben |
| E17 | niedrig | week-plan.service.ts:107-114; week-plan-cards.component.html:19 | Leerer Plan "0 Rezepte" ohne Leerzustand. | behoben |
| E18 | niedrig | week-plan.service.ts:186-192 | Ein gemeinsames `_progress`-Signal für parallele Übersetzungen. | behoben |
| E19 | niedrig (Verdacht) | shopping.page.html:240,269 | `track row.index`. | behoben |
| E20 | niedrig | shopping.page.html:95-103 | `role="radio"` in `role="group"` statt `radiogroup`; überflüssiges tabindex. | behoben |
| E21 | niedrig (Verdacht) | shopping.page.html:223 | Löschen auf Touch nur per Wischen oder im Preis-Dialog. | behoben |

Refactor-Kandidaten: shopping.page.ts (608 Zeilen) in Generator- und Add-Sheet-Komponente teilen, `generatePlan` 51 Zeilen, toter Code (`toggle(index)`, `parseDecimal`/`formatDecimal`-Felder), `round2` dreifach, `categoryOf` doppelt, doppelte Template-Zweige, doppelter Block in week-plan.service.ts.

## Tagebuch

Hinweis: Preishinweis-Race (alt Nr. 8) und Fastfood-Token sind behoben.

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| T1 | mittel | diary/add-entry-sheet/add-entry-sheet.component.ts:455-480 | Mengenänderung überschreibt von Hand angepasste Nährwerte stillschweigend. | behoben |
| T2 | mittel | add-entry-sheet.component.ts:323-326; .html:51-53 | Zurück-Pfeil leert Suchbegriff und Treffer; Formularänderungen ohne Rückfrage weg. | behoben |
| T3 | mittel | add-entry-sheet.component.ts:293-295; describe-meal.component.ts | "Essen beschreiben": Schließen ohne "Verwerfen?" (Text und KI-Ergebnis weg). | behoben |
| T4 | mittel (Verdacht) | diary.page.ts:318-321 | Essenszeit im Bearbeiten-Dialog kann nach der Auswahl veraltet angezeigt werden (Feld statt Signal, OnPush). | behoben |
| T5 | mittel | fastfood-sheet.component.ts:81,111; fastfood-form.component.ts:61-63 | Ohne Tagesziel zeigt der Regler 1500 kcal, gesendet werden 200; fast alles "über Budget". | behoben |
| T6 | niedrig | diary.page.ts:234-242,272-275 | Bearbeiten: Stepper/Chips schreiben "0.25" statt "0,25". | behoben |
| T7 | niedrig | diary.page.ts:290; .html:156 | `editError` bleibt nach Korrektur stehen. | behoben |
| T8 | niedrig | fastfood-sheet.component.ts:212-223 | `logFastfood` ohne Doppel-Tipp-Schutz. | behoben |
| T9 | niedrig | diary.page.html:96 | KI-Schätz-Badge hängt am aktuellen KI-Status statt am Eintrag. | behoben |
| T10 | niedrig | diary.page.ts:323-341 | Leerer Name wird beim Speichern still ignoriert. | behoben |
| T11 | niedrig | diary.page.ts:393-397 | "Doppelt" im Bearbeiten-Dialog dupliziert das Original, Änderungen weg. | behoben |
| T12 | niedrig (Verdacht) | diary/week-view.component.ts:82 | `today` nur einmal gesetzt (Mitternacht). | behoben |
| T13 | niedrig | diary.page.html:127-130 | FAB in der Wochenansicht trägt in einen nicht sichtbaren Tag ein. | behoben |
| T14 | niedrig | add-entry-sheet.component.ts:430-432; diary.page.ts:268-270 | Chip-Getter sortieren bei jedem Tastendruck das ganze Tagebuch. | behoben |
| T15 | niedrig (Verdacht) | diary/describe-meal/describe-meal-logic.ts:50-58 | Dezimalpunkt statt Komma. | behoben |
| T16 | niedrig | describe-meal.component.ts:132-136 | Letzte Zeile entfernt: "nichts erkannt". | behoben |
| T17 | niedrig | add-entry-sheet.component.ts:388-395 | "Von Hand eintragen" aus Beschreiben: Text geht verloren. | behoben |
| T18 | niedrig (Verdacht) | add-entry-logic.ts:57-66; models SavedMealEntry | Gespeicherte Mahlzeit verliert Einheit (ml wird g) und Schätz-Kennzeichen. | behoben |
| T19 | niedrig | fastfood-sheet.component.html:45 | Buttons "Eintragen" ohne unterscheidbares aria-label. | behoben |
| T20 | niedrig | add-entry-sheet.component.html:93 | Favoriten-Stern entfernt sofort ohne Rückgängig. | behoben |
| T21 | niedrig | src/styles/compact-phone.scss:21 | `--nt-touch: 40px` unter 390 px (unter 44 pt). | bewusst offen (Entscheidung 2026-11-10, Frage an Jakob) |
| T22 | niedrig | diary.page.html:102-110 | Wisch-Menü bleibt nach "Bearbeiten" offen. | behoben |
| T23 | niedrig | diary-edit.ts:101; diary-helpers.ts:133-177 | Bezugswerte aus gerundeten Werten: Fehler wächst bei kleinen Mengen. | behoben |

Refactor-Kandidaten: add-entry-sheet.component.ts (687 Zeilen) teilen, Edit-Dialog aus diary.page.ts als eigene Komponente mit Signalen (löst T4, T6, T7), Duplikate `entryToInput`/`entryFromRecent` und Rohtext-Logik, toter Code (`isToday`, `editEntryUnit`, `BarView.inGoal`, `maxRows`, `?fastfood=1`).

## Rezepte und Mahlzeiten

| Nr | Schwere | Stelle | Befund | Status |
|---|---|---|---|---|
| R1 | hoch | meals/meals-list.component.ts:177-182; meals/meal-draft.ts (rescaleEntryAmount) | Mengeneingabe skaliert bei jedem Tastendruck vom zuletzt gerundeten Wert: Rundungsfehler summieren sich, bei Zwischenwert 0 oder leer gehen die Nährwerte verloren. | behoben |
| R2 | mittel | recipes/recipes.page.ts:582-599 | `save` ohne Doppel-Tipp-Schutz: zwei Rezepte. | behoben |
| R3 | mittel | recipes/recipe-form.ts:90-142 | Automatisch berechnetes Gesamtgewicht wird als `cookedWeightG` gespeichert und später als eigenes Gewicht behandelt: Werte je 100 g bleiben nach Mengenänderung falsch. | behoben |
| R4 | mittel (Verdacht) | recipes/recipe-detail-flow.ts:86-93 | Veralteter Ladevorgang wird wie ein Fehler behandelt: Detail springt wieder auf. | behoben |
| R5 | mittel | recipes/recipes.page.ts:366-388,483-485,512 | `expandedIndex` wird bei openAdd/openEdit nicht zurückgesetzt und beim Entfernen nicht angepasst. | behoben |
| R6 | mittel (Verdacht) | core/util/units.ts UNIT_OPTIONS; core/nutrition/units-weight.ts | Auswahl kennt Zehe/Scheibe/Tasse nicht, die Gewichtstabelle schon. | behoben |
| R7 | mittel | recipes/recipe-view.ts:19-23 | `totalWeightG` nutzt die Tabelle ohne Normalisierung/Aliase statt `unitGrams`. | behoben |
| R8 | mittel (Verdacht) | recipes/recipes.page.html:196-205 | Feld fest "kcal/100g", obwohl die Zutat Portionswerte haben kann. | behoben |
| R9 | mittel (Verdacht) | meals/meals-list.component.ts:185-189,255-280 | Rezept im Gericht übernimmt `isPartial` nicht; Umrechnung weicht vom Tagebuch-Pfad ab. | behoben |
| R10 | mittel (Verdacht) | recipes/recipes.page.ts:602-610; undoable-delete.ts | Zweites Löschen lässt das erste Undo still verfallen. | behoben |
| R11 | niedrig | recipes/recipe-form.ts:112-116 | `applyFact` nimmt negative Werte an; leeres Feld wird 0 kcal (= F1). | behoben |
| R12 | niedrig | recipes/recipes.page.html:134-136,309-311 | Fehlermeldung doppelt. | behoben |
| R13 | niedrig | recipes/recipes.page.html:168,181,209,453,457 | Dekorative Icons ohne aria-hidden. | behoben |
| R14 | niedrig | meals/meals-list.component.html:17 | "1 Einträge". | behoben |
| R15 | niedrig | meals/meals-list.component.html:193 | Deaktivierter Button ohne sichtbaren Grund. | behoben |
| R16 | niedrig | meals/recipe-facts-loader.ts:55 | console.error ohne Rückmeldung. | behoben |
| R17 | niedrig (Verdacht) | recipes/recipes.page.html:478 | `capture="environment"` verhindert die Galerie-Auswahl. | behoben |
| R18 | niedrig (Verdacht) | recipes/recipes.page.ts:271-286,616-622 | Fehler nur als Toast ohne "Erneut versuchen". | nicht bestätigt |
| R19 | niedrig (Verdacht) | core/cook (utensilsFor, stepIngredientsByStep) | Teilstring-Zuordnung ("Salz" in "Salzwasser", "Ei" in "Eiweiß"). | nicht bestätigt |

Refactor-Kandidaten: recipes.page.ts (641 Zeilen) teilen, toter Code (`needsManualFacts`, `lowerBoundPrefix`, `parseDecimal`-Felder, Import `isValidYield`, `QUICK_UNITS`/`moreUnits`/`unitChips`, `isMealDraftDirty`), `MEAL_OPTIONS` doppelt, `save`/`runImport` über 50 Zeilen.

## UI/UX (Laufzeit, 375x667 und 320x568, Baseline-Build)

Screenshots: Scratchpad `ux/`. Code-Stellen sind aus dem DOM abgeleitet, nicht aus dem Quelltext.

| Nr | Schwere | Bildschirm | Befund | Status |
|---|---|---|---|---|
| U1 | hoch | Einwilligungsdialog @320 | Checkbox "mindestens 18" liegt unter dem Button "Datenschutzerklärung lesen", Inhalt scrollt nicht: Zustimmen bleibt gesperrt. | behoben |
| U2 | mittel | Einwilligungsdialog @320 | Titel bricht, kein Abstand zum Text, kein Sheet-Griff. | behoben |
| U3 | mittel | Heute, Tagebuch, Mahlzeiten, Einkauf | FAB überdeckt Inhalt (Summe "370 kca", Zuckerzeile). | behoben |
| U4 | mittel | Eintragen-Sheet @375, 150 % Schrift | Quellen-Kacheln laufen über, "Haferflo-cken". | behoben |
| U5 | mittel | Heute, Tagebuch, 150 % Schrift | Datum bricht, Segment schneidet Unterlängen ab. | behoben |
| U6 | mittel | Profil-Sheet @320 | Feste Zusammenfassung belegt 30 % der Höhe, Inhalt scheint durch; Zeile "Mag ich nicht" abgeschnitten und 9 px anders eingerückt. | behoben |
| U7 | mittel | Manuell-Sheet @320 | "Nährwerte anpassen" aufgeklappt: nur 60 px sichtbar. | behoben |
| U8 | mittel | Mahlzeiten | "1 Einträge" (= R14); Meta-Text Kontrast 3,26:1 (#8E8E93). | behoben |
| U9 | mittel | Gewicht-Sheet | Hilfstext Kontrast 3,26:1. | teilweise behoben |
| U10 | mittel (Verdacht) | Heute | Leere Essenszeit per Opazität gedimmt, etwa 3:1. | behoben |
| U11 | mittel | Einkaufsliste | Textlink "Preis ändern" je Zeile lässt Namen auf vier Zeilen brechen; "geschätzt" dreifach; Leerraum neben Checkbox. | behoben |
| U12 | mittel | Rezept neu @320 | "Fertig gekocht" ohne Einheit; "manuelle Zutat" klein; "2,0 Portionen". | behoben |
| U13 | niedrig | Stepper, Tonal-Chips | Text auf Tint 4,45:1 statt Token `--nt-accent-on-tint`. | behoben |
| U14 | niedrig | Eintragen-Sheet | Titel "Zu Snacks"; Chips "Früh/Mittag/Abend" gegen "Frühstück/Mittagessen/Abendessen". | behoben |
| U15 | niedrig | Einkauf leer, Mahlzeiten leer | Wortwahl gegen Glossar (eintragen/hinzufügen). | behoben (Wortlaut "Hinzufügen" im Einkauf bewusst belassen) |
| U16 | niedrig | Tagebuchzeile @320 | Legende bricht zwischen "F" und Wert. | behoben |
| U17 | niedrig | Tagebuch | Drei Hinzufügen-Wege je Essenszeit, Leerraum in leeren Karten. | behoben |
| U18 | niedrig | Wochenansicht | Balken und Ziellinie ohne Werte; "EIWEISS"; Leertext "Mittel über 0 Tage". | behoben |
| U19 | niedrig | Einkauf-Tab | Kopf "Einkaufsliste" gegen Tab "Einkauf". | behoben |
| U20 | niedrig | Wochenplan-Setup | "Tage" mit Segment und Stepper doppelt. | behoben |
| U21 | niedrig | Wochenplan-Karten | Chevron und Menü nebeneinander; "2 / Portionen" bricht. | behoben |
| U22 | niedrig | Einkauf-Add-Sheet | Voreinstellung "1 g". | behoben |
| U23 | niedrig | Fastfood-Helfer | Slider-Ticks als Zackenlinie; "1500 kcal" ohne Trenner; blasse Beschriftung. | behoben |
| U24 | niedrig | Rezeptkarte | "≥ Mindestwerte: 4 Zutaten ohne Werte" unverständlich. | behoben |
| U25 | niedrig | Essen beschreiben | Chips-Reihe anders eingerückt als im Eintragen-Sheet. | behoben |
| U26 | niedrig | Profil, Einkauf | Tonal-Pillen nicht volle Breite (gegen DESIGN.md). | behoben |
| U27 | niedrig | Profil, Daten | "Alle lokalen Daten zurücksetzen" direkt unter "Backup importieren". | behoben |
| U28 | niedrig | Datenschutz-Sheet | Titel doppelt. | behoben |
| U29 | niedrig (Verdacht) | Tagebuch | Eintragszeile `outline: none`, Fokusring unklar. | behoben |

Nicht prüfbar im Audit: Suchtreffer, Barcode/Etikett, Online-Rezepte, Undo-Toast, Offline-Banner, Safe Area, echtes iOS, 150 % Schrift bei 320.

## Prüfrunden 2 bis 6 (Gegenprüfung der Korrekturen)

| Runde | Befunde | Inhalt | Status |
|---|---|---|---|
| 2 | 2 hoch, 9 mittel | Unvollständige Korrekturen aus Runde 1: falsche "Verwerfen?"-Rückfrage nach "Essen beschreiben", Undo-Toast für Rezepte/Mahlzeiten, Export-Fehler, Profil-Sheet beim Speichern, Migrationsfehler als eigenes Signal, ungesicherte Schlüssel, `assessKcal` (Alkohol, Polyole, Ballaststoffe), Rezept-Reparatur statt Quarantäne, Gewicht runden/zusammenführen, Einkaufs-IDs. | behoben; alter automatischer Gewichtswert (R3-Rest) bewusst offen |
| 3 | 5 mittel, 7 niedrig | Banner "gesichert" trotz gescheiterter Quarantäne, Erfolgsmeldung bei ungesichertem Schlüssel, `flush()` löscht Fehler, kJ im kcal-Feld, `servings: null`, `isAtwaterDoubtful` ohne Alkohol/Ballaststoffe, `escapeRegex`, Gewicht ohne Rückrollen, Migrationsfehler nach Reset/Import, `grant` ohne Ergebnisprüfung, E2E-Timing. | behoben; `DiaryStore.add` ohne Rückrollen (alle Aufrufer prüfen vorher die Sperre), übrige Stores nur gesperrt, nicht zurückgerollt |
| 4 | 2 mittel, 4 niedrig | Fastfood-kcal zu hoch für die Makros, Zustimmungsdialog ohne Meldung bei Schreibsperre, wiederholte Quarantäne bei Migrationssperre, fehlender Knopf "Neu laden", Gewicht-Undo ohne Sperrprüfung, Zweifel-Markierung bei Ballaststoffen und 0/0/0. | behoben |
| 5 | 1 mittel, 3 niedrig | Verworfene Datensätze nach aufgehobener Migrationssperre ohne Quarantäne überschreibbar; 0 kcal im Fastfood-Helfer verworfen. | behoben; Bier/Wein im Fastfood-Helfer und "bitte prüfen" bei Spirituosen bewusst so |
| 6 | 1 niedrig | Nach nachgeholter Quarantäne blieb der Rohschlüssel unbereinigt (doppelter Quarantäne-Eintrag beim nächsten Start). Sonst kein bestätigter Befund. | behoben |

Endstand 2026-11-16: tsc und Lint sauber, 220 Testdateien / 2390 Unit-Tests, 241 Worker-Tests, 5 Skript-Tests, Build ohne Budget-Warnung. Nichts committet, Worker nicht ausgerollt.

Bewusst offen: S1-Rest (Tagesdeckel je IP), S2, S4, S9 (SHA-Pinning), S10, D16, D17, P10, K23, T21, R3-Rest, gespeicherte Mahlzeiten ohne Reparatur, `CONSENT_VERSION` trotz erweitertem Zustimmungstext nicht erhöht, docs/KI-WORKER.md ohne die neuen Fehlerformate, Aufteilung der drei größten Dateien (add-entry-sheet 738, recipes.page 665, shopping.page 643 Zeilen).

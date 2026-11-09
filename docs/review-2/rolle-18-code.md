# Rolle 18: Codequalitaet, Architektur, Tests (Runde 2)

Stand: 2026-11-09. Code-Lektuere plus `eslint`-Lauf; App nicht gestartet. Nicht doppelt gemeldet: alles aus REVIEW-ERGEBNIS.md.
Positiv: 96 Spec-Dateien, Worker-Tests, CI mit tsc, ng test, Worker-Test, Versionscheck; `ShoppingStore.generate` und `computeTargets` sind entfernt; zentrale Gewichtstabelle in `units-weight.ts`.

F1. Lint ist rot und nicht in CI. `npx eslint src` meldet 8 Fehler: `component-selector` verlangt Prefix "app" (eslint.config.js:17-23), Komponenten nutzen "nt-" (shared/stepper/stepper.component.ts:10, food-search.component.ts:18, food-sources.component.ts:46); dazu `eqeqeq` in shopping.page.html:205. Auswirkung: Lint ist totes Werkzeug, echte Verstoesse gehen unter. Vorschlag: Prefix auf "nt" setzen, `!=` fixen, `ng lint` als CI-Schritt. Aufwand S. Prioritaet hoch.

F2. E2E laeuft nie automatisch. 8 Playwright-Specs (e2e/specs), aber kein CI-Schritt und kein npm-Script; Start erwartet manuell laufenden Server auf :4300 (e2e/run.mjs:14-20). Auswirkung: Riskanteste Pfade (Tagebuch, Undo, Import) sind nur bei Disziplin geschuetzt; der Deploy-Job `build` (main) ist davon unabhaengig. Vorschlag: `npm run e2e` gegen statisch ausgelieferten Build, Playwright in CI, Smoke-Subset als Pflicht vor Deploy. Aufwand M. Prioritaet hoch.

F3. Die groessten Dateien haben keine Unit-Tests: recipes.page.ts (757 Z., ca. 62 Methoden: Formular, Import, Kochmodus, Tagebuch-Logging in einer Klasse), add-entry-sheet.component.ts (666 Z., 37 Methoden), diary.page.ts (479), settings.page.ts (464), dashboard.page.ts (256); diary.store.ts nur Integritaets- und Copy-Specs. Auswirkung: Welle 3 (Hero/Protein) trifft ungetesteten Code; nahe an der 800-Zeilen-Grenze. Vorschlag: recipes.page in `RecipeFormState` (reine Funktionen: amountText, setFact, isDirty, total) und `RecipeImportFlow` zerlegen, dann mit Vitest testen; add-entry-sheet in Suche, Scan, Schnelleintrag trennen. Aufwand L. Prioritaet hoch.

F4. Kein Schema-Versionsstand im Laufzeitspeicher. Backup hat `BACKUP_VERSION` (core/backup/backup.ts:34,93,104-108), `StorageService` (core/storage/storage.service.ts) nicht; `catch {}` an 8 Stellen darin (u. a. :43,:75,:86,:103,:139) schluckt Schreibfehler, statt sie als Signal nach oben zu geben (Ursache von QAE-02). Auswirkung: Jede Modellaenderung (Gewicht, Favoriten, Zielanpassung, neue Protein-Regeln) kann Altdaten still auf Defaults setzen. Vorschlag: `schemaVersion`-Key plus Migrationsliste, `StorageService.lastError` als Signal fuer Toast. Aufwand M. Prioritaet hoch.

F5. Fixes ohne Reproduktion: Welle-1-Bugs (QAD-02, -05, -06) liegen im Zusammenspiel Seite/Store; es gibt nur diary-helpers.spec.ts fuer die Seite. Vorschlag: pro Fix zuerst roten Test (diary.spec.mjs oder Page-Spec), dann Fix. Aufwand S je Fix. Prioritaet hoch.

F6. Zwei parallele Einheiten-Welten: `core/nutrition/units-weight.ts` (UNIT_WEIGHT_G, `canonicalUnitKey`) gegenueber `core/shopping/units/*`, `shopping-units.ts`, `package-size.ts:2,54` mit eigenen Regeln (`ONION_PIECE_G`, `gramsPerPiece`). `canonicalUnitKey` wird nur im Nutrition-Pfad genutzt (ingredient-estimate.ts:118). Auswirkung: Dieselbe Zutat bekommt je Pfad andere Gramm, neue Einheit an drei Orten zu pflegen. Vorschlag: ein Modul `core/units/` (canonical, gramsOf, format), vorhandene Specs als Charakterisierungstests behalten. Aufwand M. Prioritaet mittel.

F7. Template ruft viele Methoden statt Signals/`computed` (recipes.page.ts:158-370: metaLine, amountText, kcalOf, factsOf, isIncomplete, total, perServing, missingCount). Auswirkung: Rechenarbeit pro Change-Detection, bei 15+ Zutaten auf aelteren iPhones spuerbar; erschwert Tests. Vorschlag: Zutaten als `signal`, Ableitungen als `computed`, Zeile als eigene OnPush-Komponente. Aufwand M. Prioritaet mittel.

F8. global.scss hat 1099 Zeilen (Block-Kommentare bei 415, 640, 830) und 8 `!important`; dashboard.page.scss 456, diary.page.scss 331. Auswirkung: Design-Aufraeumen (UID/DSY/THM) wird teuer, Regressionen unsichtbar. Vorschlag: in Partials (`_sheet`, `_buttons`, `_lists`, `_utilities`) per `@use` schneiden, ohne Verhaltensaenderung. Aufwand M. Prioritaet mittel.

F9. Kein globaler `ErrorHandler`, 21 `catch {}` ohne Log (u. a. backup.service.ts:52, label-scan.ts:77, open-prices.provider.ts:46, spoonacular.mapper.ts:153). Auswirkung: Absturz oder stiller Fehler im TestFlight hinterlaesst keine Spur. Vorschlag: `ErrorHandler`, der die letzten 20 Fehler im Debug-Bereich (settings/debug-flag.ts) ablegt; `catch {}` durch `reportSilent(e, 'kontext')` ersetzen. Aufwand S-M. Prioritaet mittel.

F10. E2E-Selektoren haengen an Texten und Ionic-Shadow-DOM (e2e/lib/ionic.mjs), 3x `waitForTimeout`. Begriffs-Umbenennung (E2) und Welle 4 brechen sie. Vorschlag: `data-testid` an Primaeraktionen und Tabs, in den Specs bevorzugen, bevor Texte geaendert werden. Aufwand S-M. Prioritaet mittel.

F11. Vor Welle 5 fehlt eine gemeinsame reine Aggregation: Wochenansicht, 7-Tage-Mittel, Serie und adaptives Ziel brauchen dieselben Tagessummen; `models/index.ts` (218 Z.) und `diary.store.ts` (321 Z.) haben keine Aggregations-API, `weight/` ist getrennt vom Tagebuch. Vorschlag: `dailyTotals(entries, range)` in core mit Tests als einzige Quelle; nicht in Komponenten rechnen. Aufwand M. Prioritaet mittel.

F12. Coverage ist nicht konfiguriert (kein `coverage` in angular.json/package.json), obwohl docs/TESTING.md "80 %" nennt. Vorschlag: `ng test --coverage` mit Schwelle fuer `src/app/core/**` in CI, UI ausnehmen. Aufwand S. Prioritaet niedrig.

## Fragen an andere Rollen
1. An Release/CI: Soll der Pages-Deploy erst nach E2E-Smoke laufen, und genuegt Chromium, obwohl das Ziel iOS-WebKit ist?
2. An Produkt/Coach: Darf `dashboard.page.ts` (ohne Spec) vor dem Hero-Umbau (PM-01/03) in `computed`-Selektoren zerlegt werden, ohne dass sich die UI aendert?
3. An Nutrition/Daten: Duerfen wir ein versioniertes Storage-Schema einfuehren, bevor E3/E4 gespeicherte Profile mit neuen Protein-Regeln still neu berechnen?

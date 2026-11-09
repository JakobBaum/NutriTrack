# Umsetzung Review 2

## Welle A (Datensicherheit)

Stand 2026-11-09, Branch `review2-wellen`, nicht committet. Verifikation: tsc sauber, `ng test` 110 Dateien / 1095 Tests grün, `ng build` erfolgreich (nur die bekannten tesseract-ESM-Warnungen).

### 1. Schema-Version
- `core/storage/storage-schema.ts` (+spec): Key `schemaVersion`, `CURRENT_SCHEMA_VERSION=1`, `applyMigrations` (reine Kette, wiederholbar; Altdaten gelten als Version 0). Daten aus neuerer Version setzen `schemaNewer` (Banner). Kein Sharding.

### 2. Fehler und Retry
- `core/storage/storage.service.ts` (Umbau): `pending` wird erst nach erfolgreichem `setItem` geleert. Bei Fehler `lastError` (quota/unavailable/unknown), Retry nach 5 s und 60 s, danach manuell (`retryNow`) oder bei neuem `set`. `remove`/`clearAll`/Lesefehler werden geloggt. `snapshot()` enthält ungeschriebene Werte.
- `core/storage/storage-messages.ts`: deutsche Meldungen mit Backup-Hinweis.
- `status-banner/` (neu, in AppModule): dauerhaftes Banner (role=alert) mit "Backup exportieren" und "Erneut versuchen"; zusätzlich Hinweis bei neuerer Schema-Version und bei aussortierten Datensätzen. `AppComponent` hat keinen Toast mehr.

### 3. Sanitizing und Quarantäne
- `core/state/record-sanitize.ts`, `core/backup/backup-sanitize.ts`: Meta-Felder (id, createdAt, meal, label, Tag aus createdAt) werden repariert, unbrauchbare Nährwert-Datensätze in `quarantine.<quelle>.<zeit>` verschoben (max. 10, nicht im Backup). Nährwerte werden nie erfunden.
- Stores (Diary, Favoriten, Meals, CustomFood, Recipe) laden über `getSanitized`; `DiaryStore.add/restore` validieren. Backup-Import ist nachsichtig (`cleanup: repaired/skipped/quarantined`) statt Totalablehnung.

### 4. Auto-Sicherung
- `core/backup/backup-safety.ts`, `backup.service.ts`: Snapshot (Key `autosnapshot`) vor Import, Wiederherstellung und Reset; bei Quota-Fehler Import ohne Snapshot und Hinweis. Reset setzt das letzte Backup-Datum zurück.
- `settings.page.*`: Reset-Dialog mit "Backup zuerst", Import-Dialog mit "Erst Backup exportieren", Zeile "Automatische Sicherung" (wiederherstellen/verwerfen).

### 5. Backup-Hinweis und Persistenz
- `core/backup/backup-reminder.ts`, `shared/backup-reminder/`: dezenter Hinweis im Dashboard (14 Tage mit neuen Einträgen, 50 neue Einträge, oder 7 Tage alte Einträge ohne je ein Backup; "Später" = 3 Tage, Key `backupReminderSnooze`).
- `core/storage/storage-persistence.service.ts`: `navigator.storage.persist()` beim Start (try/catch); Ablehnung wird geloggt und im Hinweis erwähnt.

### 6. Resume
- `core/app-resume/app-resume.service.ts`: `@capacitor/app` `appStateChange` plus `visibilitychange`; Zähler-Signal. Dashboard und Tagebuch reagieren per effect mit `refreshToday()`; die `@HostListener` entfielen.

### Offene Punkte
- Quarantäne-Daten haben keine UI zum Ansehen/Exportieren/Wiederherstellen.
- Gewicht-Store: Rejects werden nicht quarantänisiert (nur beim Import gezählt).
- Persistenz-Backend (Sharding/SQLite) bewusst nicht entschieden.
- Nicht auf einem Gerät getestet (nativer `appStateChange`, echter Quota-Fehler, `persist()` in WebView); kein E2E-Lauf.
- Das Banner liegt fix über der Statusleiste und wurde nicht visuell geprüft (Safe-Area, Dark Mode).

## Welle B (Eintragen und Heute)

Stand: 2026-11-09, Branch `review2-wellen`, nicht committet.

### Eintragen-Sheet
- Bleibt nach Schnell-Eintrag (Chip, Favorit, Zuletzt benutzt, Rezept, Mahlzeit) offen. Toast mit Essenszeit, kcal und Eiweiß ("In Frühstück eingetragen · 250 kcal · 18 g Eiweiß", `diary/entry-message.ts`), Rückgängig passt den Zähler an, 400 ms Sperre gegen Doppeltipp. Kopfzeilen-Knopf heißt "Fertig" nach dem ersten Eintrag, sonst "Abbrechen". Speichern aus dem Formular schließt das Sheet weiterhin.
- Autofokus nur ohne Schnellauswahl (Favoriten, Zuletzt benutzt), damit die Tastatur die Auswahl nicht verdeckt.
- "Zuletzt benutzt" nach Essenszeit gefiltert (`DiaryStore.recentFoods(limit, meal)`: gleiche Essenszeit zuerst nach Häufigkeit der letzten 30 Tage, danach der Rest nach Aktualität).
- Eiweiß in den Listenzeilen (`nt-food-row`, Favoriten, Zuletzt, Rezepte, Eigene, Mahlzeiten) in `--nt-protein`.
- Nur-kcal-Schnelleintrag (Label "Schnell-Eintrag", wird nicht als eigenes Lebensmittel gemerkt). Vorschau mit zwei großen Zahlen.
- OFF-Portion: `plausibleServingG` (1 bis 1000 g), erste Menge-Chip ist die Packungsportion ("Portion").
- Fehler beim Speichern erscheinen als Banner im Sheet (der globale Banner liegt hinter dem Modal).

### Heute
- Hero: Schrift `clamp(30px, 11vw, 48px)`, "über Ziel" als eigene Zeile, einheitlicher Zusatz "noch" für kcal und Eiweiß.
- Keine 45-%-Abdunklung mehr am leeren Tag. Die vier kleinen Ringe sind kompakte Mini-Balken (Zucker rot bei Überschreitung, alle öffnen den Drill).
- Wochenstreifen (`dashboard/week-strip.*`, Logik `proteinStripStates` mit Schwelle der Wochenansicht: erreicht ab 90 %, teilweise ab 50 %).
- Gewichtskachel erst nach dem ersten Eintrag des Tages und nur am heutigen Tag; öffnet das aus der Gewichtskarte herausgelöste `app-weight-sheet`.
- Tagebuch: Kopfkarte mit Eiweiß (gegessen, noch X g), `E x g` in `--nt-protein`.

### Eingabefelder
- Kein stilles 0 mehr: `parseNutrientInput` (leer = ok, ungültig oder negativ = Feldfehler "Zahl eingeben, z. B. 12,5") in manueller Mahlzeiten-Eingabe, Einkauf (Menge, Preis, Preis ändern behält die Eingabe und fragt erneut).
- iOS: "Fertig"-Leiste über der Zahlentastatur (`@capacitor/keyboard`, nur iOS), `autocapitalize="words"`/`autocorrect="off"` auf Namensfeldern, `enterkeyhint` nur noch mit Enter-Handler, Inhalt wird beim Fokus markiert (`selectAllOnFocus`: Mahlzeiten, Einkauf).

### Bewusst unverändert
Fastfood-Block, fünf Tabs, Hardware-Zurück, Widget, Health, `nt-input`, Sheet-Breakpoints.

### Offene Punkte
- Fertig-Leiste, Tastatur und Autofokus nicht auf einem Gerät geprüft.
- `selectAllOnFocus` nicht in Rezept-Feldern und im Tagebuch-Bearbeiten-Dialog; Rezeptfelder zeigen keine Feldfehler (Fehlerbehandlung dort unverändert).
- Speichern aus dem Formular schließt das Sheet weiterhin (nur Schnell-Einträge bleiben offen).

## Welle C (Profil und Ziele)

### Gemacht
- Profil als eigenes Sheet `settings/profile-sheet/*` (Logik in `profile-form-state.ts`, rein und unveränderlich). Das Formular lädt bei jedem Öffnen frisch aus dem gespeicherten Profil (Reset und Import zeigen keine alten Werte). Speichern-Button immer aktiv, Fehler stehen am Feld, Fokus springt zum ersten fehlerhaften Feld.
- Einrichtungslink `?setup=1`: `settings/setup-link.ts` plus `NavigationEnd`-Abo in `SettingsPage` (greift auch bei der von Ionic gecachten Seite); der Parameter wird per `replaceUrl` entfernt.
- Live-Vorschau (kcal und Eiweiß, klebt oben im Sheet) ändert sich beim Tippen und Wählen.
- Manuelles Ziel (Automatisch/Manuell): kcal 1.000 bis 6.000, Eiweiß 1,2 bis 2,4 g pro kg (Hinweis ab 2,2). Fehlertext am Feld statt stillem Begrenzen (`core/nutrition/manual-target.ts`). "Auf Formel zurücksetzen" und Rückkehr zu Automatisch entfernen die Werte. `NutritionCalcService.dailyTarget` bleibt die einzige Stelle der Berechnung; die Mindestzufuhr gilt nicht für manuelle Werte.
- Aufbau-Tempo: Überschuss mit 7700 kcal/kg, Deckel 0,5 % Körpergewicht pro Woche (Abnehmen weiter 1 %), Chips 0,1/0,25/0,4 kg (Aufbau) und 0,25/0,5/0,75 kg (Abnehmen).
- Zucker: Ring und Karte heißen "Zucker gesamt (Richtwert)"; Überschreiten färbt nicht mehr rot; Drill-Sheet erklärt freien gegen Gesamtzucker (`macroNote`).
- Adaptives Ziel nur als einmaliger Hinweis nach Gewichtsänderung (`shouldShowDriftHint`, Ausblenden merkt sich das Gewicht in `WeightStore`), nie automatisch gespeichert.
- "KI-Verbindung" ersetzt durch reine Anzeige `ai-status-row` (Verbunden / Nicht erreichbar / Prüfe...), Anleitung und Hilfe auf "KI-Status" umgestellt.
- Disclaimer der Zielkarte umformuliert (Startwert, nach 2 bis 3 Wochen mit dem Gewichtsverlauf vergleichen).

### Dateien
Neu: `core/nutrition/manual-target(.spec).ts`, `core/nutrition/nutrition-calc.goals.spec.ts`, `settings/profile-sheet/*`, `settings/setup-link(.spec).ts`, `settings/ai-status-row/*`. Geändert: `nutrition-calc.service.ts`, `core/models/index.ts`, `weight-math(.spec).ts`, `weight.store(.spec).ts`, `weight-card.*`, `dashboard-math(.spec).ts`, `dashboard.page.*`, `settings.page.*`, `settings.module.ts`, E2E `app.spec.mjs`, `search.spec.mjs`.

### Offene Punkte
- Nichts auf einem Gerät geprüft (Tastatur, Sheet-Verhalten).
- Imperial-Einstellung gilt nicht für Körperwerte.
- Kein Dirty-Guard beim Schließen des Sheets, kein Minderjährigen-Block, kein Hinweis auf Kohlenhydrate unter 2 g/kg.
- Texte "Profil › KI-Verbindung" in `fastfood-form.component.html` und `core/ai/ai-errors.ts` bleiben (Welle E).

## Welle D (Bedienung und Barrierefreiheit)

### Gemacht
- Löschen und Doppelt eintragen sichtbar: jede Tagebuch-Zeile hat einen "Mehr"-Knopf (`data-testid="entry-more"`, 44 px) mit Action-Sheet Bearbeiten / Doppelt eintragen / Löschen / Abbrechen (`diary/entry-menu.ts`, Buttons rein und getestet). Wischen bleibt. Der Bearbeiten-Dialog hat zusätzlich "Doppelt eintragen". Einkaufsposition: "Position löschen" im Preis-Dialog (auf Touch war der Hover-Knopf unsichtbar). Mahlzeiten und Zutaten löschen weiter per Wischen.
- Dynamic Type: alle `--nt-fs-*` und 54 weitere `font-size`-Angaben von px auf rem (Icons bleiben px). Ionic setzt auf iOS `-apple-system-body`, daher skaliert rem mit der Systemschrift. Hero, Tab-Labels, Segmente und Chips umbrechen oder werden begrenzt (`clamp`, `min`), geprüft mit `html{font-size:150%}`.
- VoiceOver: E/KH/F in der Tagebuch-Zeile als `aria-hidden`-Kürzel plus unsichtbarer Volltext (Eiweiß, Kohlenhydrate, Fett); dasselbe bei "Kohlenh." und "Ballast." in Rezepten, Online-Suche und Wochenrezept.
- Druck-Zustand global (`:active`: Deckkraft und leichtes Eindrücken) für Buttons, Tab- und Segmentknöpfe, `.ff-btn`, Karten-Links.
- Abhaken im Einkauf: leichter Haptik-Impuls (`lightHaptic`) und weicher Übergang (Farbe, Deckkraft, Durchstreichen).
- Reduced Motion zur Laufzeit: `core/motion/reduced-motion.ts` hört auf die Media-Query und setzt Ionic `animated` live (`AppComponent`); CSS-Regel gab es schon.

## Welle E (Navigation, Einkauf, Texte)

### Gemacht
- Query-Parameter werden einmal gelesen und dann entfernt (`core/navigation/query-params.ts`: `pickParam`, `clearQueryParams`): `?view=` in Rezepte (`recipes|meals`) und Einkauf (`plan|list`), `?open=recipe-search` öffnet das Rezeptsuche-Sheet in den Einstellungen. Der Einkauf-Hinweis verlinkt dorthin.
- Plan zur Liste: Schaltfläche "Einkaufsliste öffnen (n Positionen, m offen)" in der Plan-Zusammenfassung. "Erneut übersetzen" (`WeekPlanService.retryTranslation`) bei nicht übersetzten Rezepten.
- Sackgasse im Plan: Wochenrezept-Sheet bekommt "In Tagebuch eintragen" (Essenszeit-Auswahl, eine Portion, Toast mit Rückgängig; `weekRecipeToDiaryEntry`).
- Falsche Hinweise entfernt: "Profil > KI-Verbindung" (Fastfood-Formular, `ai-errors.ts`, Rezepte), jetzt "KI-Status ansehen". Spoonacular-Schlüsselhinweise bleiben, das Feld gibt es noch. Anleitung in den Einstellungen auf die fünf Tabs umgeschrieben.
- Fehler- und Zustandskatalog `core/messages/state-messages.ts`: Satz 1 sagt, was los ist, Satz 2 (Du-Imperativ) was zu tun ist, nur Punkte. Genutzt von KI-, Lebensmittel-, Spoonacular- und Import-Fehlern. Bestehende Specs auf die neuen Texte angepasst.
- `--nt-protein` durchgängig: Rezept-Makros, Online-Suche, Zutaten- und Portionswerte, Profil-Ziel, Eintragen-Vorschau.
- Gemeinsamer Seitenkopf `nt-page-header` (SharedModule) auf Tagebuch, Rezepte, Einkauf und Profil; Heute behält die Datumsleiste als Kopf.

### Bewusst unverändert
Fünf Tabs, Fastfood-Block, Sheet-Breakpoints.

### Offene Punkte
- Nichts auf einem Gerät geprüft (Haptik, VoiceOver, echte Dynamic-Type-Stufen; Großschrift nur per `font-size:150%` simuliert).
- Mahlzeiten- und Zutatenliste: Löschen auf Touch nur per Wischen.
- `recipes.page.scss` liegt 28 Byte über dem Stilbudget (Warnung, kein Fehler).
- Heute hat keinen `nt-page-header` (Datumsleiste statt Titel).

## Welle F und Worker (Qualität, Härtung) – 2026-11-09

### Qualität
- Lint grün (`npm run lint`): Selektor-Präfix `nt` in `eslint.config.js` erlaubt, Template-Vergleich in `shopping.page.html` auf `typeof` umgestellt. Lint läuft im CI-Job `ci` vor den Unit-Tests.
- E2E im CI: neuer Job `e2e` (Playwright 1.64.0 außerhalb des Repos via `NT_PLAYWRIGHT_DIR`, Chromium mit Systemabhängigkeiten, Produktions-Build, `e2e/serve-static.mjs` mit SPA-Fallback auf Port 4310). `build` (Deploy) hängt jetzt von `ci` und `e2e` ab. Die YAML wurde nur per Durchsicht geprüft, nicht ausgeführt.
- Stilbudget: `recipes.page.scss` durch Entfernen einer doppelten 359px-Media-Query unter das Budget gebracht (Budget unverändert).
- Neue Logikmodule mit Specs: `recipes/recipe-form`, `recipes/recipe-sheets`, `diary/add-entry-sheet/add-entry-logic`, `diary/diary-day`, `settings/settings-view`. Dabei Fehler gefunden und behoben: `goalLabel('toString')` lieferte über den Prototyp einen Wert (jetzt `Object.hasOwn`).
- Große Dateien zerlegt, Verhalten unverändert: `recipes.page.ts` 759 auf 624 Zeilen, `add-entry-sheet.component.ts` 723 auf 677, `global.scss` in `src/styles/foundation.scss`, `overlays-and-polish.scss`, `ios-patterns-and-fixes.scss` (Reihenfolge in `angular.json`).

### CSP
- Angulars `autoCsp` blockierte WebAssembly im Tesseract-Blob-Worker (OCR war im Produktions-Build kaputt). `autoCsp` entfernt, eigene Meta-CSP in `src/index.html` (u. a. `wasm-unsafe-eval`, `worker-src blob:`, `connect-src` für Worker, OFF, Spoonacular-Bilder), `inlineCritical:false` gegen Inline-Skripte.
- E2E `e2e/specs/csp.spec.mjs`: keine Verstöße beim Laden, Tesseract-Core läuft im Blob-Worker (rot unter `autoCsp`, grün mit eigener CSP).

### Worker (nur Code und Tests, kein Deploy)
- Tageslimit fail-closed: ist `DAILY_KV` gebunden, aber nicht erreichbar (get/put-Fehler), antwortet der Worker mit 503 und `Retry-After: 60`, ohne Upstream-Aufruf. Ohne Binding bleibt es fail-open; `/health` weist darauf hin.
- Foto-Aufrufe (`recognizeLabel`, `importRecipe` mit Bild) zählen doppelt (`PHOTO_CALL_WEIGHT = 2`).
- 5 neue Worker-Tests, gesamt 77.

### Verifikation
tsc sauber, Lint sauber, 127 Dateien / 1238 Unit-Tests grün, `ng build` nur Tesseract-ESM-Warnungen (keine Budget-Warnung), Worker 77/77, E2E 37/37 gegen den Produktions-Build.

### Offene Punkte
- Worker nicht deployt; fail-closed greift erst nach Deploy.
- CI-YAML (Lint, E2E-Job) nie auf GitHub gelaufen.
- Gerätetest weiterhin offen.

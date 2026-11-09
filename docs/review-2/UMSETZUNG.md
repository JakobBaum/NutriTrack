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

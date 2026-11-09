# Review 2: Synthese (20 Rollen, 2 Runden)

Quellen: `rolle-NN-*.md` (Runde 1) und `diskussion-rolle-NN.md` (Runde 2) in diesem Ordner.
Alles beruht auf Code-Lektüre. Nur Rolle 06 (Design) und Rolle 16 (Performance) haben die App tatsächlich laufen lassen. Nichts wurde auf einem Gerät geprüft.

## Konsens (fast alle Rollen nennen es in ihrer Top-5)

1. **Datensicherheit zuerst.** Das Tagebuch liegt in einem localStorage-Schlüssel. Schreibfehler werden still verschluckt (`flush()` leert vor dem Schreiben), Laden und Import prüfen keine Felder (fehlendes `createdAt` crasht Heute), es gibt keine Schema-Version und kein Auto-Backup. iOS garantiert localStorage nicht dauerhaft.
2. **Eiweiß gleichrangig zu Kalorien**, besonders im Hero "noch Z g Eiweiß", im Tagebuch-Kopf, in Toasts und in Listenzeilen.
3. **Schneller Eintragen.** Zwei Taps, Sheet bleibt nach Schnell-Eintrag offen, nur-kcal-Eintrag, "Gestern kopieren", OFF-Portionsgröße.
4. **Profilformular reparieren.** Nach Reset oder Import Altwerte, Setup-Link öffnet evtl. nicht, keine Live-Zielvorschau, kein manuelles Ziel.
5. **Tastatur und Eingaben.** Fertig-Leiste für den Zahlenblock (kein Return auf iOS), `autocapitalize`, Feldfehler statt stillem 0.

## Umsetzungsvorschlag in Wellen

| Welle | Inhalt | Anmerkung |
|---|---|---|
| A Datensicherheit | Schreibfehler sichtbar plus Retry mit Backoff, Schema-Version, Sanitizing/Quarantäne beim Laden, Auto-Sicherung vor Import/Reset/Restore, Backup-Erinnerung plus `storage.persist()`, Tageswechsel bei App-Resume (`appStateChange`) | Reihenfolge laut Rolle 20: Schema-Version, dann Persistenz, dann Shards |
| B Eintragen und Heute | Hero "noch Z g Eiweiß", Schnell-Eintrag, Sheet offen nach Schnell-Eintrag, Toast mit Essenszeit/kcal/Eiweiß, OFF-Portion, Autofokus nur ohne Favoriten/Zuletzt, Eiweiß in Listen und Tagebuch-Kopf, Wochenstreifen auf Heute | Sheet-Breakpoints erst nach Test auf iPhone SE |
| C Profil und Ziele | Formular frisch laden, Setup-Link-Fix, Live-Zielvorschau, manuelles Kcal-/Eiweiß-Ziel, Aufbau-Tempo (Überschuss zu hoch), Zucker-Ring (freier Zucker gegen Gesamtzucker) | Eiweiß-Override mit Feldgrenzen in g/kg |
| D Bedienung und Zugänglichkeit | Löschen/Duplizieren sichtbar (auf dem iPhone fehlt der Button), rem-Schriftskala für Dynamic Type, VoiceOver für E/KH/F, Press-States, Haptik und Übergang beim Abhaken | Reduced Motion mitziehen |
| E Navigation, Einkauf, Texte | Query-Parameter verbrauchen, Plan-zu-Liste-Link plus Retry für Übersetzung, falsche Hinweise (KI-/Spoonacular-Schlüssel) entfernen, Eiweiß-Farbe durchgängig, gemeinsamer Seitenkopf, Fehler-/Zustandskatalog | Tabs bleiben bei fünf |
| F Qualität | Lint grün (8 Fehler) und in CI, E2E in CI, große Dateien zerlegen, Tests für recipes/add-entry/diary/settings | Vor Wellen mit viel Umbau |
| Worker | Tagesdeckel (KV, siehe unten) fail-closed, Foto-Aufrufe gewichten, Meta-CSP | CSP braucht `wasm-unsafe-eval` und `worker-src blob:`, sonst bricht Tesseract |

## Offene Konflikte (Entscheidung bei Jakob)

1. **Vier statt fünf Tabs** (Rolle 20) gegen Beibehaltung (Rolle 05, 06, 10, 12). Mehrheit: bei fünf bleiben, Umbenennung "Einkauf" in "Woche/Plan" und "Profil" in "Ich" erst nach der Strukturentscheidung.
2. **Fastfood-Block**: streichen (Rolle 20), nur abends auf Heute (Rolle 02), erklären (Rolle 08). Designregel verbietet Entfernen (Rolle 06).
3. **Gewichtskachel auf Heute**: Rolle 10/11 dafür, Rolle 01 nur nach dem ersten Eintrag. Kein neuer Tab.
4. **Sheet offen nach Eintrag** (Rolle 03) gegen Einzel-Toast (Rolle 09). Kompromiss: Fehler als Banner, Info und Undo als Toast.
5. **Adaptives Ziel**: Rolle 20 streichen, Rolle 12/19 Kompromiss: einmaliger Hinweis nach Gewichtsänderung, nie automatisch speichern.
6. **Ziel-Moment** (Rolle 09): nur ruhig und neutral, ohne Lob, an Reduced Motion gekoppelt.

## Verschieben (kein Widerspruch zwischen den Rollen)

Widget, Apple Health, Passphrase-Backup, Service Worker, Listen-Virtualisierung, Budget auf 800 kB, Hardware-Back, globaler Pull-to-Refresh, Monatsshards und Offline-Basisdatenbank bis Entscheidung E8, Erinnerungen und Serien-Ausbau, Mehrschritt-Assistent im Erststart.

## Nicht doppelt umsetzen

Rolle 04 F7 (Zuletzt/Favoriten) wurde zurückgezogen, beides gibt es im Add-Sheet. Rolle 19 F8 (Salz) zurückgezogen. Rolle 14 F1 korrigiert (Zahlenblock hat keine Return-Taste, Lösung ist die Fertig-Leiste).

## Dinge, die Jakob selbst tun muss

- Cloudflare-KV `DAILY_KV` anlegen und in `wrangler.toml` eintragen (Tagesdeckel ist derzeit nicht aktiv, Worker läuft ohne Tageslimit).
- Echte Tests auf dem iPhone: Tastatur/Fertig-Leiste, Sheets, Dynamic Type, VoiceOver, Wochenplan mit echtem Spoonacular-Key.

## Entscheidungen Jakob (2026-11-09)

- Fastfood-Block: unveraendert lassen.
- Gewichtskachel: auf Heute, erst nach dem ersten Eintrag des Tages. Kein neuer Tab.
- Eintragen-Sheet: bleibt nach Schnell-Eintrag offen, Bestaetigung als Toast (Essenszeit, kcal, Eiweiss), Fehler als Banner.
- Adaptives Ziel: einmaliger Hinweis nach Gewichtsaenderung, nie automatisch speichern.
- Tabs: bleiben bei fuenf (Mehrheit der Rollen); Umbenennung erst spaeter.
- Umsetzung: Wellen A bis F nacheinander auf Branch review2-wellen.

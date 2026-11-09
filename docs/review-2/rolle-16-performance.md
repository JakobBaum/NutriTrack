# Rolle 16: Laufzeit-Performance (Review Runde 2)

Messung: `www/` (Build vom 2026-11-09) mit statischem Server (Port 4733/4734), Chromium via Playwright, 375x812, CPU 4x gedrosselt (grober Ersatz fuer ein langsameres Telefon; ein aktuelles iPhone liegt eher bei 1x bis 2x). Seed: 6 Eintraege/Tag mit `facts` und `baseFacts` (je ca. 480 Zeichen JSON). Nicht auf echtem Geraet geprueft. Nicht doppelt gemeldet: PRF-01..10 (siehe docs/PERFORMANCE.md), PRF-04 (PreloadAllModules) bleibt bewusst offen.

Messwerte (4x gedrosselt):
| Tagebuch | Eintraege | JSON-Groesse | JSON.parse | stringify + setItem je Flush | Tageswechsel im Tagebuch |
|---|---:|---:|---:|---:|---:|
| leer | 0 | 2 Zeichen | 0 ms | 0 ms | 13 ms |
| 1 Jahr | 2.190 | 1,05 Mio | 13 ms | 7 + 9 ms | n. g. |
| 3 Jahre | 6.570 | 3,17 Mio | 39 ms | 29 + 51 ms | 85-90 ms |
| 10 Jahre | 21.900 | 10,6 Mio | Seed scheiterte: Quota (QuotaExceededError) | n. a. | n. a. |
Start: leere App 2 Longtasks von 423/472 ms (FCP ca. 1,1-1,7 s gedrosselt); 3 Jahre Daten +ca. 150 ms Longtask. Dashboard-Start laedt 63 Requests, 1,5 MB roh (Hauptbundle 662 kB).

## F1. Gesamtes Tagebuch in EINEM localStorage-Schluessel; Quota nach ca. 10.000 Eintraegen
Befund: `core/state/diary.store.ts:318-320` schreibt bei jeder Aenderung `JSON.stringify(alle Eintraege)` unter dem Schluessel `diary`; `storage.service.ts:74` ruft `setItem` mit dem ganzen String. Gemessen: 480 Zeichen/Eintrag, Quota des Browsers ca. 5 Mio Zeichen (iOS WKWebView aehnlich, nicht gemessen) = ca. 10.400 Eintraege, bei 5 Eintraegen/Tag rund 5,7 Jahre. Danach scheitert jedes Schreiben: `writeFailures` zaehlt hoch, es kommt ein Toast, aber neue Eintraege liegen nur noch im Speicher und sind nach App-Neustart weg. Dazu waechst die Schreibzeit linear (3 Jahre: ca. 80 ms gedrosselt je Flush auf dem Main-Thread).
Auswirkung: Langzeit-Datenverlust bei treuen Nutzern, ruckelndes Speichern. Kernnutzer (taeglich Protein/kcal loggen) trifft es zuerst.
Vorschlag: Monatsschluessel (`diary:2026-11`) plus kleiner Index; nur den geaenderten Monat schreiben, aeltere Monate lazy laden. Zusaetzlich Groesse senken: `baseFacts` nur bei Bedarf (per100g), Nullfelder weglassen (ca. -30 %). Speicher-Warnung bei 70 % Auslastung in den Einstellungen. Migration beim ersten Start (alter Schluessel -> Monate), Backup-Format unveraendert halten.
Aufwand: M. Prioritaet: hoch.

## F2. Langzeitspeicher auf iOS: localStorage ist nicht dauerhaft garantiert
Befund: `storage.service.ts:6-9` nennt Capacitor Preferences/SQLite nur als spaeteren Austausch. localStorage im WKWebView kann bei Speicherdruck vom System geleert werden; die App hat kein Auto-Backup (nur manuelles, siehe REVIEW QAE-08..10). Preferences (UserDefaults) taugt fuer Megabytes nicht.
Auswirkung: Jahre an Tagebuchdaten haengen an einem weichen Speicher. Das ist die groesste Performance-/Robustheits-Luecke bei "grossen Tagebuechern".
Vorschlag: Bei F1 gleich Speicher-Backend abstrahieren: Capacitor-Filesystem (JSON je Monat im Datenordner) oder SQLite; StorageService-API (get/set) bleibt, Schreiben wird asynchron. Mindestens: Auto-Backup-Erinnerung nach 30 Tagen ohne Export.
Aufwand: L. Prioritaet: mittel (hoch, falls E8 = App Store).

## F3. Jeder Lesezugriff filtert und sortiert alle Eintraege
Befund: `diary.store.ts:252-256` `entriesForDate` = `filter` ueber ALLE Eintraege + `sort` mit `localeCompare`. Aufrufer: Tagebuch `groups` (`diary.page.ts:101-109`) ruft je leerer Mahlzeit `findCopySource` -> `copySources` -> 7x `entriesForMeal` (je ein Voll-Filter), plus `daySources` (7x); Dashboard `meals` (`dashboard.page.ts:141-146`) ruft je Mahlzeit dreimal; Wochenansicht `streak` bis 60 Tage x 2 Aufrufe (`week-view.component.ts:89-105`). Ca. 45-120 Voll-Filter pro Aenderung oder Tageswechsel.
Auswirkung: bei 6.570 Eintraegen 85-90 ms je Tageswechsel gedrosselt (leer: 13 ms), wachsend mit der Historie; Jahre spaeter spuerbar traege beim Blaettern.
Vorschlag: ein `computed` Index `Map<dateISO, DiaryEntry[]>` (einmal pro Aenderung gebaut, je Tag vorsortiert) im Store; `entriesForDate/ForMeal/totalsForDate` lesen daraus. Ergibt O(1) je Tag. Optional `totalsForDate` pro Tag memoisieren. Unit-Tests der bestehenden Store-Specs bleiben gueltig.
Aufwand: S bis M. Prioritaet: mittel.

## F4. recentFoods und lastAmountForLabel sortieren das gesamte Tagebuch
Befund: `diary.store.ts:280-283` (`[...entries].sort(localeCompare)`, aufgerufen im Eintragen-Sheet `add-entry-sheet.component.ts:196`) und `diary-helpers.ts:149-151` (`lastAmountForLabel`, bei jeder Lebensmittelwahl, `diary.page.ts:255`, `add-entry-sheet.component.ts:395`).
Auswirkung: 6.570 Eintraege: ca. 4 ms gedrosselt, bei 22.000 etwa 15-20 ms; klein, aber unnoetig, `localeCompare` auf ISO-Strings ist langsam.
Vorschlag: ISO-Zeitstempel mit `<`/`>` vergleichen (statt `localeCompare`), oder rueckwaerts iterieren, da `entries` ohnehin in Einfuegereihenfolge liegt (`add` haengt an); `find` ab Ende statt Voll-Sortierung.
Aufwand: S. Prioritaet: niedrig.

## F5. Start: Main-Thread-Block von 250-470 ms, Datenmenge addiert JSON.parse auf dem kritischen Pfad
Befund: Stores lesen im Feldinitialisierer synchron (`diary.store.ts:103-105`); beim ersten Seitenaufruf parst die App das ganze Tagebuch (3 Jahre: 39 ms gedrosselt) vor dem ersten Render der Heute-Seite, die nur den aktuellen Tag braucht. Leere App bereits 2 Longtasks (423/472 ms gedrosselt), vor allem Framework + Ionic (Hauptbundle 662 kB roh, `IonicModule` aus `@ionic/angular/lazy` in `app.module.ts:20`).
Auswirkung: Zeit bis zum ersten sichtbaren Heute-Screen; auf dem iPhone ohne Drosselung vermutlich 100-200 ms. Kein akutes Problem.
Vorschlag: F1 (Monatsshards) loest den Datenanteil. Fuer den Rest einen Splash-Screen bis `ion-content` bereit ist (`@capacitor/splash-screen`, `launchAutoHide: false`, manuell nach erstem Render), damit kein Weissbild entsteht. Nicht weiter am Framework tunen.
Aufwand: S (Splash) / M (mit F1). Prioritaet: niedrig.

## F6. Alle Tabs werden beim Start nachgeladen (PRF-04 offen)
Befund: `app-routing.module.ts:13` `PreloadAllModules`; Dashboard-Start holt 63 Requests, 1,5 MB roh, obwohl Rezepte, Einkauf, Einstellungen und Wochenplan noch nicht gebraucht werden. In Capacitor liegen Dateien lokal, es kostet daher Parse/Compile statt Netz (im Hintergrund, nach dem ersten Render).
Auswirkung: konkurriert mit den ersten Interaktionen um den Main-Thread; im Web-Betrieb (Pages) zusaetzlich Datenverbrauch.
Vorschlag: eigene Strategie: Diary sofort, Rest mit `requestIdleCallback`/Verzoegerung 3 s; im Web nur bei WLAN (`navigator.connection.saveData` pruefen). Risiko niedrig, Modul-Imports unveraendert.
Aufwand: S. Prioritaet: niedrig.

## F7. Speicherzugriff: Backup und Snapshot parsen alles doppelt
Befund: `storage.service.ts:112-123` `snapshot()` liest alle Schluessel und parst sie; Backup-Export stringifiziert danach erneut. Bei 3 Mio Zeichen ist das ein Doppelaufwand von ca. 70 ms gedrosselt, im Web Share zusaetzlich ein 3-MB-String im Speicher.
Auswirkung: kurzer Hänger beim Export; kein Problem bis ca. 10.000 Eintraege.
Vorschlag: bei F1 den Export streamen (Monat fuer Monat anhaengen) oder die Rohstrings direkt zusammensetzen, ohne Parse/Stringify-Runde.
Aufwand: S. Prioritaet: niedrig.

Unkritisch nach Messung: Tagesliste (max. ca. 20 Eintraege), OnPush/Signals/track, Wochenansicht, Schreib-Debounce 250 ms (fuer F1 beibehalten).

## Fragen/Thesen an andere Rollen
1. An Daten/QA (Rollen zu Import/Backup): Soll ein Monatsshard-Format (F1) das Backup-Format aendern, oder bleibt der Export ein einzelnes JSON? Die Import-Validierung (QAE-01) muesste beide Formate kennen.
2. An Release/Plattform: Gilt E8 "App Store"? Dann sollte localStorage durch Dateispeicher/SQLite ersetzt werden (F2), sonst reicht ein Auto-Backup-Hinweis. Wer entscheidet das vor Welle 6?
3. An UX/Produkt: Ab wie vielen Tagen Historie soll die Auswertung (Wochen-/Monatsansicht, T3) aggregiert vorgehalten werden? Wenn die Monatsansicht kommt, braucht sie den Tagesindex aus F3 ohnehin; sonst steigt die Rechenlast mit jedem Monat.

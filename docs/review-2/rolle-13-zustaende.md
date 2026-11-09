# Rolle 13: Fehler-, Leer-, Lade- und Offline-Zustaende

Basis: Codelektuere (Stand 2026-11-09). Nicht doppelt gemeldet, da inzwischen im Code behoben: QAE-02 (Schreibfehler-Toast), QAD-05 (copyBusy), QAD-06/07 (Undo mit alter Id und Position), FDB-03, STA-01, Kamera-Fallback auf Code-Eingabe, Offline-Erkennung in Food/Rezept/Wochenplan. Die App ist hier schon ordentlich; unten steht, was noch fehlt. Nicht im Browser geprueft.

F1. Fehlgeschlagenes Schreiben verwirft die Daten endgueltig (storage.service.ts:70-76)
Befund: `flush()` leert `pending` (Z. 70), bevor geschrieben wird. Scheitert `setItem` (Speicher voll), steht der Wert nur noch im RAM-Signal; es gibt keinen Retry.
Auswirkung: Toast sagt "Konnte nicht gespeichert werden", aber nach App-Neustart fehlt der Eintrag. Weitere Eintraege scheitern ebenso, jedes Mal ein neuer Toast.
Vorschlag: Fehlgeschlagene Keys in `pending` behalten und beim naechsten Flush/`visibilitychange` erneut versuchen. Zusaetzlich dauerhaftes Banner auf Heute mit Button "Backup anlegen" statt 6-s-Toast.
Aufwand: S bis M. Prioritaet: hoch.

F2. Fehlendes localStorage wird nicht gemeldet (storage.service.ts:74, 128-134)
Befund: `backend?.setItem` ist bei `backend() === null` ein stilles No-op; `writeFailures` zaehlt nicht. Auch `remove`/`clearAll` schlucken Fehler (Z. 85-103).
Auswirkung: In iOS-Sonderfaellen (gesperrter Speicher) laeuft die App scheinbar normal, nichts bleibt erhalten.
Vorschlag: Bei `backend() === null` ebenfalls `_writeFailures` erhoehen; Hinweis beim Start ("Daten werden nicht dauerhaft gespeichert").
Aufwand: S. Prioritaet: mittel.

F3. Toast-Stau bei Mehrfachfehlern (app.component.ts:22-33)
Befund: Der Effect erzeugt bei jedem Zaehlerstand einen neuen Toast ohne `getTop()`/Dismiss; Fehlermeldung kann ausserdem einen offenen "Rueckgaengig"-Toast verdraengen oder von ihm verdraengt werden (`showEntryToast` dismissed jeden offenen Toast, entry-toast.ts:9-10).
Auswirkung: Wichtige Fehlermeldung verschwindet nach 2,5 s, oder ein Undo geht verloren.
Vorschlag: Fehlertoast nur einmal pro Sitzung bzw. persistentes Banner (siehe F1); `showEntryToast` darf Danger-Toasts nicht schliessen.
Aufwand: S. Prioritaet: mittel.

F4. Defekte Tagebuchdaten legen den Heute-Screen lahm (diary.store.ts:104, 255, 283, 301; backup.ts:119-121)
Befund: Beim Laden und beim Backup-Import wird nur "ist Objekt" geprueft; Eintraege ohne `createdAt`/`dateISO` brechen `a.createdAt.localeCompare` mit TypeError. Weight-Store bereinigt dagegen (`sanitizeWeights`), Diary nicht. QAE-01 ist damit nur halb geloest.
Auswirkung: Ein kaputter Datensatz (Import, Teilschreibung) macht Heute und Tagebuch beim Start unbenutzbar, ohne Ausweg ausser Reset.
Vorschlag: `sanitizeEntries()` beim Laden (ungueltige Zeilen verwerfen, Anzahl merken) und dieselbe Pruefung im Import; Hinweis "2 beschaedigte Eintraege uebersprungen". Gleiches Muster fuer meals, recipes, customFoods.
Aufwand: M. Prioritaet: hoch.

F5. Beschaedigtes JSON wird beim naechsten Speichern ueberschrieben (storage.service.ts:36-45)
Befund: `get()` gibt bei Parse-Fehler still `fallback` (leere Liste) zurueck; der naechste `set` ersetzt die Rohdaten.
Auswirkung: Ein einzelner Defekt im Schluessel `diary` loescht dauerhaft die Historie, obwohl der Rohtext noch retten liesse.
Vorschlag: Beim Parse-Fehler den Rohstring unter `<key>.corrupt-<datum>` ablegen und im Profil "Wiederherstellen/Exportieren" anbieten.
Aufwand: S. Prioritaet: mittel.

F6. Kein globaler Offline-Zustand (nur lokale Pruefungen, z. B. recipes.page.ts:488)
Befund: `navigator.onLine` wird nur im Fehlerfall ausgewertet; es gibt kein `online`/`offline`-Event und keinen Hinweis vorab. Scan-/Suchbuttons sind aktiv, die Anfrage laeuft in den Timeout (bis 30 s, fastfood-sheet.component.html:25).
Auswirkung: Im Supermarkt ohne Netz wartet Jakob 30 s, bevor "Keine Verbindung" erscheint.
Vorschlag: Kleines `OnlineService` (Signal) mit Event-Listenern; in Suche, Fastfood-Sheet und Foto-Import sofort "Du bist offline" plus Alternative (manuell eintragen, Favoriten) und Buttons deaktivieren.
Aufwand: S bis M. Prioritaet: hoch.

F7. Lange KI-Wartezeit ohne Abbruch und ohne Fortschritt (shopping.page.html:88-93, fastfood-sheet.component.html:25)
Befund: Nur Spinner und Text; Button deaktiviert, kein "Abbrechen", Wochenplan hat Fortschritt nur beim Uebersetzen.
Auswirkung: Bis 30 s Stillstand, Sheet schliessen laesst die Anfrage weiterlaufen und das Ergebnis kommt spaeter ungefragt.
Vorschlag: AbortController plus "Abbrechen"-Button; Ergebnis nach Schliessen verwerfen. Nach 8 s Hinweis "Das dauert laenger als ueblich".
Aufwand: M. Prioritaet: mittel.

F8. 429 und Tageslimit sind nicht von "ueberlastet" unterscheidbar bzw. nicht vorbeugend sichtbar (ai-errors.ts:18-24)
Befund: 429 ergibt "bitte kurz warten", 500/502/503/504 alle "ueberlastet - in einer Minute". Ein erschoepftes Tageskontingent (siehe WRK-01) waere damit als Dauerfehler nicht erkennbar; Spoonacular hat dagegen eigenen `quota`-Zustand.
Auswirkung: Jakob versucht minutenlang erneut. Es gibt keinen Fallback-Vorschlag ("Etikett manuell eintragen", "aus eigenen Rezepten planen").
Vorschlag: Worker liefert `Retry-After`/Code `quota`; UI zeigt "Heute nicht mehr moeglich" plus konkreten Alternativweg-Button je Funktion.
Aufwand: M. Prioritaet: mittel.

F9. Stille Fehler verwechseln "nichts" mit "Fehler" (open-prices.provider.ts:46-50, recipe-translate.ts:90, 114)
Befund: Preisabfrage und Suchbegriff-Uebersetzung fangen alles und liefern null/Originaltext.
Auswirkung: "Kein Preis gefunden" kann Offline bedeuten; unuebersetzte Rezepte erscheinen ohne Erklaerung (nur `complete:false` intern).
Vorschlag: Ergebnis mit Grund (`unavailable | none`) zurueckgeben; im UI kleinen Hinweis "Preise gerade nicht abrufbar" bzw. "Uebersetzung ohne KI (Woerterbuch)" zeigen.
Aufwand: S. Prioritaet: niedrig.

F10. Kameraverweigerung ohne Weg zur Loesung (barcode-scanner.component.ts:80-83, food-sources.component.ts:34)
Befund: Meldung "Kamerazugriff fehlgeschlagen" unterscheidet NotAllowed nicht von NotFound/Busy.
Auswirkung: Auf dem iPhone bleibt die Kamera nach einmaligem "Nicht erlauben" dauerhaft aus; Nutzer weiss nicht warum.
Vorschlag: `err.name === 'NotAllowedError'` abfangen: "Kamera ist gesperrt. iOS-Einstellungen > NutriTrack > Kamera." (Capacitor: `App.openSettings`); Code-Eingabe bleibt Fallback.
Aufwand: S. Prioritaet: mittel.

F11. Undo-Fenster zu kurz und fluechtig (entry-toast.ts:3-4, 9-10)
Befund: 5 s, Toast oben; naechste Aktion dismissed den offenen Undo-Toast. Wischlöschen mehrerer Zeilen hintereinander erlaubt nur Undo der letzten. Seitenwechsel verliert Undo.
Auswirkung: Versehentlich geloeschte Eintraege (Kern der Daten) sind schnell unwiederbringlich.
Vorschlag: Undo-Dauer 8 s, Stapel (Toast zeigt "2 geloescht - Rueckgaengig"), Undo bleibt bis Tagwechsel in "Zuletzt geloescht" im Tagebuch-Menue (max. 10).
Aufwand: M. Prioritaet: mittel.

F12. Backup-Import ersetzt alles ohne Vorab-Sicherung (backup.service.ts:67-72)
Befund: `restore` ruft `replaceAll` (mit Rollback nur bei Schreibfehler). Kein automatischer Export des alten Stands (QAE-08..10 bekannt, hier die Zustandssicht: nach Erfolg gibt es kein Rueckgaengig).
Auswirkung: Falsches Backup eingespielt = alter Stand weg.
Vorschlag: Vor `replaceAll` alten Snapshot als `pre-restore`-Key halten, nach Import Toast "Rueckgaengig (10 Min.)".
Aufwand: S. Prioritaet: mittel.

Fragen/Thesen an andere Rollen
1. An Rolle Daten/QA und Architektur: Soll die Persistenz (F1, F4, F5) auf Capacitor Preferences/SQLite wechseln, da WKWebView-localStorage unter Speicherdruck geleert werden kann?
2. An Worker/KI-Rolle: Sollte der Worker einen strukturierten Fehlercode (`quota`, `busy`, `bad_input`) liefern, damit F8 je Funktion einen Ausweg anzeigen kann?
3. An Design/UX-Rolle: Braucht die App einen einheitlichen Zustandsbaustein (Banner oben, nicht-toast) fuer Offline, Speicherfehler und Kontingent, statt Toasts und Inline-Texte je Seite?

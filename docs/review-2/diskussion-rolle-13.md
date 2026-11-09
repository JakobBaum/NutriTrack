# Diskussion Runde 2: Rolle 13 (Zustaende)

(a) Zustimmung und Ergaenzung
- Rolle 16 F2 und Rolle 12 Q2 (WKWebView leert localStorage unter Speicherdruck) verstaerken meine F1/F2/F5: Bei Persistenz-Verlust gibt es heute weder Warnung noch Rettung. Rolle 20 F1 (Datensicherheit groesste Produktluecke) ist dieselbe Wurzel.
- Rolle 18 F9 (21 `catch {}` ohne Log, kein ErrorHandler) und F4 (kein Schema-Versionsstand im Storage): ergaenzen F4/F5. Eine `sanitizeEntries()` braucht genau diese Version.
- Rolle 12 F3/F6 (Reset und Import ohne Sicherung) = mein F12; zusammen als eine Massnahme "Pre-Restore-Snapshot, auch vor Reset" umsetzen.
- Rolle 07 F7 und Rolle 09 F6 (Undo-Toast zu kurz, harter Toast-Wechsel) = mein F11/F3. Rolle 14 F4/F5 (stilles 0, Button ohne Begruendung) und Rolle 01 F6 (Fehlermeldungen erscheinen nie) sind derselbe Zustandsfehler: Fehler existiert, ist nicht sichtbar.
- Rolle 05 F6/F7/F8 (Uebersetzung ohne Abbruch, Fehlertext unter der Falz) = mein F7. Rolle 08 F2/F6 (Fehlertext verweist auf nicht existente Einstellung, Rohtexte im UI) ergaenzen F8/F9.
- Rolle 17 F2/F3 (Deckel zaehlt Anfragen, Quota-Flut) macht F8 dringlicher: Quota-Zustand muss UI-seitig existieren, bevor der Deckel greift.
- Rolle 15 F3 (Tageswechsel bei Rueckkehr aus Hintergrund) ist ein Zustandsproblem in meinem Sinn (QAD-02 nur halb gefixt) und gehoert in dieselbe Welle.

(b) Widersprueche und Konflikte
- Rolle 09 F6 (Toasts aggregieren/weicher ersetzen) gegen mein F3 (Fehlertoast darf nie verdraengt werden): Kompromiss: zwei Ebenen. Info/Undo-Toasts aggregieren; Fehler und Speicherwarnung als Banner, das kein Toast anfasst.
- Rolle 15 F9 (Pull-to-Refresh weglassen, nur Retry-Button): einverstanden fuer Lokaldaten; fuer Fehlerzustaende fordere ich zusaetzlich sofortigen Retry und F6 (Offline vorab sperren), sonst bleibt der 30-s-Timeout.
- Rolle 20 Q2 (Einzelnutzer: nur Tageslimit, Haertung spaeter) gegen meine F8/F1: Beim Worker teile ich das. Aber Datenverlust-Schutz (F1, F4, F5, F12) ist billig (S) und nicht von E8 abhaengig; nicht vertagen.
- Rolle 16 F1 (Monatsshards im Storage) gegen Rolle 18 F4/mein F5: Shard-Umbau und Fehlerisolation widersprechen sich nicht, aber nur einmal migrieren. Reihenfolge: erst Schema-Version plus Quarantaene (S), dann Sharding falls Messung es verlangt.
- Rolle 03 F10/Rolle 04 F5 wollen Leerzustaende mit Handlung: einverstanden; Streit nur bei "Offline-Basisdatenbank" (Rolle 04 Q2): nicht vor E8 bauen, vorerst Favoriten/Zuletzt als Offline-Weg.

(c) Antworten auf Fragen an mich
- Rolle 08 Q2 (ein Fehlerkatalog): Ja. `ai-errors`, `food-errors`, `spoonacular.errors` auf einen gemeinsamen Typ `{code, message, nextStep}` und eine Tonregel ("Satz, dann konkreter naechster Schritt", ein Satzzeichenstil). Rohtexte nie anzeigen, nur loggen.
- Rolle 14 Q2 (Store oder UI validiert): Beides, aber Store ist die Wahrheit. UI zeigt Inline-Fehler, Store (`add`/`update`) lehnt NaN/negativ ab und gibt Fehlergrund zurueck. Ausserdem Sanitizing beim Laden (F4).
- Rolle 16 Q2/Rolle 12 Q2 (E8, Speicher, Auto-Backup): Nur privat/TestFlight: localStorage behalten, dafuer sichtbares Backup-Alter ("zuletzt vor 12 Tagen") und Erinnerung nach 7 Tagen. App Store: SQLite/Preferences plus iCloud-Backup-Datei. Entscheidung vor Welle 6, Hinweis jetzt.
- Rolle 09 Q3 (aggregierter Toast und Live-Region): Ja, solange der aggregierte Text Zahl und Undo nennt ("3 geloescht, Rueckgaengig") und Fehler eine eigene `role="alert"`-Region haben, die nie ersetzt wird.
- Rolle 17 Q2 (Einwilligung): nicht mein Fach; aus Zustandssicht muss ein abgelehnter Dialog zu einem nutzbaren manuellen Weg fuehren.

(d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Datensicherheit: F1 (Retry), F5 (Quaerantaene), F4 (Sanitizing mit Schema-Version), Pre-Restore-Snapshot, Backup-Alter auf Heute. Aufwand S bis M, schuetzt alle Daten.
2. Hero um "noch Z g Eiweiss" erweitern und Eiweiss gleichrangig (Rolle 02 F2/F6, Rolle 06 F5, Rolle 19 Q1): Kernversprechen.
3. Schnell-Eintrag ohne Sheet-Reibung: Favorit/Zuletzt in 2 Taps, Sheet bleibt offen (Rolle 03 F1/F2, Rolle 20 F2).
4. Offline-Service plus Retry/Abbruch in KI- und Suchfluessen (mein F6/F7, Rolle 05 F7): spart im Supermarkt 30 s.
5. Loeschen/Doppeln ins Bearbeiten-Sheet (Rolle 07 F1) plus laengeres Undo (F11): VoiceOver und Fehlertoleranz gleichzeitig.

(e) Streichen oder verschieben
- Verschieben: Skeleton-Loader (Rolle 09 F7), Sharding (Rolle 16 F1) bis Messung, Offline-Basisdatenbank, Pull-to-Refresh, Install-ID/Durable Objects bis E8.
- Streichen aus meinem Bericht: F9 (stille Fehler bei Preisen) nur noch als Nebenaufgabe im Fehlerkatalog; F2 faellt weg, wenn F1-Banner `backend()===null` mitbehandelt.

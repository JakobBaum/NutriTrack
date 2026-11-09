# Diskussion Rolle 12 (Profil, Ziele, Einstellungen), Runde 2

Gelesen: alle 19 Berichte (Findings-Titel vollstaendig, Details bei den fuer mich relevanten). Alles ohne Geraetetest.

## (a) Zustimmung / Verstaerkung
- R19-F6 (kein manuelles Ziel) = mein F1. R19 stuft "mittel" ein, ich "hoch": ohne Override kippen Sportler die Plausibilitaetslogik durch falsche Eingaben (Gewicht/Alter). Gemeinsamer Vorschlag: kcal-Offset plus Eiweiss 1,2-2,4 g/kg, Kennzeichnung "manuell", Reset auf Formel.
- R01-F4 = mein F2 (Formular nach Reset/Import veraltet). R01-F3 ergaenzt: "Profil einrichten" oeffnet das Modal nur in `ngOnInit`, nach Reset kehrt der Button ins Leere. Beides gehoert in einen Fix: `openProfile()` laedt Formular aus dem Store und oeffnet das Modal, auch bei bereits lebender Seite (ionViewWillEnter/Query-Beobachtung).
- R01-F5 (Live-Vorschau "Dein Ziel: X kcal, Y g Eiweiss") deckt sich mit meinem F8 (Vorher/Nachher im Toast); die Vorschau im Formular ist der bessere Ort, der Toast dann nur noch Bestaetigung. R01-F7 (Pflicht/Optional gliedern) ergaenzt meinen F7.
- R13-F12 und R20-F1 = mein F3/F5/F6: Auto-Sicherung vor Import, "Backup faellig"-Hinweis nach 14 Tagen, `navigator.storage.persist()`. R13-F1/F2 (Schreibfehler stumm) verstaerken: ein Backup-Hinweis hilft nur, wenn Speicherfehler sichtbar sind.
- R20-F7/R10-F5/R08-F12 (Profil-Tab Sammelbecken) = mein F12. R08-F2 (Fehlertext verweist auf "Profil > KI-Verbindung", das nichts einstellt) stuetzt F10: Zeile in "KI-Status" umbenennen und Textverweise angleichen. R08-F4/F13 (Anleitung/Rechtstexte veraltet, Eiweiss fehlt in AGB) ergaenzen F11. R17-F6 (Datenschutztext ungenau) gehoert in dieselbe Textarbeit.
- R14-F8 (Profil nur per Stepper) bestaetigt: Stepper 0,5 kg von 75 auf 110 kg ist muehsam; Direkteingabe (Tippen auf den Wert) ist fuer das Profil die wichtigste Eingabeverbesserung.
- R07-F2/R06-F1 (Dynamic Type, Literale): mein F9 (Inline-Style 12 px im Divers-Hinweis) ist ein Beispiel; in die Token-Bereinigung aufnehmen.

## (b) Widerspruch / Konflikte
1. R20-F4 will adaptives Ziel streichen und nur den Hinweis "Gewicht geaendert, Ziel neu berechnen?" behalten. Zustimmung, aber R11-F10 nennt diesen Hinweis ein Dauer-Banner und R11 will ihn eher verkleinern. Kompromiss: einmaliger Hinweis pro Gewichtsaenderung >2 kg, danach ausblendbar; Annahme per Tap fuellt das Profil vor, speichert nie automatisch (heutiges Verhalten).
2. R20-F6 (Profil zweistufig, 5 Felder) gegen R01-F7 (Gliederung Pflicht/Optional): gleiche Richtung, aber R20 verlagert Felder aus dem Formular, R01 gliedert nur. Mein Kompromiss: Pflicht (Geschlecht, Alter, Groesse, Gewicht, Ziel) oben, "Mehr Genauigkeit" (Aktivitaet, Zielgewicht, Tempo) einklappbar, Aktivitaet weiter mit Vorgabe. Aktivitaet nicht streichen: R01-F1/R19-F4 zeigen, dass sie das Ergebnis am staerksten verschiebt, daher Klartext statt Auslassen.
3. R10-F1/R11-F1 (Gewicht aus dem Profil in Heute oder Tagebuch-Segment) gegen R20-F7 (Backup/Daten nach oben im selben Tab): kein echter Widerspruch, aber die Seite wird sonst weiter beladen. Vorschlag: Gewichtskarte wandert raus (Heute-Kachel), Profil-Tab behaelt "Profil, Einheiten, Daten, Hilfe/Recht" ohne Gewicht; Reihenfolge wie mein F12.
4. R17-F1/F2 und R20-Frage 2 (Haertung nur fuer Einzelnutzer): Einwilligung und Datenschutztext (R17-F6, mein F11) sind unabhaengig davon billig und gelten schon fuer Jakobs eigene Daten, daher nicht auf E8 verschieben, nur die Einwilligungsabfrage vor KI ist E8-abhaengig.
5. R09-F3 (Ziel-Moment) gegen PRODUCT.md "kein Lob/Tadel": nicht mein Bereich, aber bei Einstellungen gilt dasselbe: keine Streak-Erinnerungen als Default (R11-F5/F6); Erinnerung nur als Opt-in unter "Daten/Backup" bzw. neuer Zeile "Erinnerungen".

## (c) Fragen an meine Rolle
- R16-Q1 (Backup-Format bei Monatsshards): Export bleibt ein einzelnes JSON, `BACKUP_VERSION` 1 unveraendert. Sharding ist Speicher-Innenleben; `restore`/`prepareRestore` schreiben ueber `StorageService.replaceAll`, die Shards erzeugt der Store beim Lesen. Wichtig: Migration vor Backup-Export testen (R18-F4: Storage-Schema-Version).
- R13-Q1 / R16-Q2 (Persistenz): Rein aus Nutzersicht: vor App-Store (E8) reicht Backup-Erinnerung plus `persist()` fuer Web; bei nativer Auslieferung sollte der Speicher nach Capacitor Preferences/Filesystem. Entscheidung gehoert vor Welle 6, nicht in Welle 1.
- R17-Q2 (Einwilligung): Fuer TestFlight reicht der Text nach Korrektur; Ziel/Kalorienbudget geht beim Fastfood-Helfer mit, daher einmaliger Hinweis beim ersten KI-Aufruf (Foto/Link/Budget), mit Link zum Datenschutztext (F11).
- R11-Q3 (lokale Erinnerungen): Mit "nichts verlaesst das Geraet" vereinbar (lokale Benachrichtigung). Opt-in-Dialog vor der Systemabfrage, Text in Datenschutz ergaenzen.
- R10-Q1 / R11-Q2: Gewicht als Kachel auf Heute, Verlauf im Tagebuch-Segment; Profil behaelt nur Zielgewicht und Neuberechnen.
- R19-Q2 (ein Satz unter dem Ziel): Zustimmung. Die Karte hat schon die Zeile "Schaetzung nach Formel (Mifflin-St Jeor), keine medizinische Beratung" (html:17); sie ersetzen durch "Schaetzung, bitte nach 2-3 Wochen am Trend pruefen".

## (d) Top 5 ueber alle Rollen (Nutzen/Aufwand)
1. Profil-Formular reparieren: Neuladen beim Oeffnen, Setup-Link funktioniert nach Reset (R01-F3/F4, mein F2) und Live-Zielvorschau (R01-F5). Aufwand S, Nutzen hoch (Erststart und Datenintegritaet).
2. Backup-Sicherheit: Hinweis nach 14 Tagen, Auto-Sicherung vor Import und Reset, `persist()` (R20-F1, R13-F12, mein F3/F5/F6). Aufwand S-M.
3. Eiweiss gleichrangig zu kcal auf Heute und Tagebuch ("noch Z g") (R02, R06-F5, R15-F7). Aufwand M, Kernversprechen.
4. Manuelles Ziel (Eiweiss g/kg, kcal-Offset) (R19-F6, mein F1). Aufwand M.
5. Speicherfehler und defekte Daten sichtbar machen (R13-F1/F2/F4). Aufwand S-M; ohne das sind 1-2 sinnlos.

## (e) Streichen / verschieben (Sicht Einstellungen)
- Streichen: Zeile "KI-Verbindung" als Einstellung, ersetzen durch Status (F10); Apple Health bis E8 (R20-F4); Debug-Log aus dem Sichtbereich der Seite (nur mit Flag, bleibt).
- Verschieben: Imperial fuer Koerperwerte (F4 zweiter Teil) bis E8 klar ist; Passphrase-Verschluesselung des Backups (DSG-05) bis App-Store; adaptives Ziel (R20-F4, R11) nach Gewichtsverlauf und Auswertung.
- Behalten: Backup-Import-Validierung inkl. Rollback; Alert vor Reset und Import.

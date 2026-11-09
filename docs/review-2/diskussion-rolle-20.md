# Diskussion Runde 2: Rolle 20 (Produkt / Advocatus Diaboli)

Grundlage: Findings- und Fragenteile der 19 anderen Berichte (Findings-Titel vollstaendig, Details stichprobenartig gelesen). Nichts am Code geaendert.

## (a) Zustimmung
- Rolle 13 F1/F4/F5/F12, Rolle 12 F3/F5/F6, Rolle 16 F2: Persistenz ist das Hauptrisiko. Das verstaerkt mein F1 (Datensicherheit). Stilles Verwerfen bei Schreibfehler und Import ohne Vorab-Sicherung sind schlimmer als jedes fehlende Feature.
- Rolle 03 F1/F11 und Rolle 04 F1: Sheet schliesst nach Schnell-Eintrag, kein kcal-Schnelleintrag. Bestaetigt mein F2: Der Alltagspfad zaehlt mehr als neue Auswertungen.
- Rolle 05 F1/F2/F3/F13 und Rolle 10 F2/F3: Wochenplan/Liste ist doppelt verankert und eine Sackgasse. Stuetzt mein F3 (zweites Produkt, hoher Pflegeaufwand) und F8 (Tab-Zuschnitt).
- Rolle 12 F1 / Rolle 19 F6: Manuelle Ziele fehlen. Das ist ein Standard-Feature aller Vergleichs-Apps (MFP, Yazio, Cronometer); fehlt es, wechseln Fortgeschrittene.
- Rolle 12 F10: "KI-Verbindung" ist ein Leerlauf-Sheet. Reiner Ballast, streichen.
- Rolle 18 F2/F9/F12 und Rolle 17 F1: CI ohne Tests, kein ErrorHandler, Deckel nur Konfiguration. Teilt meine Sicht, dass Betrieb vor Feature kommt.

## (b) Widerspruch / Konflikte
1. Rolle 11 (F6 Erinnerungen, F5 Serie) und Rolle 09 (F3 Ziel-Moment) gegen Produktprinzip "Weniger, aber gut": Erinnerungen verlangen Push-Berechtigung und Native-Pfad (E8 offen). Kompromiss: Erinnerung erst nach E8; Ziel-Moment nur als dezente Haptik/Farbwechsel, keine Serien.
2. Rolle 15 F7/F8 (Widget, Apple Health, Shortcuts) gegen Rolle 12/13 (Persistenz): Widget braucht App-Group-Spiegel und Native-Build. Erst Speicher stabilisieren, dann Widget. Apple Health bleibt gestrichen (E9).
3. Rolle 16 F1 (Monatsshards) und Rolle 13 Q1 (SQLite/Preferences) gegen Rolle 18 F4 (Schema-Version zuerst): Alle drei aendern das Speicherformat. Reihenfolge: Schema-Version (Rolle 18 F4), dann Persistenz-Wechsel, dann Shards nur bei messbarer Langsamkeit. Kein Backup-Format-Bruch ohne Migration.
4. Rolle 12 Q3 (Profil und Einstellungen trennen) und Rolle 10 F5 gegen Rolle 10 Q1 (6. Tab fuer Gewicht): Mehr Tabs widersprechen E1 und der 320-px-Leiste. Kompromiss: Gewichtskarte auf Heute unter die Ringe (eine Zeile, Tipp oeffnet Verlauf), Profil-Tab nur Ziele, Daten, Info.
5. Rolle 06 F4/F5 (Eiweiss-Farbe und -Wert ueberall) gegen Rolle 06 F1/Rolle 07 (Typo-Skala/Dynamic Type zuerst): Ich ordne Design-Skala hinter Funktion; Dynamic Type nur fuer Hero und Eintragen-Sheet, nicht fuer die ganze App.
6. Rolle 04 F2/F7 (Eigene-Lebensmittel-Verwaltung, zuletzt genutzte OFF-Produkte): Doppelt zu Favoriten/Zuletzt; zusammenfuehren statt ein dritter Listentyp.

## (c) Antworten auf Fragen an mich/Produkt
- Rolle 03 Q1: Ja, Schnell-Pfade (F1, F2, F10, F11) vor Verlauf und adaptivem Ziel.
- Rolle 04 Q1: Relevanz zum Suchbegriff bleibt Sortierung; Eiweiss pro 100 g nur als Anzeige in der Zeile. Eiweissdichte-Sortierung als optionaler Chip "Eiweissreich", nicht Standard.
- Rolle 04 Q3 / Rolle 03 F8: Vier Wege nicht als gleichrangige Tabs. Ein Suchfeld; bei leerem Begriff Favoriten, Zuletzt, Eigene; Rezept/Mahlzeit als zwei Chips.
- Rolle 10 Q1: Gewicht kein eigener Tab (siehe b4). Rolle 10 Q3 / Rolle 15: Zielplattform fuer Planung "iPhone Home-Screen/TestFlight, Web nur Fallback"; Android-Back (F7) streichen.
- Rolle 12 Q2, Rolle 16 Q2, Rolle 13 Q1: Privat/TestFlight: Auto-Hinweis auf Export plus `persist()` genuegt. Bei App-Store-Entscheid dann Dateispeicher/SQLite. Passphrase-Verschluesselung nicht vor Weitergabe.
- Rolle 19 Q1 / Rolle 15 Q1: Eiweiss darf im Hero vorn stehen (ist es schon); kcal-Ring bleibt gleichwertig. Widget (Rolle 15 F7) lohnt mehr als adaptives Ziel, aber nach Persistenz und nach E8.
- Rolle 06 Q3: Tagebuch-Kopf zeigt Eiweiss gleichrangig zu kcal. Ja.
- Rolle 18 Q2: Dashboard in `computed` zerlegen vor dem Umbau ist fachlich unproblematisch, wenn Screenshot-Test gleich bleibt.
- Rolle 02 Q1: "Fast" (90 %) nicht einfuehren; zwei Zustaende reichen, sonst Ziel-Fatalismus.

## (d) Top 5 ueber alle Rollen (Nutzen/Aufwand)
1. Persistenz-Schutz: Schreibfehler melden (Rolle 13 F1), Vorab-Sicherung vor Import/Reset (Rolle 12 F3/F6), `persist()`, 14-Tage-Exporthinweis. S-M.
2. Schnell-Eintragen: Sheet bleibt offen/Toast mit Undo (Rolle 03 F1), kcal-Schnelleintrag (Rolle 03 F11), Gestern kopieren. S.
3. Manuelle Ziele (Rolle 12 F1, Rolle 19 F6) mit Warnbereich fuer Eiweiss. M.
4. Worker-Deckel scharf schalten und Fehlerklassen (Rolle 17 F1/F2, Rolle 13 F8). S-M.
5. Erststart reparieren: Setup-Button/Modal-Bug und veraltete Formularwerte (Rolle 01 F3/F4, Rolle 12 F2). S.

## (e) Streichen oder verschieben
- Streichen: "KI-Verbindung"-Sheet (Rolle 12 F10), Fastfood-Block auf Heute, Android-Back, Serien (Rolle 11 F5), Apple Health, Zeitzeichen/Skeletons (Rolle 09 F7), Eigene-Lebensmittel-Verwaltung als eigener Bereich.
- Verschieben bis nach E8: Erinnerungen, Widget, Shortcuts, Monatsshards, Passphrase-Backup, Privacy-Labels.
- Verschieben bis Kern stabil: adaptives Ziel, Preisschaetzung/Open Prices, weitere Einkaufs-Einheiten (Rolle 05 F14/F15), Typo-/Token-Aufraeumen ausser Hero und Sheet.

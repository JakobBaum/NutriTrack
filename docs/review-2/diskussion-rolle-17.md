# Diskussion Runde 2, Rolle 17 (Sicherheit und Datenschutz)

Grundlage: alle 19 Berichte (Fragen-Abschnitte vollstaendig, Findings per Ueberschriften und Stichworte; nicht jede Rolle im Volltext gelesen).

## (a) Zustimmung und Ergaenzung
- Rolle 13 F1/F2/F5 (Schreibfehler verwerfen Daten, defektes JSON wird ueberschrieben) und Rolle 20 F1 (Datensicherheit groesste Produktluecke): verstaerkt aus Sicht Datenschutz; "nur lokal" ist nur dann ein Versprechen, wenn Datenverlust und stille Fehler behoben sind.
- Rolle 13 F12 und Rolle 12 F3/F6 (Import/Reset ohne Vorab-Sicherung): Auto-Sicherung vor Import und Reset ist zugleich Schutz gegen manipulierte Backup-Dateien (Import ist Vertrauensgrenze).
- Rolle 13 F8 und Rolle 05 F7: Die Tageslimit-Meldung (429) braucht einen strukturierten Fehlercode; passt zu F1/F2 (ein aktives Limit muss fuer Nutzer verstaendlich sein, sonst wirkt der Schutz wie ein Defekt). Rolle 05 F7 (10 sequenzielle Uebersetzungen) belastet das Tageslimit direkt und verstaerkt F2 (Deckel zaehlt Anfragen).
- Rolle 12 F11: Kein Hinweis am Ort der Datenweitergabe (Foto an Gemini); deckt sich mit meinem F6 und stuetzt den einmaligen Zustimmungsdialog.
- Rolle 12 F10 und Rolle 20 F10 (KI-Abhaengigkeit/Billing offen): bestaetigt die Dringlichkeit von F1 vor jedem Aktivieren von Billing.
- Rolle 18 F9 (kein ErrorHandler, 21 leere catch): Fehler gehen unbemerkt verloren, auch sicherheitsrelevante (Speicher voll, Import abgelehnt). Rolle 18 F4 (Schema-Version im Speicher) erleichtert eine sichere Import-Validierung.
- Rolle 11 F6 (Erinnerungen): lokale Benachrichtigungen sind datenschutzneutral, solange kein Push-Server beteiligt ist.

## (b) Widerspruch und Konflikte
- Rolle 20 These (Frage 2): "Tageslimit + Kostendeckel reichen, Durable Object und Install-ID erst bei Weitergabe". Teilweise Zustimmung. Kompromiss: jetzt nur F1 (KV aktivieren, fail-closed) plus Google-Cloud-Budget-Quota; Durable Object und Install-ID erst bei E8 "App Store". Die KV-Nichtatomaritaet ist fuer einen Einzelnutzer tolerierbar, das Fehlen jeglichen Deckels nicht.
- Rolle 13 Frage 1 / Rolle 16 F2 (localStorage durch SQLite/Preferences ersetzen): Aus Sicherheitssicht kein Gewinn (beides unverschluesselt auf dem Geraet), Gewinn nur bei Datenverlust. Kompromiss: Wechsel nur wegen Zuverlaessigkeit (Rolle 13/16), nicht als Sicherheitsargument; Auto-Backup ist guenstiger als Migration.
- Rolle 12 Frage 2 (Backup-Passphrase vor TestFlight): fuer Eigengebrauch/TestFlight nicht noetig; ein Warnhinweis beim Teilen genuegt. Passphrase erst bei oeffentlicher Verteilung.
- Rolle 15 F7 (Widget mit App-Group-Spiegel): Widerspruch nur bei Ausfuehrung; Tageswerte (kcal/Eiweiss) im App-Group-Container sind nicht kritisch, aber dann unter den Datenschutztext fallen und nicht Gewicht/Profil spiegeln.
- Rolle 12 F1 (freier Eiweiss-/kcal-Override) und Rolle 18/Rolle 14 (Validierung im Store): Overrides muessen serverlos begrenzt und beim Import validiert werden; sonst umgeht ein Backup alle Grenzen. Kein Widerspruch, aber Abhaengigkeit.

## (c) Antworten auf Fragen an Sicherheit/Datenschutz
- Rolle 15 Frage 2 (App-Group-Spiegel unverschluesselt, Apple Health vs. Privacy-Manifest): Unverschluesselt reicht, wenn nur Tageswerte (kcal, Eiweiss, Ziel) gespiegelt werden, keine Profil-/Gewichtsdaten; iOS-Dateischutz gilt. Apple Health: nur Schreiben, Nutzungstext (NSHealthShareUsageDescription/UpdateUsageDescription) und Datenschutz-Label ergaenzen; das Privacy-Manifest ist davon getrennt (Required-Reason-APIs, siehe REL-09).
- Rolle 11 Frage 3 (lokale Erinnerungen): unproblematisch. Opt-in vor der Berechtigungsanfrage ist gute Praxis, aber keine DSGVO-Pflicht, solange nichts das Geraet verlaesst. Aussage "nichts verlaesst das Geraet" nicht fuer die App insgesamt verwenden (KI/Suche gehen ins Netz).
- Rolle 12 Frage 2: siehe (b); Hinweis in der App reicht fuer TestFlight.
- Rolle 20 Frage 2: siehe (b).
- Rolle 13 Frage 2 (strukturierter Fehlercode): ja, `quota|busy|bad_input|blocked` als Feld `code` zusaetzlich zur Meldung; kein Sicherheitsrisiko (keine internen Details).
- Rolle 05 Frage 3 (10 Uebersetzungen): vertretbar nur mit Woerterbuch zuerst und Obergrenze pro Plan; sonst verbraucht ein Plan 10 Slots des Tageslimits.

## (d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Auto-Sicherung vor Import/Reset plus Fehlermeldung bei Schreibfehlern (Rolle 13 F1/F12, Rolle 12 F3/F6, Rolle 20 F1): schuetzt echte Daten, Aufwand S bis M.
2. Tagesdeckel aktivieren, fail-closed, Google-Cloud-Quota (mein F1/F2): Aufwand S, verhindert Kostenunfall.
3. Meta-CSP (mein F4), erst als Test auf Tesseract/Capacitor: Aufwand S.
4. Eiweiss gleichrangig zu kcal im Hero (Rollen 02, 19, 20): Kernversprechen, Aufwand M.
5. Einmaliger KI-Zustimmungsdialog mit Datenschutz-Kurztext am Ort der Weitergabe (mein F6, Rolle 12 F11): Aufwand S.

## (e) Streichen oder verschieben
- Verschieben bis E8 "App Store": Install-ID, Durable Object (F2 Teil), Backup-Passphrase, Spiegelung/Widget-Datenschutzpruefung, Android-allowBackup (F5), Admin-geschuetztes /health (F9), App-Token (F7).
- Streichen/nicht priorisieren: SQLite-Migration als Sicherheitsmassnahme; Pflicht zu Impressum/Privacy-Label fuer reinen TestFlight-Eigengebrauch.
- Zuerst vor Weitergabe an Dritte: Spoonacular-Tagesdeckel (F3), Prompt-Injection-Haertung (F8) bleibt niedrig.

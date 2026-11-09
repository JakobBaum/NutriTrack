# Diskussion Runde 2: Rolle 10 Navigation und Informationsarchitektur

Gelesen: die 19 anderen Berichte (bei 16 nur Überschriften und Fragen). Alles Code-Lektüre, nichts am Gerät geprüft.

## (a) Zustimmung
- Rolle 01 F3 (Setup-Sheet öffnet nur in `ngOnInit`) deckt sich mit meinem F6. Gemeinsame Ursache: Query-Params werden nicht "verbraucht". Eine Lösung für `setup`, `open`, `view` (Helfer mit `replaceUrl`, Vorbild diary.page.ts:168).
- Rolle 05 F1/F16 und Rolle 08 F1/F12: Plan -> Liste ist nur per Toast erreichbar, Button "Zu den Rezepten" hat zwei Ziele. Das ist die IA-Ursache hinter meinem F2. Ein Namens- und Ortsproblem, kein Wortproblem.
- Rolle 20 F7 und Rolle 12 F12: Profil als Sammelbecken, Backup versteckt (mein F5). Rolle 13 F12 und Rolle 12 F3/F6 (Reset/Import ohne Sicherung) verstärken: Daten/Backup gehört nach oben.
- Rolle 11 F1: Gewicht im Profil versteckt (mein F5).
- Rolle 06 F6 und Rolle 15 F5: "Hinzufügen" in vier Mustern, Kontextmenü fehlt. Stützt Runde-1-Konflikt 2.
- Rolle 15 F3 (Tageswechsel) und Rolle 15 F7 (Widget, Tap öffnet "Eintragen" per Deep Link): Das nutzt genau meine F8-Linkstruktur `/diary?add=<meal>`; Link-Handler `appUrlOpen` fehlt dafür noch.
- Rolle 07 F4, Rolle 09 F1: Tab-Buttons ohne Press-State bzw. unter 44 pt. Passt zu meinem F12 (Tab-Interaktion unfertig).

## (b) Widerspruch und Konflikte
1. Rolle 20 F8 (4 Tabs: "Kochen" mit Segmenten Rezepte | Mahlzeiten | Plan | Liste). Ich widerspreche der Zusammenlegung: vier Segmente im Kopf sind auf 320 px selbst eng (Rolle 06 F7 nennt den Rezepte-Kopf schon überladen), und Wochenplan/Liste sind für Jakob ein anderer Moment (einkaufen) als Rezepte (kochen). Kompromiss: 5 Tabs behalten (E1), aber Tab "Einkauf" zu "Woche" oder "Plan" machen (Plan + Liste), Rezepte mit Mahlzeiten. Dann hat der Wochenplan genau einen Ort.
2. Rolle 20 F9 (Heute zeigt Eintragsliste, Tagebuch wird Verlauf): zu groß (L) und löst nicht das Kernproblem. Kompromiss: Tagebuch behalten; Heute bekommt nur die letzten 2 bis 3 Einträge mit Link "Alle ansehen". Verlauf (Rolle 11 F2) als Segment "Woche" im Tagebuch (existiert laut Rolle 11 als week-view).
3. Rolle 12 Frage 3 (Profil und Einstellungen als zwei Bereiche): Ich lehne einen sechsten Tab ab. Besser: Profil-Tab in "Ich" umbenennen und intern gliedern (Ziel und Gewicht oben, Daten, Einstellungen, Rechtliches eingeklappt). Zahnrad im Kopf von Heute als Alternative wäre ein zweiter Weg zum gleichen Ziel.
4. Rolle 11 F1 (Gewicht als Kachel auf Heute oder Segment im Tagebuch): Beides geht, aber nicht Gewicht als Segment neben Tag/Woche: Gewicht ist keine Zeitansicht. Kompromiss: Kachel auf Heute, Verlauf im Tagebuch-Segment "Woche" daneben, Karte im Profil bleibt.
5. Rolle 06 F6 vs. Rolle 15 F5 vs. Runde 1 (Pille oder Kopfaktion): einigen auf Pille auf Heute und Tagebuch, Kopfaktion "+" in Rezepte, Einkauf-Tab ohne FAB.

## (c) Fragen an mich
- Rolle 06 F1 "Ein Hinzufügen-Muster?": Ja, ein Kopf-"+" je Tab mit gleicher Position; Pille nur auf Heute (Hauptpfad). FAB streichen (verdeckt zudem die schwebende Tab-Bar).
- Rolle 11 F2: Gewicht nicht als eigener Tab (E1 bleibt); Kachel auf Heute.
- Rolle 12 F3: siehe (b) 3, kein sechster Tab.
- Rolle 04 F3 (vier Wege im Eintragen-Sheet): Ein Suchfeld, bei leerem Begriff "Zuletzt" und "Eigene" als Liste, Mahlzeiten als Filter-Chip. Das ist IA-seitig sinnvoller als vier Reiter; Details bei Rolle 03.
- Rolle 01 F3 und Rolle 20 F6 (Aha-Moment): `?setup=1` per Observable lesen und danach löschen; Willkommensseite ohne Tab-Bar-Zwang wäre ein größerer Eingriff, ich rate davon ab.

## (d) Top 5 über alle Rollen (Nutzen/Aufwand)
1. Query-Param-Verbrauch vereinheitlichen (`setup`, `open`, `view`, `date`), Setup-Button zuverlässig (Rolle 01 F3, mein F1/F6/F9). S.
2. Wochenplan an einen Ort, Tab "Einkauf" zu "Woche", Plan -> Liste als fester Button (Rolle 05 F1/F16, mein F2). M.
3. Hero "noch Z g Eiweiß" und Eiweiß im Tagebuch gleichrangig (Rolle 02, 06 F5, 19, Runde 1 PM-01). M.
4. Datenverlust: Schreibfehler melden, Auto-Sicherung vor Import/Reset, Backup nach oben (Rolle 13 F1/F12, 12 F3/F6, 20 F1). S bis M.
5. Eintragen in zwei Taps, Sheet bleibt offen/Favoriten (Rolle 03 F1/F2, 20 F2). M.

## (e) Streichen oder verschieben
- Hardware-Back und History für Sheets (mein F7): verschieben, solange nur iOS (E8).
- Kollabierender Titel (mein F13), Tab-Icons (F4): niedrig, erst nach Welle 4.
- 4-Tab-Umbau und "Heute = Tagebuch" (Rolle 20 F8/F9): verschieben, erst nach Nutzung von Wochenplan und Verlauf entscheiden.
- Widget (Rolle 15 F7): erst nach REL-01 (Signing); Deep-Link-Struktur dafür jetzt anlegen, Widget später.
- Wildcard-Route (mein F10) und `?date=`-Begrenzung (F8): nur nebenbei mitnehmen.

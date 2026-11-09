# Diskussion Rolle 03 (Eintrag hinzufuegen), Runde 2

Basis: Berichte der Rollen 01, 02, 04 bis 20 gelesen (Fragen-Abschnitte vollstaendig, Findings per Ueberschrift, bei Bedarf im Detail). Nichts am Code geaendert; keine eigene Live-Messung dazugekommen.

## (a) Zustimmung und Ergaenzung
- Rolle 20 F2 (Kernschleife nur halb belegt) deckt sich mit meinem F1/F10/F11; Ergaenzung: "Schnell eintragen" ist im Add-Sheet ohne Suchfeld-Umweg am wirksamsten, wenn es mit F11 (Name optional) zusammenfaellt.
- Rolle 04 F7 (Zuletzt aus Tagebuch) ist im Add-Sheet schon umgesetzt (`recentFoods`); offen bleibt nur meine F2 (Meal-Bezug, Haeufigkeit, Marke im Dedupe). Das Suchfeld-interne "Eigene zuletzt" (nt-food-search) ist damit doppelt: beides zusammenfuehren.
- Rolle 04 F6 (Debounce 400 ms, Eigene sofort): verstaerkt F10; Eigene/Favoriten sollen synchron erscheinen.
- Rolle 08 F3 (Toast ohne Eiweiss/Essenszeit) = mein F9, gleiche Loesung ("In Fruehstueck eingetragen · 250 kcal · 18 g Eiweiss").
- Rolle 14 F1/F2 und Rolle 15 F1 (Enter-Taste/Return ohne Wirkung): bestaetigen meine F5; Name -> Menge -> Enter = Eintragen ist der wichtigste Einzelhebel auf dem Hauptpfad.
- Rolle 15 F2 (Sheets ohne Breakpoints/Wisch-zum-Schliessen): ergaenzt meine F12; fuer das Add-Sheet zusaetzlich "canDismiss" nur bei dirty (ist schon so).
- Rolle 13 F11 (Undo 5 s, Stapel) trifft den Mehrfach-Schnelleintrag: Wenn F1 (Sheet bleibt offen) kommt, braucht Undo aggregierte Eintraege ("3 Eintraege").
- Rolle 02 F8 und Rolle 06 F5 (Tagebuch/Mahlzeitenzeilen zeigen kcal statt Eiweiss): gleiche Linie wie mein F4.
- Rolle 19 F10 (`reconcileKcal` ueberschreibt still): betrifft das Add-Formular direkt (kcal aus Makros berechnet, kcalManual-Schalter); Badge "berechnet" ist da, aber Rueckschaltung nicht erklaert.

## (b) Widersprueche und Konflikte
1. Rolle 20 F3: Fastfood-Helfer vom Heute-Screen in das Eintragen-Sheet verlagern. Dagegen: Das Sheet ist schon dicht (6 Quellenbuttons, Favoriten, Zuletzt); ein weiterer Einstieg verschlechtert F7/F10. Kompromiss: Fastfood nur als eine Zeile "Was passt noch?" im Sheet-Kopf, wenn Rest-kcal/Eiweiss bekannt ist, oder Profil/Tagebuch-Menue; Heute-Block entfernen.
2. Rolle 04 Q3 (ein Suchfeld statt vier Tabs): Zustimmung zum Ziel, aber nicht Quellenbuttons streichen. Vorschlag: Suchfeld + bei leerem Begriff Favoriten, Zuletzt, "Eigene" als Abschnitt; "Rezept" und "Mahlzeiten" bleiben als Chips, "Eigene" entfaellt als Button (zusammengefuehrt). Siehe meine F7 (Barcode gross).
3. Rolle 15 F2: Add-Sheet mit Breakpoint 0.9. Konflikt mit meiner F5 (Footer/Tastatur): Ein Sheet mit Detent plus Tastatur kann Footer und Chips verdecken. Kompromiss: Breakpoint nur [0, 0.9], Footer sticky, Enter = Eintragen; auf iPhone SE live pruefen.
4. Rolle 14 F5 / Rolle 11 F5 vs. meine F1: Zaehler "3 eingetragen" darf nicht zur Gamification werden (PRODUCT.md: kein Lob/Tadel). Neutral formulieren, keine Serien.
5. Rolle 09 F9 (Busy-Zustand Primaerbutton) vs. Sperre `isSaving`: gleiche Loesung, kein Konflikt; nur sicherstellen, dass nach F1 die Sperre pro Eintrag, nicht pro Sheet-Sitzung zurueckgesetzt wird (heute `isSaving` bleibt nach Schnell-Add bis Neustart; bei offenem Sheet muss sie zurueckgesetzt werden).

## (c) Antworten auf Fragen an meine Rolle
- Rolle 20 Q3 (schnellster Weg, wer hat gemessen?): Nicht gemessen, nur gezaehlt (Code): Favorit/Zuletzt = 2 Taps ab Heute; Neues Lebensmittel = 4 Taps plus Tippen; 3 Zutaten einer Mahlzeit ca. 8 bis 9 Taps (je Zutat Oeffnen + 1). Heute braucht keinen eigenen Ein-Tipp-Pfad ohne Sheet, solange das Sheet nach Eintrag offen bleibt und Favoriten oben stehen. Schnellste Variante waere ein Favoriten-Streifen direkt auf Heute (2 Taps -> 1), aber nur fuer max. 3 Favoriten.
- Rolle 04 Q1 (Suche nach Eiweissdichte vorsortieren): Nein im Eintragen-Flow; Relevanz bleibt, Eiweiss je Treffer anzeigen (meine F4). Sortierung "Eiweissreich" als optionaler Schalter.
- Rolle 09 Q3 (aggregierter Toast statt Live-Region): aus Eintragen-Sicht ja, solange "3 Eintraege" und ein Undo in einer Region liegen (Rolle 07 F7: laenger als 5 s).
- Rolle 14 Q3 (Direktive vs. `nt-input`): Fuer das Add-Sheet reicht eine Enter-Direktive; Wrapper erst bei Formular-Refactoring.

## (d) Top 5 ueber alle Rollen (Nutzen/Aufwand)
1. Enter/Return-Verhalten und Autofokus-Regel im Add-Sheet (Rolle 03 F5/F10, Rolle 14 F1, Rolle 15 F1), S, spart 1 bis 2 Taps pro Eintrag.
2. Portionsgroesse aus OFF + "1 Portion"-Chip (F3), S, trifft Protein-Produkte direkt.
3. Eiweiss in Toast und Listen (F4/F9, Rolle 08 F3, Rolle 02 F8), S.
4. Sheet bleibt nach Schnell-Eintrag offen (F1), M.
5. Datensicherheit/Speicherfehler (Rolle 13 F1, Rolle 20 F1, Rolle 12 F3): S bis M, schuetzt alle Eintraege; zwingend vor Release.

## (e) Streichen oder verschieben
- Rezept-Quellenbutton im Add-Sheet nur mit Rezepten sichtbar lassen (ist so); "Eigene" mit Suchfeld-Liste zusammenlegen (siehe b2).
- Sterne in Zuletzt-Zeilen (F8) in das Edit-Sheet verlagern; Add-Sheet braucht nur Favoriten-Entfernen per Wischen.
- Einkauf/Preis-Features (Rolle 20 F3b) fuer meine Rolle irrelevant; ich unterstuetze das Verschieben, weil sie Entwicklungszeit vom Eintragen abziehen.
- Apple Health/Widget (Rolle 15 F7/F8): nach Eintragen-Verbesserungen; ein Widget "noch Z g" lohnt erst nach F1 bis F4.
- Open-Prices-Preis-Hinweis im Formular (`addPriceHint`) verwirrt im Eintragen-Moment; verschieben oder entfernen.

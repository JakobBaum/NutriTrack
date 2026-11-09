# Diskussion Runde 2: Rolle 06 (Design und Konsistenz)

(a) Zustimmung, die meine Sicht verstaerkt
- R07 F2/F3/F5 (Dynamic Type, Text unter 12 px, E/KH/F als Buchstaben): deckt sich mit meinem F1/F13; ich ergaenze, dass die Typo-Skala als rem-Tokens zuerst kommen muss, sonst wird jede Einzelkorrektur doppelt gemacht.
- R02 F8 und R03 F4 (Eiweiss in Essenszeiten-Zeilen und im Eintragen-Flow): bestaetigt mein F4 (Violett nur auf Heute/Woche). R04 F1 (Eiweiss in Suchtreffern) gehoert in dieselbe Farbregel, Token ist --nt-protein.
- R02 F1/F5 und R10 F1/F3: Heute vs. Vergangenheit und Segment-Zustand; passt zu meinem F3 (gemeinsamer Kopf und `.nt-view-switch`), der Segment-Zustand koennte dort gleich in die URL.
- R08 F9/F12 und R10 F3 (Tab "Rezepte" traegt Mahlzeiten, Doppelname): gleiche Ursache wie mein F7 (Titel "Rezepte" und Reiter "Rezepte").
- R05 F10/F15 (Zeile ueberladen, Scheingenauigkeit der Preise) stuetzt mein F8; R01 F10 und R12 F9a (Inline-Style "Divers") sind Token-Verstoesse wie mein F9.
- R13 F3/F6/F2 und R09 F6 (Toast-Stau, kein Offline-/Speicherzustand): gemeinsames Muster fehlt, siehe (c).
- R11 F7 (Balken ohne Werte): zusaetzlich visuell, Wert und "im Ziel"-Markierung gehoeren in das Balkenmuster.

(b) Widerspruch und Konflikte
1. R20 F3(c) will die sechs Ringe streichen, R02 F2 die Doppelung Hero/Ringe aufloesen; DESIGN.md Regel 1 ("Nichts verschwindet") verbietet Entfernen. Kompromiss: Ringe bleiben, aber die vier kleinen werden zu einer kompakten Zeile mit Balken (R02 F10), Hero und zwei grosse Ringe bleiben. Das entlastet 320 px (mein F12).
2. R20 F3(a) Fastfood-Block von Heute entfernen: nur verschieben, nicht loeschen (Regel 1). Vorschlag: in die Zeile "Helfer" einklappen, kein eigener Block.
3. R09 F3/F5 (Ziel-Moment, Ringanimation) gegen R08 Frage 1 (kein Lob/Tadel): Kompromiss: ruhiger Zustandswechsel ohne Konfetti: Ring schliesst sich einmal, Hero zeigt "Eiweiss erreicht" neutral in Violett, kein Puls, Haptik .success. Bei Ueberschreitung nichts bewerten.
4. R11 F1 (Gewichtskachel auf Heute) gegen R20 "weniger, aber gut": nur eine Zeile "78,6 kg, -0,6/Woche, Eintragen" in der Helfer-Gruppe, keine neue Karte.
5. R12 Frage 3 / R20 F7 (Profil in zwei Bereiche): kein sechster Tab. Profil-Ziele und Gewicht bleiben, Rechtliches/KI/Debug-Log wandern in eine zweite, eingerueckte Gruppe "App" am Seitenende; Debug-Log hinter Schalter (mein F9).
6. R14 Frage 3: Wrapper `nt-input` gegen Direktive. Ich bevorzuge die Direktive (Enter-weiter, Select-All, autocapitalize), weil `.nt-field` schon die Optik traegt; ein Wrapper dupliziert Label/Fehlerzeile je Seite.
7. R04 Frage 3 / R03 F10: vier Erfassungswege als Reiter. Optisch ein Segment, nicht Reiter mit Icons; Kompromiss mit R04: leere Suche zeigt Zuletzt und Eigene als Gruppen.

(c) Fragen an mich/Design
- R07 Q2: Minimum 13 px, Fliesstext 15, Hero als `clamp(40px, 11vw, 56px)` mit rem-Basis; bei 200 % Schrift wird der Hero einspaltig (R02 Q3: ja, Umbruch unter ca. 340 px effektiver Breite).
- R09 Q1: Ja, ein Ziel-Moment ist verbunden mit Violett vertraeglich, wenn er (b3) ruhig bleibt.
- R12 Q3: siehe (b5), kein weiterer Tab.
- R13 Q3: Ja, ein Zustandsbaustein `nt-banner` (oben, nicht-Toast, wiederverwendbar: Offline, Speicherfehler, Kontingent) mit Token-Farben warning/danger und Handlungs-Button; Toast bleibt fuer Bestaetigung plus Rueckgaengig.
- R15 Q3: Ja, `UIUserInterfaceStyle=Light` in Info.plist, passend zur E5-Entscheidung; sonst falsche Tastatur/Systemsheets in Dunkel.
- R08 Q3/R07: Ausgeschriebenes aria-label je Zeile statt nur Legende; visuell reicht "Eiweiss ausgeschrieben, KH/F kurz" (mein F13).
- R02 Q2: Gemeinsames Verb "noch": "noch 62 g Eiweiss", "noch 480 kcal"; Ueberschreitung als "+526 kcal ueber Ziel" (mein F11).

(d) Meine Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Datenhaltung absichern: R13 F1/F5, R16 F2, R20 F1: Auto-Backup vor Import/Reset, Schreibfehler melden (S bis M); Datenverlust schlaegt jedes Design.
2. Eiweiss durchgaengig: mein F4/F5 mit R02 F8, R03 F4, R04 F1, R19 These (S bis M).
3. Gemeinsamer Seitenkopf plus ein "Hinzufuegen"-Muster plus Segment-URL: mein F3/F6/F7 mit R10 F1 (S).
4. Typo-Skala auf rem, Mindestgroesse 13 px: mein F1 mit R07 F2/F3 (M).
5. Zustandsbaustein `nt-banner` und Fehlerkatalog: R13 F3/F6/F8, R08 F2/F5/F6 (M).

(e) Streichen oder verschieben
- Verschieben: F2 (Abstands-/Radius-Rundung), F10 (Elevation), F14 (Leerzustands-Icons) bis nach Typo-Skala und Seitenkopf, per Stylelint absichern.
- Streichen: R20 F3(c) Ringe entfernen (Regel 1), eigener Fastfood-Block statt Loeschung nur einklappen; Apple Health/Widget (R15 F7/F8) nicht vor E8; Mikronaehrstoff-/Wasser-Optik gar nicht erst entwerfen (R20 F5).
- Bewusst nicht: Dunkelmodus (E5 bleibt), keine Gamification (Konfetti, Serien-Streaks als Strafe, R11 F5).

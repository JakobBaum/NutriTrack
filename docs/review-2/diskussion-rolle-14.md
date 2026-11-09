# Diskussion Runde 2: Rolle 14 (Formulare und Eingabefelder)

Gelesen: Berichte 01..13 und 15..20 (Ueberschriften, Befunde zu Eingabe/Tastatur, Schlussfragen).

## (a) Zustimmung
- Rolle 15 F1 korrigiert meinen F1 zu Recht: Der iOS-Zahlenblock (inputmode decimal/numeric) hat keine Return-Taste, enterkeyhint wirkt dort nicht. Mein Befund gilt damit nur fuer Textfelder (Name, Zutat, Artikel). Fuer Zahlenfelder ist die Loesung die "Fertig"-Leiste (Keyboard.setAccessoryBarVisible) und/oder ein sichtbarer "Weiter"-Button. Ich ziehe die Aussage "Enter springt zum naechsten Feld" fuer F2 (Nahrwertfelder) zurueck.
- Rolle 03 F5: Enter auf Menge = Eintragen, Footer nicht unter der Tastatur. Verstaerkt F1/F6; im Mengenfeld (Textfeld mit decimal-Pad) greift wegen Rolle 15 F1 nur die Leiste, nicht Enter.
- Rolle 01 F6: Speichern-Button nur deaktiviert, Fehler erscheinen nie, focusFirstInvalid toter Pfad. Gleiches Muster wie mein F5 (meals-list). Beides gehoert in eine Regel: Button bleibt aktiv, Klick zeigt Feldfehler und fokussiert.
- Rolle 01 F5 (Live-Vorschau "Dein Ziel: ... kcal, ... g Eiweiss") passt zu meinem F8: Wenn Zahlen direkt tippbar sind, wirkt die Vorschau sofort.
- Rolle 01 F4 / Rolle 12 F2 (Profilformular zeigt Altzustand): gleiche Ursache wie mein F6 (Formularzustand wird einmal initialisiert); ein gemeinsamer Fix "beim Oeffnen neu laden".
- Rolle 08 F7 (Abkuerzungen "Kohlenh.", "Ballast.") deckt sich mit meinem F7; Rolle 08 F5 (Ton der Fehlermeldungen) braucht meinen Feldfehler-Katalog.
- Rolle 07 F5 (E/KH/F werden als Buchstaben gelesen) betrifft auch die Beschriftung der Nahrwertfelder; Rolle 07 F4 (Touch-Ziele) gilt fuer Einheiten-Knopf und Stepper.
- Rolle 13 F1/F2 und QAE-02 (Schreibfehler still): gleiche Familie wie mein F4 (stilles Umwandeln in 0 oder Loeschen).

## (b) Widerspruch und Konflikte
1. Rolle 12 F1 (freier Eiweiss-/kcal-Override) gegen Rolle 19 (Obergrenzen, E3): Ein Override ist ein weiteres Zahlenfeld und braucht Feldgrenzen. Kompromiss: Eingabe in g/kg (1,2 bis 2,5), daneben berechnete Gramm, bei Wert ausserhalb ein Hinweis statt Sperre; kcal-Override nur mit Untergrenze-Hinweis. Validierung zentral wie in F4.
2. Rolle 03 F5 ("Enter = Eintragen" im Mengenfeld) gegen mein F1 ("Enter = naechstes Feld"): im Add-Sheet gilt je Feld, nicht global. Name: Enter = Menge fokussieren. Menge: Fertig/Enter = Tastatur schliessen, Eintragen ist sichtbar (Footer). Kein stilles Speichern auf Enter in Feldern mit weiteren Nahrwerten.
3. Rolle 03 F? (Autofokus Suchfeld nur ohne Favoriten) gegen Autofokus-Konvention in Einkauf/Neuanlage: Autofokus nur dort, wo Tippen der erwartete erste Schritt ist (Einkauf "Artikel", Neu-Mahlzeit). Im Add-Sheet: einverstanden mit Rolle 03.
4. Rolle 07 F2 (Dynamic Type/rem) gegen dichte Mehrspalten-Zeilen im Zutatenformular (recipes:193-198, 5 Felder in einer Zeile): Bei grosser Schrift wird die Zeile unlesbar. Kompromiss: zwei Spalten, Label ueber dem Feld, Einheit als Suffix.

## (c) Fragen an meine Rolle
- Rolle 08 Q2 (ein Fehlerkatalog): Ja fuer Feldfehler. Vorschlag: genau drei Muster, "Name fehlt", "Zahl eingeben, z. B. 12,5", "Wert zwischen X und Y" (jeweils mit Einheit). Direkte Ansprache, Punkt am Ende, kein "Fehler:".
- Rolle 03 Q3 (verdeckt die Tastatur den Footer?): Nicht live geprueft; aus dem Code nicht entscheidbar. Aus Formularsicht: Keyboard-Plugin-Konfiguration (resize) und Accessory-Bar einmal auf Geraet testen, bevor Layout geaendert wird.
- Rolle 01 Q3 (e2e Erststart): Ja; zusaetzlich e2e fuer Formulare: Komma-Eingabe "12,5" speichert 12,5; "abc" zeigt Feldfehler; Reset leert das Profilformular.

## (d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Rolle 15 F1: "Fertig"-Leiste fuer Zahlenfelder (S, hoch): behebt das taegliche Tastatur-Haengen ohne Layoutarbeit.
2. Mein F3 + F4: autocapitalize="words" und Feldfehler statt stillem 0 (S bis M): schuetzt Protein/Kalorien-Daten und Anzeige.
3. Rolle 01 F5/F6 + Rolle 12 F2: Profilformular neu laden, Fehler am Feld, Live-Ziel-Vorschau (S): bestimmt den ersten Eindruck.
4. Rolle 02 F2/F8 und Rolle 03 F4: Eiweiss gleichrangig zu kcal in Hero, Listen und Vorschau (S bis M): Kernversprechen.
5. Rolle 13 F1 / QAE-02: Speicherfehler sichtbar melden (S): Datenverlust ist schlimmer als jede Optik.

## (e) Streichen oder verschieben
- Mein F9 (Preis-Alert als Sheet) und F10 (Tausenderpunkt "1.234,5"): verschieben, geringer Nutzen.
- Mein F7 (Einheiten als Suffix im Rezeptformular): zusammen mit Rolle 08 F7 in Welle 4 (Textpass), nicht einzeln.
- Eine allgemeine nt-input-Wrapper-Komponente (meine Frage 3): zurueckstellen. Direktiven (Select-All, autocapitalize, Enter-Weiter fuer Textfelder) reichen und sind einzeln testbar.
- Textfeld im Stepper (F8): nach Gewichtsverlauf, falls Profilaenderungen selten bleiben (Rolle 10/11 Gewicht als eigener Ort).

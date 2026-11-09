# Diskussion Runde 2, Rolle 04 (Lebensmittelsuche)

Gelesen: alle 19 Berichte (bei grossen Berichten gezielt die suchrelevanten Stellen und alle Fragenabschnitte). Keine Quelltext-Aenderung.

Korrektur vorab: Mein F7 ("Zuletzt genutzte fehlen") ist in dieser Form falsch. Favoriten und "Zuletzt benutzt" gibt es im Add-Sheet (Rolle 03 Kopf und F2); ich hatte nur food-search.component geprueft. Offen bleibt: Die Suche selbst kennt nur eigene Lebensmittel als "Zuletzt" und das Sheet hat zwei getrennte "Eigene"-Listen (Tab "Eigene" im Add-Sheet, add-entry-sheet.component.html:138, und Eigene in nt-food-search). F7 ersetze ich durch: beide zu einer Quelle zusammenfuehren.

## (a) Zustimmung
- Rolle 03 F3: Portionsgroesse aus OFF wird ignoriert. Verstaerkt F3/F9 bei mir: `servingG` ist im Provider da (openfoodfacts.provider.ts:188), erreicht aber nie den Eintrag. Groesster Hebel fuer Protein-Produkte (Skyr, Riegel).
- Rolle 03 F4 und Rolle 19 (Eiweiss-Vorrang): Eiweiss in jeder Trefferzeile hervorheben, deckt sich mit meinem F1.
- Rolle 03 F10 (Autofokus verdeckt Favoriten): gleiche Ursache wie mein F6/F10, Suchfeld-Verhalten muss gemeinsam geaendert werden.
- Rolle 03 F2: "Zuletzt fuer Fruehstueck" filtert nicht nach Essenszeit. Gleiche Familie wie Ranking-Qualitaet, gehoert in dieselbe Aenderung.
- Rolle 08 F8: "Keine Treffer ... prueft die Schreibweise" ohne Weg zu "Selbst eintragen". Bestaetigt F5 (Fehlerzustand ohne Handlung), und das Manuell-Angebot erscheint bei Fehler nie.
- Rolle 13 F6 (kein globaler Offline-Zustand) und 17-Rolle (Worker-Quota): bei Suche gilt das Gleiche. Ein `OnlineService`-Signal wuerde F5 und F6 bei mir loesen.
- Rolle 09 (Skeleton fehlt) passt zu meinem F6: Online-Treffer als Platzhalter statt Ausgrauen der alten Liste.
- Rolle 08 F9/F5: Fehlertexte aus food-errors.ts muessen in den gemeinsamen Katalog.

## (b) Widersprueche und Konflikte
1. Rolle 03 F1 (Sheet nach Schnelleintrag offen lassen) gegen Rolle 20/08 (Sheet als kurzer Flow): Ich stimme F1 fuer Suche zu, aber nur mit sichtbarem Zaehler und "Fertig". Konflikt mit meinem F10 (Enter waehlt ersten Treffer): Bleibt das Sheet offen, ist Blindwahl harmloser, weil man sofort Rueckmeldung hat. Kompromiss: Enter nur bei eindeutigem Treffer (Tier 3), sonst Fokus auf Liste.
2. Rolle 03 F7 (Quellenleiste: Barcode gross, Rest als Chips) gegen mein Ziel "Suche zuerst": Kein echter Widerspruch, aber die Suche darf nicht unter Barcode rutschen. Kompromiss: Suchfeld oben, Barcode als Icon im Suchfeld, Rest als Chips.
3. Rolle 13 (Banner statt Toast fuer Offline) gegen mein F5 (Fehler inline mit Retry): Beides. Globales Banner nur fuer "Offline"; Suchfehler (Timeout, Rate-Limit) bleiben inline mit Retry, weil der Nutzer dort handelt.
4. Rolle 03 F11 (Schnell-Modus ohne Namen) und mein F3 (Eigene mit Basis speichern): Schnell-Eintraege duerfen nicht in die Eigenen-Liste, sonst wird sie mit "Schnell-Eintrag" verschmutzt. Regel: Speichern nur mit eigenem Namen.
5. Rolle 09/13 (aggregierter Toast): Bei Mehrfacheintrag aus der Suche muss pro Eintrag Undo erreichbar bleiben, sonst bricht F1 von Rolle 03.

## (c) Antworten auf Fragen an meine Rolle
- Rolle 03 Frage 2 (Verlaesslichkeit `serving_quantity`): Live nicht geprueft. Nach Code (`num()` akzeptiert String/Zahl, provider:188) und OFF-Erfahrung ist das Feld bei vielen DACH-Produkten leer, teils auf ml bezogen oder wertlos. Empfehlung: nur verwenden, wenn 1 bis 1000 und Basis per100g; sonst weiter 100 g. Dazu eine kleine lokale Portionstabelle (Ei 60 g, Scheibe Brot 40 g, Riegel, Becher Skyr 150 g) fuer Basislebensmittel; als Chips, nie als stille Vorbelegung ohne Anzeige.
- Rolle 19 Frage 3 (5 Referenzrezepte mit BLS-Sollwerten): Fuer Suche sinnvoll als Regressionstest des Rankings: je Begriff ("Haehnchenbrust", "Haferflocken", "Skyr", "Quark", "Reis") muss in den Top 3 ein plausibles Produkt stehen (Plausibilitaetsfilter F8). Braucht aufgezeichnete OFF-Antworten als Fixture, nicht Live-Aufruf.
- Rolle 13 Frage 2 (strukturierter Worker-Fehlercode): Ja, auch fuer `/off-search`: `rate-limit` ist dort heute nicht unterscheidbar von `server`.

## (d) Top 5 ueber alle Rollen (Nutzen/Aufwand)
1. Rolle 03 F3 plus mein F1/F3: OFF-Portion als Chip/Vorbelegung, Eiweiss in jeder Zeile (S). Taegliche Hauptschleife.
2. Rolle 03 F10: Autofokus nur ohne Favoriten/Zuletzt (S). Sofort spuerbar auf dem iPhone.
3. Mein F5 plus Rolle 08 F8 plus Rolle 13 F6: Retry und "Manuell eintragen" bei Fehler und Offline (S).
4. Rolle 03 F2: "Zuletzt" nach Essenszeit und Haeufigkeit (S bis M); danach Suche mit Zuletzt-Liste verbinden.
5. Mein F2: Eigene Lebensmittel bearbeiten und loeschen (M). Ohne das bleiben Tippfehler dauerhaft.

## (e) Streichen oder verschieben
- Verschieben: F9 (Filterchips, "Mehr Treffer", lokale Basisliste) bis nach Entscheidung E8 und Gewichts-/Eintrag-Flow; F4 (Synonyme/"Meintest du") erst nach Fixtures aus (c).
- Streichen: F11 als eigenes Paket; in den Sammel-A11y-Durchgang von Rolle 07 geben. F10 (Hinweis erst spaeter) nur mitnehmen, wenn ohnehin an der Suche gearbeitet wird.
- Nicht jetzt: eigenes Dedupe-Raster (F8) ohne echte Datenbasis; erst Plausibilitaetsfilter, dann messen.

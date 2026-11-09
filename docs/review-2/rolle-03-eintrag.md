# Rolle 03: Tagebuch-Eintrag hinzufuegen (Runde 2)

Grundlage: Code-Lektuere (Add-Sheet, Food-Sources, Amount-Row, Diary-/Dashboard-Seite). App nicht live getestet; Tastatur-/Layoutaussagen sind Vermutungen (?). Nichts aus REVIEW-ERGEBNIS.md wiederholt (Favoriten existieren inzwischen, COA-04 ist erledigt).

Tap-Bilanz (Ist): Schnellweg Favorit/Zuletzt = Oeffnen + 1 Tap (2). Neues Lebensmittel = Oeffnen + tippen + Treffer + Menge tippen + "Eintragen" (4 Taps plus Text). Eintrag mehrerer Dinge in eine Mahlzeit = je Lebensmittel erneut Oeffnen.

F1. Sheet schliesst nach jedem Schnell-Eintrag
- Befund: `addAndConfirm` ruft `closeAdd()` (add-entry-sheet.component.ts:575); gilt auch fuer Favorit, Zuletzt, Rezept, Mahlzeit-Vorlage und `save()` (:650).
- Auswirkung: Ein Fruehstueck mit 3 Zutaten = 3x Oeffnen (Pille, Sheet, Mahlzeit neu waehlen?). Haeufigster Alltagsfall wird langsam.
- Vorschlag: Nach Schnell-Eintrag offen bleiben, kurze Bestaetigung im Sheet (Haken an der Zeile, Zaehler "3 eingetragen"), Kopfzeilen-Button "Fertig" statt "Abbrechen" sobald >=1 Eintrag. Undo-Toast bleibt.
- Aufwand M. Prioritaet hoch.

F2. "Zuletzt benutzt · fuer Fruehstueck" filtert gar nicht nach Essenszeit
- Befund: Ueberschrift nennt `selectedMealLabel()` (add-entry-sheet.component.html:75), aber `recentFoods(8)` sortiert nur nach `createdAt` global (diary.store.ts:280-291, kein Meal-Parameter). Dedupe nur per Label (Gross/Klein, Marke egal).
- Auswirkung: Irrefuehrende Beschriftung; abends stehen Fruehstuecksprodukte oben; Wechsel des Meal-Chips aendert die Liste nicht.
- Vorschlag: `recentFoods(limit, meal)`: erst Eintraege der gewaehlten Essenszeit nach Haeufigkeit (letzte 30 Tage), mit Rest auffuellen; Dedupe nach Label+Marke. Alternativ Ueberschrift ehrlich "Zuletzt benutzt".
- Aufwand S-M. Prioritaet hoch.

F3. Portionsgroesse aus Open Food Facts wird im Tagebuch ignoriert
- Befund: Provider liefert `servingG` (openfoodfacts.provider.ts:188), Mahlzeiten und Rezepte nutzen es (meals-list.component.ts:179, recipes.page.ts:577), `onSource` im Add-Sheet nicht: Vorgabe immer 100 g (`DEFAULT_AMOUNT_G`, :92, :584). Chips nur 50/100/150/200 (diary-helpers.ts:242).
- Auswirkung: Riegel, Joghurtbecher, Skyr (Protein!) muessen von Hand umgerechnet werden; Portionswahl fehlt im Kern-Flow.
- Vorschlag: `servingG` durchreichen; Chip "1 Portion (35 g)" an erster Stelle, Vorbelegung auf Portion. Fuer Eigene/ohne Daten: Chip-Set pro Einheit lernen ("wie zuletzt" gibt es schon).
- Aufwand S. Prioritaet hoch.

F4. Protein fehlt im Eintragen-Flow ausser in der Vorschau-Zeile
- Befund: Favoriten-/Zuletzt-Zeilen zeigen nur Menge und kcal (html:61, :83); Rezept-/Eigene-Listen nur kcal (:99, :128, :153); Vorschau "Eiweiss ... g" steht klein im Fliesstext (:202-205). Mahlzeit-Vorlagen: nur kcal (:170).
- Auswirkung: Bei einer Protein-App entscheidet man blind; Fliesstext-Vorschau ist beim Mengenwaehlen das wichtigste Feedback, aber typografisch gleichrangig mit Fett/KH.
- Vorschlag: In allen Listen "30 g Eiweiss" neben kcal; Vorschau als zwei grosse Zahlen (kcal, Eiweiss) plus kleine KH/Fett-Zeile; optional "noch X g Eiweiss heute" nach Eintrag.
- Aufwand S. Prioritaet hoch.

F5. Kopfzeile und Footer: "Abbrechen" ersetzt "Zurueck", Primaeraktion nur in Formansicht
- Befund: Header zeigt links Zurueck (nur ausserhalb Suche), rechts immer "Abbrechen" (html:16); Footer "Eintragen" nur bei `view()==='form'` (:249). Footer ohne Safe-Area-/Tastaturgarantie (? nicht in scss geprueft; MUX-04 bekannt).
- Auswirkung: Bei offener Tastatur (Menge fokussiert nach 150 ms, :461) kann der Button unter der Tastatur liegen; Nutzer muss erst "Fertig" tippen = +1 Tap.
- Vorschlag: Footer an Tastatur koppeln (Ionic keyboard-Event/`ion-footer` im Modal ist bei iOS-Capacitor mit `Keyboard.resize: 'body'`?), Enter-Taste auf Mengenfeld = Eintragen (`enterkeyhint="done"` ist gesetzt, loest aber nichts aus). Das spart 1 Tap im Hauptweg.
- Aufwand S. Prioritaet hoch.

F6. Mahlzeit-Zuordnung: gut erkannt, aber Wechsel ist versteckt und Standard unsicher
- Befund: Chips ganz oben (html:26), Vorbelegung `mealForHour` bzw. Kontext. Die Stunden-Grenzen (11 Uhr Mittag etc.) sind fix; Snack-Zeiten (15-17 Uhr) fallen vermutlich unter Mittag/Abend. Chips "Frueh/Mittag/Abend/Snacks" (diary-edit.ts:MEAL_SHORT) inkonsistent zu Titel "Zu Fruehstueck".
- Auswirkung: Spaetes Frueh-/Nachmittags-Tippen landet falsch; Korrektur erst nach Eintrag (Edit-Sheet, mehrere Taps).
- Vorschlag: Standard = Essenszeit mit den wenigsten Eintraegen heute innerhalb plausibler Zeitfenster; Chips auch in der Formansicht sichtbar halten (sind sie, da oberhalb des switch) und Titel auf Chip-Label abstimmen. Letzte Wahl nicht merken (verwirrt).
- Aufwand S. Prioritaet mittel.

F7. Scan-/Foto-Wege: Etikett-Foto vor Barcode, Kamera nicht prominent
- Befund: Quellenleiste: Barcode, Etikett, Rezept, Eigene, Mahlzeiten, Manuell in einer Reihe (food-sources.component.html:2-16), alle gleich gross, bis zu 6 Buttons auf 320-375 px (umbrechen?). Kein "Foto vom Essen -> KI" (nur Etikett).
- Auswirkung: Haeufigster Schnellweg (Barcode) gleichrangig mit Randfunktionen; Quellen-Buttons verdraengen Favoriten/Zuletzt nach unten (auf iPhone SE nur 1-2 Zeilen sichtbar, ?).
- Vorschlag: Zeile 1: Barcode gross (Primaer) + Suche; zweite Zeile klein: Etikett, Rezept, Eigene, Mahlzeiten, Manuell als scrollbare Chips. Favoriten oberhalb der Quellen, wenn vorhanden.
- Aufwand M. Prioritaet mittel.

F8. Zeilen mit drei Aktionen sind eng und uneindeutig
- Befund: Zuletzt-Zeile: Hauptbutton (Plus), Stern, Text-Button "Anpassen" (html:79-91). Favoriten-Zeile: Plus + gefuellter Stern (zum Entfernen, :66).
- Auswirkung: Auf 320 px kuerzt der Name stark; Plus-Kreis ist ein reiner Tap-Bereich der ganzen Zeile, "Anpassen" ist fuer die 80%-Frage (andere Menge) die wichtigste Zusatzaktion, aber ein Text-Link; gefuellter Stern in Favoriten wirkt wie "ist Favorit", loescht aber (Verwechslung/Fehltipp).
- Vorschlag: Zeilentipp = Standard-Eintrag, Kurzbeschriftung mit Menge/Eiweiss als zweite Zeile; "Anpassen" als Chevron/Stift-Icon; Stern aus Zuletzt-Liste in Edit-Sheet verlagern (existiert dort schon: edit-favorite), Entfernen via Wischen.
- Aufwand S-M. Prioritaet mittel.

F9. Schnell-Eintrag ohne Mengenkontrolle
- Befund: `quickAddRecent` uebernimmt letzte Menge ohne Sichtbarkeit im Eintragen-Moment ausser Meta-Text (html:83); Toast zeigt nur kcal (:577), nicht Menge/Mahlzeit/Eiweiss.
- Auswirkung: Fehleintraege fallen erst spaet auf; Toast sagt nicht, in welche Essenszeit gebucht wurde.
- Vorschlag: Toast: "Skyr 200 g in Fruehstueck · 24 g Eiweiss"; zusaetzlich "Menge aendern" im Toast (oeffnet Edit).
- Aufwand S. Prioritaet mittel.

F10. Leerzustand und Fehlerpfade im Sheet
- Befund: Ohne Historie nur "Suche oder scanne ein Lebensmittel." (html:109); Suchstart erst nach Fokus-Delay (60 ms, :94), `didPresent` fokussiert -> Tastatur oeffnet jedes Mal, auch wenn man scannen/Favorit tippen will (verdeckt Favoriten/Zuletzt, ? iPhone halbe Hoehe).
- Auswirkung: Haeufigster Schnellweg (Favorit/Zuletzt) wird durch die automatisch aufpoppende Tastatur halb verdeckt, Nutzer muss sie erst wegtippen (+1 Tap).
- Vorschlag: Autofokus nur, wenn keine Favoriten/Zuletzt vorhanden; sonst Fokus erst bei Tipp auf Suchfeld. Leerzustand: 3 Vorschlaege (haeufig + proteinreich) statt nur Text.
- Aufwand S. Prioritaet hoch.

F11. Kein Eintrag nach Menge/Gewicht ohne Namen ("Schnell hinzufuegen kcal/Protein")
- Befund: Manueller Weg verlangt Name, dann Accordion "Naehrwerte anpassen" mit 8 Feldern (html:187-239); `openManualEntry` oeffnet Accordion, kcal Pflicht.
- Auswirkung: Restaurant-/Schaetz-Eintrag ("ca. 600 kcal, 30 g Eiweiss") = Name + Menge-optional + 2 Felder scrollen; zu viele Felder, kein Name-Vorschlag.
- Vorschlag: Eigener "Schnell"-Modus: 2 grosse Felder (kcal, Eiweiss), Name optional (Standard "Schnell-Eintrag"/Essenszeit), 1 Tap.
- Aufwand M. Prioritaet mittel.

F12. Sheet-Hoehe: immer volle Hoehe, keine Detents
- Befund: Add-Modal ohne Breakpoints (html:2); Dashboard-Modal anderer Sheets nutzt [0, .55, .9].
- Auswirkung: Sheet deckt das Tagebuch komplett ab; man sieht nicht, was schon gegessen wurde/Restwerte (Entscheidungshilfe fuer Protein).
- Vorschlag: Kopfzeile des Sheets mit "Heute: 78/140 g Eiweiss, 1.240 kcal uebrig" (eine Zeile) oder Detent 0.9.
- Aufwand S. Prioritaet niedrig.

Fragen/Thesen an andere Rollen
1. Coach/PM: Ist "Eintragen" in 2 Taps (Favorit) wichtiger als jede neue Auswertung? These: Schnell-Pfade (F1, F2, F10) vor Verlauf/Wochenansicht.
2. Daten/Lebensmittel: Wie verlaesslich ist `serving_quantity` bei OFF fuer deutsche Produkte; reicht eine eigene Portionstabelle (Ei, Scheibe, Riegel)?
3. iOS/Layout: Verdeckt die Tastatur den Footer "Eintragen" und die Favoritenliste auf iPhone SE/15 tatsaechlich (Keyboard.resize-Konfig)? Bitte live pruefen.

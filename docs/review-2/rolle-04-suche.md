# Review 2, Rolle 04: Lebensmittelsuche

Methode: Code-Lektüre (food-search, diary-search, combined-food-search, food-search-clean, custom-food-search, openfoodfacts.provider, food-row, custom-food.store, add-entry-sheet). Live-App und OFF-API nicht geprüft. Nicht doppelt gemeldet: FDB-01/03/04/05/06/07/08, QAS-07, STA-01 (Timeout ist inzwischen drin, 10 s).

F1. Protein-Ranking fehlt, Kernversprechen der App
Befund: `rank()` (food-search-clean.ts:194) sortiert nur nach Namens-Tier, "verarbeitet" und Locale. Protein spielt keine Rolle; bei "Quark", "Skyr", "Hähnchen" steht Beliebiges vor dem Produkt mit viel Eiweiß. Die Zeile zeigt Eiweiß zwar (food-row.component.ts:31), aber gleich gewichtet mit kcal.
Auswirkung: Jakob sucht gezielt eiweißreiche Lebensmittel und muss Zeilen vergleichen.
Vorschlag: Eiweiß in der Zeile hervorheben (fett, eigene Farbe nach E6) und je 100 g plus bei Portionen anzeigen; optional Umschalter "Nach Eiweiß sortieren" über der Trefferliste (Protein je 100 kcal als Sortierschlüssel).
Aufwand: S bis M. Priorität: hoch.

F2. Eigene Lebensmittel nicht verwaltbar
Befund: `CustomFoodStore` hat `remove()` und `clear()` (custom-food.store.ts:49,55), aber `remove` hat keinen UI-Aufrufer (settings.page.ts:349 nutzt nur `clear`). Kein Bearbeiten, kein Umbenennen, kein Löschen. `save()` überschreibt gleichnamige still (Z. 44), auch bei Tippfehler-Varianten bleiben Dubletten.
Auswirkung: Falsch eingetragene Werte (z. B. Tippfehler bei Eiweiß) bleiben dauerhaft im Ranking oben (eigene Treffer stehen immer vor OFF) und sind nicht korrigierbar.
Vorschlag: Liste "Eigene Lebensmittel" (Profil/Einstellungen oder im Tab "Eigene") mit Swipe-Löschen, Antippen zum Bearbeiten; Hinweis beim Überschreiben ("Ersetzt vorhandenes ...").
Aufwand: M. Priorität: hoch.

F3. Eigene Lebensmittel werden nur bei Nicht-Gramm-Einheit gespeichert, Basis unklar
Befund: `shouldRememberAsCustomFood` (diary-helpers.ts:273) lehnt `baseUnit === 'g'` ab; gespeichert werden Nährwerte "perPortion" ohne Einheit/Portionsgröße (custom-food-search.ts:19, `customToFoodItem` ohne servingG/quantity). Zeile zeigt "/ Portion" ohne zu sagen, wie groß die Portion ist.
Auswirkung: Wer ein Lebensmittel pro 100 g manuell anlegt, findet es nie wieder; wer eines pro Portion anlegt, sieht nicht, wie viel "Portion" ist.
Vorschlag: Beim Speichern Basis (100 g oder Portion mit Grammzahl) mitführen und in der Zeile anzeigen ("pro 100 g" / "1 Portion = 250 g"); Speichern-Schalter sichtbar machen ("Für später merken").
Aufwand: M. Priorität: hoch.

F4. Tippfehler und Wortformen: keine Toleranz
Befund: Suche ist ein einzelner Server-Query (`q`, provider:92); lokal gibt es nur Diakritika-Faltung. Eigene Treffer: reines Teilstring-/Präfix-Matching (custom-food-search.ts:27), kein Plural/Kompositum ("Haferflocken" findet "Hafer" nur per Präfix, "Flocken Hafer" per Token-Regel). Der Hinweis bei 0 Treffern ("prüfe die Schreibweise", diary-search.ts:84) ist die einzige Hilfe.
Auswirkung: "Hähnchenbrust" vs "Hühnerbrust", "Joghurt/Jogurt", "Skyr" Schreibvarianten liefern leer oder Müll.
Vorschlag: Kleine lokale Synonym-/Variantentabelle (jogurt/joghurt, huhn/hähnchen/hühnchen, ei/eier) und automatische Wiederholung der Suche mit Stamm (letzte Silbe/Plural abschneiden) bei 0 Treffern; "Meintest du ..." als Chip.
Aufwand: M. Priorität: mittel.

F5. Fehler- und Leerzustand ohne Handlung
Befund: Fehler (food-search.component.html:36) und "Keine Treffer" erscheinen als Text ohne "Erneut versuchen"-Button; bei Fehler ohne eigene Treffer bleibt nur "Manuell eintragen" (nur wenn `noResults`, Z. 38, das bei Fehler nie gesetzt wird). Offline (häufig unterwegs, iPhone): leere Seite mit rotem Text, kein Weg zum manuellen Eintrag über die Suche.
Auswirkung: Gerade beim Einkaufen/Essen unterwegs bricht der Flow ab; Jakob muss den separaten Tab "Manuell" finden.
Vorschlag: Bei Fehler Button "Erneut versuchen" plus "Manuell eintragen" anzeigen (`noResults || error()`); Fehlerzeile mit Icon, nicht nur Text.
Aufwand: S. Priorität: hoch.

F6. Debounce 400 ms plus Mindestlänge 2 wirkt träge
Befund: SEARCH_DEBOUNCE_MS = 400 (diary-search.ts:5), dazu 10-s-Timeout, Server holt 2x Kandidaten. Die Liste wird beim Tippen nur ausgegraut (`results--stale`), nicht aktualisiert. Eigene Treffer sind lokal und sofort verfügbar, warten aber auch auf den Netzaufruf (`withCustomFoods` wartet auf `remote`, combined-food-search.ts:20).
Auswirkung: Eigene/zuletzt genutzte Lebensmittel erscheinen erst nach 400 ms + Netzlatenz; bei Funkloch bis zu 10 s.
Vorschlag: Eigene Treffer sofort (synchron) zeigen, Online-Treffer nachladen und darunter einfügen; Debounce auf ca. 250 ms, nur für den Online-Teil.
Aufwand: M. Priorität: mittel.

F7. Zuletzt genutzte OFF-Produkte fehlen
Befund: Nur eigene Lebensmittel werden als "Zuletzt" angeboten (food-search.component.ts:44, `recentCustomFoods`, nur 5, nur mit `showRecentCustom`). Tagebuch-Einträge aus OFF-Treffern oder Scans werden nicht wiederauffindbar gespeichert (siehe FDB-04). Bei Mahlzeiten-Picker wird `showRecentCustom` aktiv, im Hauptsheet nicht (Tab "Eigene").
Auswirkung: Wiederholte Mahlzeiten (Skyr, Haferflocken, Proteinriegel) erfordern jedes Mal erneute Suche gegen die Online-Datenbank.
Vorschlag: "Zuletzt gegessen" aus dem Tagebuch ableiten (häufigste/jüngste 8 Lebensmittel, inkl. letzter Menge), sichtbar bei leerem Suchfeld.
Aufwand: M. Priorität: hoch.

F8. Datenqualität: unplausible Makros ungeprüft
Befund: `toFoodItem` (provider:159) übernimmt OFF-Werte unverändert; keine Plausibilitätsprüfung (Protein+Kohlenhydrate+Fett > 100 g, kcal gegen Atwater-Summe, kcal > 900 je 100 g). Kein Marker "Daten unsicher". Dedupe nach Name+Marke+kcal (Z. 161 in clean) lässt Varianten mit 1 kcal Unterschied stehen.
Auswirkung: Ein falscher OFF-Eintrag (typisch bei Nutzer-Uploads: Werte je Portion statt je 100 g) fließt unbemerkt in Tagesziele ein.
Vorschlag: Treffer mit Summe Makros > 105 g oder Atwater-Abweichung > 30 % entweder verwerfen oder nach hinten ranken und mit Warnmarke "Werte prüfen" kennzeichnen; Dedupe auf 5-kcal-Raster.
Aufwand: S bis M. Priorität: mittel.

F9. Trefferliste ohne Orientierung bei Mehrdeutigkeit
Befund: Zeile zeigt Name, "Marke · Packungsgröße", Meta (food-row.component.html). Rohes OFF ("Haferflocken" aus 30 Marken) ist nicht von "Haferflocken zart, Dr. Oetker" unterscheidbar, wenn Marke fehlt (`normalizeBrand` blendet Marke aus, wenn sie im Namen steht). Keine Gruppierung generisch vs. Marke, "Treffer" ist die einzige Überschrift (food-search.component.html:44). Maximal 12 Treffer, kein "Mehr laden".
Auswirkung: Bei generischen Begriffen ("Reis", "Milch") sind wichtige Varianten (roh/gekocht, Vollmilch/fettarm) nicht auffindbar, wenn sie hinter Platz 12 liegen.
Vorschlag: "Mehr Treffer" Button (Page 2) und Filterchips "Alle / Eigene / Marken / Ohne Marke"; Standardwerte für Basislebensmittel (roh) lokal mitliefern (kleine Liste der 150 häufigsten, vgl. CMP-05).
Aufwand: M bis L. Priorität: mittel.

F10. Mindestlänge-Hinweis und Enter-Verhalten
Befund: Hinweis "Gib mindestens 2 Zeichen ein." erscheint ab dem ersten Zeichen (diary-search.ts:55) als nörgelnder Text; Enter wählt blind den ersten Treffer und trägt ihn sofort ein (food-search.component.ts:73). Bei Ranking-Fehlern führt Enter zu falschem Lebensmittel ohne Rückfrage; es gibt keine Rückmeldung welcher gewählt wurde außer dem Folge-Sheet.
Auswirkung: Gefahr falscher Einträge; Hinweis stört beim normalen Tippen.
Vorschlag: Hinweis erst nach 1 s Pause oder weglassen; Enter hebt ersten Treffer hervor (Fokusrahmen) statt ihn zu wählen, oder Enter nur wenn Treffer eindeutig (Tier 3).
Aufwand: S. Priorität: niedrig.

F11. Barrierefreiheit der Suche
Befund: Trefferliste als `ion-list` mit Buttons ohne `role="listbox"`; Ladezustand `role="status"` ist gut, aber Trefferanzahl wird nicht angesagt ("12 Treffer"). `data-credit`-Link öffnet extern ohne Ankündigung. "Eigen"-Tag nur visuell (food-row.component.html:5, kein SR-Text außer Inhalt).
Auswirkung: VoiceOver-Nutzer bekommen keine Rückmeldung zum Ergebnis.
Vorschlag: Live-Region "12 Treffer" bzw. "Keine Treffer" (sr-only), `aria-label` der Zeile "Name, Marke, kcal, Eiweiß".
Aufwand: S. Priorität: niedrig.

Fragen/Thesen an andere Rollen
1. An Rolle Produkt/Coach: Soll die Suche standardmäßig nach Eiweißdichte (g Eiweiß je 100 kcal) vorsortieren, oder bleibt Relevanz zum Suchbegriff König und Eiweiß nur Anzeige?
2. An Rolle Daten/Offline: Wie viel Lebensmittelbasis (BLS/Eigenliste) darf lokal ausgeliefert werden, damit Suche ohne Netz und ohne OFF-Datenmüll für Basislebensmittel funktioniert (F5, F8, F9)?
3. An Rolle UX/Flow: Brauchen wir überhaupt vier Wege (Suche, Eigene, Zuletzt, Mahlzeiten) als getrennte Tabs, oder reicht ein Suchfeld, das bei leerem Begriff "Zuletzt gegessen" plus "Eigene" zeigt (F7)?

# Rolle 02: Dashboard / Heute-Tab (Runde 2)

Basis: Code-Lektüre von dashboard.page.{html,ts,scss}, dashboard-math.ts, progress-ring, date-nav, Tokens. App nicht gestartet, alles ungeprüft auf Gerät. Schon umgesetzt seit Runde 1 (nicht erneut gemeldet): Eiweiß-Hero "noch Z g", große/kleine Ringe, Eiweiß ohne Rot, Energieanteile, Tageswechsel, Eiweiß je Essenszeit, violette Eiweißfarbe.

F1. Wochenkontext fehlt komplett (dashboard.page.html:3, date-nav.component.html:1-12)
Befund: Navigation nur Tag für Tag und Kalender-Popup. Kein Hinweis, ob die letzten Tage im Ziel lagen.
Auswirkung: Trend ("Treffe ich Eiweiß meistens?") ist der Hauptnutzen eines Trackers und auf Heute nicht sichtbar.
Vorschlag: 7-Tage-Streifen unter der Datumsleiste (Mo-So, je Tag ein kleiner Ring/Punkt: Eiweiß-Ziel erreicht gefüllt, teilweise halb, leer; heutiger Tag markiert; Tippen wechselt den Tag). Daten aus `diary.totalsForDate`. Darunter optional "Ø Eiweiß 7 Tage".
Aufwand: M. Priorität: hoch.

F2. Doppelte Information: Hero und Ringe zeigen dieselben Werte (html:30-78)
Befund: kcal und Eiweiß erscheinen zweimal, als 48-px-Zahl plus "X von Y" (Hero) und als 88-px-Ring mit "gegessen" in der Mitte plus "von Y" (Ringe). Zwei Zahlenrichtungen (übrig/noch gegen gegessen) auf einem Screen.
Auswirkung: Kernzahlen konkurrieren, Seite wird länger, Essenszeiten rutschen unter die Falz.
Vorschlag: Hero streichen und die Restzahl in den Ring (Mitte: "noch 62 g", darunter klein "98 von 160"), oder Ringe streichen und nur Hero plus Fortschrittsbalken behalten. Empfehlung: Ringe zu den Hero-Spalten machen (Ring 96 px, Restzahl innen).
Aufwand: M. Priorität: hoch.

F3. Hero bei 320 px wahrscheinlich zu eng (scss:88-152, html:33-39)
Befund: Zwei Spalten, je ca. 135 px. `.hero__big` fest 48 px mit -1.5 px Spacing; "2.150" braucht ca. 130 px. Chip "über Ziel" hängt inline an der Einheit und bricht um.
Auswirkung: Überlauf/Umbruch bei 4-stelligen kcal und bei Überschreitung, genau im wichtigsten Element. Feste px, kein Dynamic Type.
Vorschlag: `font-size: clamp(36px, 11vw, 48px)` (bzw. rem), Chip in eigene Zeile unter die Zahl, mit Playwright bei 320/375/430 und 4-stelligen Werten prüfen.
Aufwand: S. Priorität: hoch.

F4. Leerer Tag dimmt alles auf 45 % (scss:267-269, html:61)
Befund: `.macros--empty .macros__col {opacity:.45}` greift auch auf Ziele und Beschriftungen. Grau 13 px auf 45 % liegt deutlich unter 4,5:1.
Auswirkung: Am Morgen, wenn Jakob die Zielwerte am meisten braucht, sind sie am schlechtesten lesbar. Hinweis "Noch nichts eingetragen" steht unter den Ringen statt als Handlung.
Vorschlag: Nur Ring-Füllung/Zahl in der Mitte dämpfen, Text normal lassen. Hinweis durch Handlung ersetzen ("Frühstück eintragen" als Primärknopf), Hinweis über die Ringe.
Aufwand: S. Priorität: mittel.

F5. Vergangene Tage zeigen Heute-Logik (html:21,23,35,124; ts:239-249)
Befund: Hero sagt auch für gestern "kcal übrig"; Fastfood-Helfer mit "kcal übrig, was passt?" erscheint auch rückwirkend (VIZ-09 aus Runde 1 noch offen); "Eintragen" wählt Essenszeit nach aktueller Uhrzeit, nicht nach Kontext des Tages.
Auswirkung: Rückblick wirkt wie ein falscher Live-Zustand, Fehleinträge auf den falschen Tag/Zeit.
Vorschlag: Bei `!isToday()`: Hero als Bilanz ("-120 kcal unter Ziel", "Eiweiß: 138 von 160 g"), Helfer-Sektion ausblenden, "Eintragen" ohne Zeit-Vorauswahl bzw. "Nachtragen".
Aufwand: S. Priorität: mittel.

F6. Eiweiß-Ziel erreicht verdrängt die Zahl (html:45-47)
Befund: Bei Erreichen steht im 48-px-Slot das Wort "Ziel" statt einer Zahl; die Menge steht nur klein in der Meta-Zeile.
Auswirkung: Wichtigstes Erfolgsmoment ohne Zahl, Layout springt (Wort statt Ziffern, andere Breite).
Vorschlag: Große Zahl "152 g" in Eiweißfarbe, Unterzeile "Ziel erreicht" mit Haken-Icon; über Ziel "+12 g".
Aufwand: S. Priorität: niedrig.

F7. Energieanteil-Zeile unklar und lang (html:72-74, math:30-40)
Befund: Satz mit drei Prozentwerten in 13 px, umbricht bei 320 px auf 3 Zeilen. Überschrift "gegessene Energie" stimmt nicht exakt, Basis sind nur P/K/F (Alkohol, Ballaststoffe fehlen), ohne Bezug zum Ziel-Verhältnis.
Auswirkung: Information ohne Handlungsbezug, optisch laut.
Vorschlag: Gestapelter 3-Segment-Balken (Eiweiß violett, KH, Fett) mit Zielmarken und Legende "E 28 % · KH 44 % · F 28 %"; Text-Satz entfällt.
Aufwand: M. Priorität: niedrig.

F8. Essenszeiten-Zeilen betonen kcal statt Eiweiß (html:96-113)
Befund: Rechts steht fett "420 kcal", Eiweiß nur klein im Untertitel; leere Zeilen zeigen "0 kcal". Kein Blick auf Inhalte.
Auswirkung: Widerspricht dem Produktfokus Protein; "Wo fehlt Eiweiß?" lässt sich nicht scannen.
Vorschlag: Rechts "31 g E" (Eiweißfarbe) plus kcal grau darunter, leere Zeile ohne Zahl nur mit "+"-Symbol; optional dünner Eiweißbalken pro Essenszeit.
Aufwand: S. Priorität: mittel.

F9. Drill: `track item.label` bei doppelten Namen (html:170)
Befund: Zwei Einträge mit gleichem Label (zweimal "Ei") erzeugen doppelte Track-Keys (Angular-Warnung, falsches DOM-Recycling). Hinweistext "Prozentwerte zeigen Anteil an der Tagessumme" bleibt trotz Ziel-Prozent (html:165-168) verwirrend; keine Gruppierung nach Essenszeit.
Auswirkung: Fehlerhafte Anzeige bei Tests/Duplikaten, Drill beantwortet "Woher kam mein Eiweiß?" nur halb.
Vorschlag: `track $index`, Prozent als Anteil am Ziel in der Zeile (Balken gegen Ziel), Sortierung bleibt; optional Umschalter "Nach Essenszeit".
Aufwand: S. Priorität: mittel.

F10. Ringe ohne Tipp-Affordance, Sekundärringe sehr klein (html:62-70, scss:226-242)
Befund: Alle Kacheln sind Buttons (Drill), aber ohne Chevron/Hinweis. Sekundärringe 56 px mit 13 px Zahl und Namen mit Soft-Hyphen ("Kohlen-hydrate").
Auswirkung: Drill wird nicht entdeckt; kleine Ringe wirken überladen für Werte, die selten Handlung auslösen (Ballaststoffe, Zucker).
Vorschlag: Sekundärwerte als vier kompakte Zeilen mit Mini-Balken (Label links, "52 / 180 g" rechts) statt Ringen; spart Höhe, besser lesbar, Dynamic Type tauglicher.
Aufwand: M. Priorität: mittel.

F11. Toter Code im Dashboard (ts:74, scss:1-8, 30-33, 82-85, 168-177)
Befund: `dateLabel` ungenutzt, `.touch-btn`, `.nav-date`, `.hero__over*` ohne Verwendung; `.empty h2` styled, Template nutzt aber `h1` (html:11), daher ohne Stil.
Auswirkung: Wartungsrauschen, Willkommenstitel mit Browser-Standardabständen.
Vorschlag: Entfernen, `.empty h1` stylen.
Aufwand: S. Priorität: niedrig.

Fragen/Thesen an andere Rollen
1. Coach/Ernährung: Reicht "Eiweiß-Ziel erreicht ja/nein" im Wochenstreifen, oder soll auch Mindestschwelle (z. B. 90 %) als "fast" gelten?
2. UX-Text/Begriffe: Hero zeigt "noch" (Eiweiß) und "übrig" (kcal) für dasselbe Konzept; soll es ein gemeinsames Verb geben ("noch 62 g", "noch 480 kcal")?
3. Accessibility/Dynamic Type: Wenn Hero und Ringe auf rem umgestellt werden, ist die Zwei-Spalten-Hero bei 200 % Schrift tragfähig oder muss sie auf eine Spalte umbrechen?

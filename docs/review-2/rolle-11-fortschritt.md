# Rolle 11: Fortschritt, Gewicht, Diagramme, Retention

Stand: 2026-11-09. Reine Code-Lektuere (Pfade relativ zu src/app), App nicht gestartet. Gewichtsverlauf (weight/), Wochenansicht und Serie (diary/week-view/) existieren bereits; die Luecken aus T3 der Runde 1 sind teils geschlossen. Hier nur, was darueber hinaus offen ist.

F1. Gewicht versteckt im Profil
Befund: `app-weight-card` sitzt nur in settings/settings.page.html:29, weit unter Profil und Ziel. Heute-Tab und Tagebuch kennen kein Gewicht.
Auswirkung: Wiegen ist die haeufigste Wiederholungsaktion; Weg dahin: Profil-Tab, scrollen, "Gewicht eintragen". Der Verlauf wird kaum gepflegt, der Trend (braucht 7 Tage Spanne) nie sichtbar.
Vorschlag: Kleine Gewichts-Kachel (aktuell, Trend, "Eintragen") auf Heute oder als dritter Segment-Punkt "Gewicht" im Tagebuch neben Tag/Woche (diary.page.html:13); Karte im Profil behalten.
Aufwand: M. Prioritaet: hoch.

F2. Wochenansicht nur 7 Tage, keine Monats-/Verlaufssicht
Befund: `lastDays(this.today)` feste 7 Tage (week-view.component.ts:97); keine Navigation zu Vorwochen. Rueckblick "wie war der letzte Monat" fehlt.
Auswirkung: Fortschritt zeigt sich ueber Wochen; ohne Vergleich zur Vorwoche kein Gefuehl von Entwicklung.
Vorschlag: Pfeile "Vorwoche/Diese Woche" und Zeile "Ø Eiweiss: +12 g zur Vorwoche"; spaeter 4-Wochen-Ansicht mit Wochenmittel.
Aufwand: M. Prioritaet: hoch.

F3. Gewichtsdiagramm: kein Ziel, kein Zeitfenster, keine Werte
Befund: weight-chart.ts: nur Punkte und Linie, Achse nur min/max (weight-card.component.html:27); `targetWeightKg` (core/models/index.ts:32) wird nicht eingezeichnet; alle Eintraege, kein 30/90-Tage-Umschalter; Punkt-Tap zeigt nichts.
Auswirkung: Nach Monaten wird die Kurve unlesbar; der Abstand zum Ziel, der motivierende Teil, fehlt; Einzelwerte nicht ablesbar.
Vorschlag: Zielgewicht als gestrichelte Linie, Umschalter 30 T / 90 T / Alles, Tap auf Punkt zeigt Datum und kg; Satz "Noch 3,2 kg bis zum Zielgewicht" ohne Fristdruck.
Aufwand: M. Prioritaet: hoch.

F4. Trend nur als "kg pro Woche" ohne Einordnung
Befund: trendText (weight-card.component.ts:~25) liefert "-0,4 kg pro Woche"; vor 7 Tagen steht "Trend nach 7 Tagen" (html:9-11). Kein Bezug zum Ziel (Abnehmen/Halten/Aufbauen).
Auswirkung: Zahl ohne Bedeutung; bei Ziel "Halten" wirkt -0,4 alarmierend, bei Abnehmen gut. Taegliche Schwankung von 1 kg wird ohne Hinweis dramatisch gelesen.
Vorschlag: Einordnung je Ziel ("im Plan", "langsamer als geplant", "stabil") in neutralem Ton plus Satz "Tageswerte schwanken, das Mittel zaehlt". Ton ohne Rot/Warnung.
Aufwand: S. Prioritaet: mittel.

F5. Serie bestraft statt zu motivieren
Befund: `currentStreak` zaehlt nur Tage mit Eiweiss >= 90 % UND kcal 85-105 % (week-stats.ts:36-40); ein einziger Ausrutscher setzt auf 0. Anzeige "0 Tage" (week-view.component.html:16) ohne Rahmung. Nur 7 Tage sichtbar, "Serie" kann aber bis 60 laufen.
Auswirkung: Strenge Kalorien-Obergrenze macht Serien selten; "0 Tage" ist Druck. Protein ist Kern, kcal-Korridor dominiert aber.
Vorschlag: Serie primaer ueber Eiweissziel (oder "Tage mit Eintraegen") fuehren, kcal-Korridor als zweite Stufe; Nullzustand als "Heute faengt eine neue Serie an"; "Bester Lauf" statt nur aktuelle Serie; ein Ruhetag pro Woche verzeihen.
Aufwand: M. Prioritaet: hoch.

F6. Keine Erinnerungen
Befund: Kein @capacitor/local-notifications in package.json (nur haptics, camera, keyboard, status-bar, app); keine Erinnerungsoption in Einstellungen.
Auswirkung: Retention rein auf Gewohnheit; bei Tracking-Apps der staerkste Hebel fuer Tag 7 bis 30. Wieg-Erinnerung fehlt komplett.
Vorschlag: Optional, standardmaessig aus: eine taegliche Uhrzeit "Mahlzeiten eintragen" und optional wochentags "Wiegen". Erst bei Aktivierung Berechtigung anfragen, ein Tipp zum Abschalten. Datenschutztext (DSG) pruefen: lokal, keine Daten verlassen das Geraet.
Aufwand: M. Prioritaet: mittel.

F7. Balkendiagramme ohne Werte und mit Farbe als einzigem Signal
Befund: week-view.component.html:27-34 und 49-55: Balken nur mit Hoehe, Wert nur im aria-label; `inGoal` wird berechnet (week-view.component.ts:55) aber im Template nicht genutzt; Leerer Tag nur 2 % Hoehe.
Auswirkung: Sehende koennen "Mittwoch 142 g" nicht ablesen; Tage im Ziel sind im Diagramm nicht markiert, obwohl "Tage im Ziel" gross oben steht. Kein Bezug Balken zu Kennzahl.
Vorschlag: Zahl ueber/in dem Balken (klein) oder Tap-Anzeige; Tag im Ziel mit Haekchen oder Akzentfarbe markieren; Leertage als Punkt statt Balken.
Aufwand: S bis M. Prioritaet: mittel.

F8. Ziel-Feedback fehlt beim Moment des Erreichens
Befund: Kein Abschluss-Feedback auf Heute (kein Hinweis "Eiweissziel erreicht"); nur Zahlen. Ueberschreitung loest in Wochenansicht keine Wertung aus (gut), aber auch Erreichen nicht.
Auswirkung: Motivationsmoment bleibt ungenutzt; ruhiger Ton von "Sanft iOS" erlaubt eine leise Bestaetigung.
Vorschlag: Beim Erreichen von 90 % Eiweiss einmal pro Tag leichte Haptik plus Toast oder Hero-Zeile "Eiweiss geschafft"; keine Konfetti-Effekte, keine Verlustmeldung bei Verfehlen.
Aufwand: S. Prioritaet: mittel.

F9. Gewichtsliste: nur 5 Eintraege, Loeschen ohne Bearbeiten, ein Eintrag je Tag nur "heute"
Befund: RECENT_COUNT = 5 (weight-card.component.ts:14); Speichern setzt immer `toDateISO()` (ts:~96); ein vergessener Tag laesst sich nicht nachtragen oder korrigieren (nur loeschen, Papierkorb-Icon html:54).
Auswirkung: Luecken im Verlauf bleiben; Tippfehler von gestern nur durch Loeschen und Neueintrag heute (falsches Datum).
Vorschlag: Datum im Sheet waehlbar (Standard heute), Tap auf Listenzeile bearbeitet; "Alle anzeigen" ueber 5.
Aufwand: M. Prioritaet: mittel.

F10. Neuberechnungs-Hinweis als Dauer-Banner
Befund: weight-card html:42-47 zeigt bei Abweichung >= 2 kg dauerhaft Text mit Button; kein "Spaeter"/Ausblenden. Satz "Berechne dein Ziel neu" klingt fordernd.
Auswirkung: Nicht wegdrueckbar, wird zum Rauschen; bei bewusst gehaltenem Profilgewicht Dauerdruck.
Vorschlag: "Ziel anpassen" und "Nicht jetzt" (merkt sich das Gewicht, fragt erst bei weiteren 2 kg); Ton: "Dein Ziel passt vielleicht nicht mehr ganz."
Aufwand: S. Prioritaet: niedrig.

F11. Wochenmittel zaehlt nur geloggte Tage, ohne Hinweis auf Vollstaendigkeit
Befund: `weekSummary` mittelt nur Tage mit Eintraegen (week-stats.ts:51-60); Notiz nennt die Tagesanzahl, aber unscheinbar (html:20).
Auswirkung: Wer an 2 Tagen nur ein Fruehstueck eintraegt, sieht ein falsch niedriges kcal-Mittel und rutscht aus "im Ziel". Gilt auch fuer Serie.
Vorschlag: Tag mit sehr wenig kcal (z. B. unter 50 % Ziel) als "unvollstaendig" kennzeichnen und aus Mittel/Serie nehmen oder nachfragen.
Aufwand: S. Prioritaet: niedrig.

Fragen/Thesen an andere Rollen
1. An Ernaehrungs-Coach (NUT/COA): Ist ein kcal-Korridor von 85-105 % fuer "Tag im Ziel" sinnvoll, oder sollte Eiweiss allein die Serie bestimmen und kcal nur Kontext sein?
2. An UX/iOS-Rolle: Soll Gewicht ein eigener Tab/Segment im Tagebuch werden (F1) oder als Kachel auf Heute leben, ohne die 5-Tab-Entscheidung E1 zu kippen?
3. An Datenschutz/Release: Sind lokale Erinnerungen (F6) mit der "nichts verlaesst das Geraet"-Aussage und Store-Pruefung unproblematisch, und gehoert ein Opt-in-Dialog vor die Berechtigungsanfrage?

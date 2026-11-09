# Rolle 19: Ernaehrungsfachliche Korrektheit (Sportler-Sicht)

Basis: Code-Lektuere (Stand 2026-11-09). Nicht erneut gemeldet, weil im Code bereits umgesetzt: Protein-Cap 2,2 g/kg und Referenzgewicht (NUT-01), Fett 30 % (NUT-02), Mindestzufuhr nur beim Abnehmen (NUT-03), relatives Tempo 1 %/Woche (NUT-04), Plausibilitaetshinweise (NUT-05). App nicht gestartet, keine Laufzeitwerte geprueft.

F1. Aufbau-Tempo und Ueberschuss zu hoch, Fett statt Muskel
- Befund: `dailyDeltaKcal` nutzt fuer Abnehmen und Zunehmen dieselben 7700 kcal/kg und denselben Deckel 1 %/Woche (nutrition-calc.service.ts:13-16, 131-135, 149-156); Bereich 0,1-0,75 kg/Woche (profile-form.ts:20), Vorgabe 0,5. Bei 75 kg: 0,5 kg/Woche = +550 kcal/Tag, Maximum +825.
- Auswirkung: Fuer natuerlichen Muskelaufbau sind rund 0,25-0,5 % Koerpergewicht/Woche (+200-350 kcal) sinnvoll. Der Rest wird ueberwiegend Fett. 7700 kcal/kg gilt fuer Fettgewebe, nicht fuer Muskelaufbau. Kernzielgruppe Sportler betroffen.
- Vorschlag: Eigene Konstante `MAX_GAIN_FRACTION_PER_WEEK = 0.005`, Aufbau-Vorgabe 0,25 kg, Chips fuer Aufbau 0,1-0,4. Hinweis "Aufbau: moderater Ueberschuss, Rest wird Fett".
- Aufwand S, Prioritaet hoch.

F2. Zucker-Ziel (freier Zucker) wird mit Gesamtzucker verglichen
- Befund: Ziel = 10 % der Energie "freier Zucker" (nutrition-calc.service.ts:48-49), Ring und Eintraege zaehlen Gesamtzucker (dashboard.page.ts:131), Ueberschreitung wird rot (dashboard-math.ts:11). Settings-Label "Zucker max." (settings.page.html:23).
- Auswirkung: Obst, Milch, Joghurt zaehlen voll. Wer sich gut ernaehrt (Skyr mit Beeren, Banane), sieht rote Warnung, obwohl die WHO-Grenze freien Zucker meint. Fehlalarm untergräbt Vertrauen, OFF liefert zudem nur Gesamtzucker.
- Vorschlag: Ring neutral (Info statt Warnfarbe) und Label "Zucker gesamt, Richtwert". Alternativ Warnung erst ab ca. 2x Ziel. Ziel-Text ehrlich: "Orientierung fuer freien Zucker".
- Aufwand S, Prioritaet hoch.

F3. Wochenstatistik: ein Kalorienkorridor fuer alle Ziele, Teiltage verzerren Mittel
- Befund: `KCAL_CORRIDOR` 85-105 % unabhaengig vom Ziel (week-stats.ts:6, 35). `logged` = mindestens ein Eintrag (week-stats.ts:46-48).
- Auswirkung: Beim Aufbau gilt 86 % des Ziels als "im Ziel", der Ueberschuss fehlt dann faktisch. Beim Abnehmen ist 106 % streng. Ein Tag mit nur Fruehstueck druckt den Wochenschnitt kcal und Eiweiss und wirkt wie ein Defizit.
- Vorschlag: Korridor je Ziel (lose 90-100, maintain 90-105, gain 97-110). "Vollstaendiger Tag" erst ab ca. 50 % des kcal-Ziels fuer Mittelwerte und Serie, sonst als "unvollstaendig" markieren.
- Aufwand M, Prioritaet mittel.

F4. Aktivitaetsfaktoren ueberschaetzen Kraftsportler mit Buerojob
- Befund: PAL 1,2-1,9 (nutrition-calc.service.ts:19-25), Labels nennen nur Trainingshaeufigkeit ("Aktiv 6-7x/Woche", settings.page.ts:134-140), Zahl faehrt als TDEE ins Ziel.
- Auswirkung: Wer 4x Krafttraining macht und sitzend arbeitet, waehlt "Maessig" oder "Aktiv" und liegt je nach Person 10-20 % ueber dem realen Verbrauch. Beim Abnehmen stagniert das Gewicht, die App erklaert es nicht.
- Vorschlag: Labels um Alltag ergaenzen ("Alltag sitzend + Training 3-5x"), Hinweis unter dem Ziel: "Schaetzung. Pruefe nach 2-3 Wochen deinen Gewichtstrend und passe das Ziel um 100-150 kcal an." Verknuepfung mit Gewichtsverlauf (T3).
- Aufwand S, Prioritaet mittel.

F5. Makro-Split kann inkonsistent werden, Kohlenhydrate fuer Training ungeprueft
- Befund: `carbsG = max(0, ...)` (nutrition-calc.service.ts:114-117) schluckt Ueberschuss still. Fett fix 30 % der Energie, keine Untergrenze in g/kg, keine Carb-Pruefung.
- Auswirkung: Schwerer Sportler im Defizit (90 kg, 1800 kcal): 162 g Eiweiss, 60 g Fett, nur ca. 1,7 g/kg Kohlenhydrate. Trainingsleistung und Erholung leiden, Nutzer sieht nur Zahlen.
- Vorschlag: Hinweis in den Settings bei Carbs unter 2 g/kg ("wenig fuer intensives Training, ggf. Tempo senken"). Optional Fett im Defizit auf 25 % und Mindestfett 0,6 g/kg.
- Aufwand S, Prioritaet mittel.

F6. Keine Moeglichkeit, Ziele manuell zu setzen
- Befund: Kein manuelles Ziel/Override gefunden (Grep auf override/manualTarget/customTarget in models, settings, dashboard: keine Treffer). Eiweiss fix 1,6/1,8/2,0 g/kg, Cap 2,2.
- Auswirkung: Erfahrene Sportler wissen ihr Erhaltungslevel (aus Tracking) oder wollen im Defizit 2,0-2,4 g/kg. Ohne Anpassung greifen sie auf Tricks zurueck (Gewicht/Alter falsch eintragen), was die Plausibilitaetslogik aushebelt.
- Vorschlag: Optionaler "Ziel anpassen": kcal +/- Offset und Eiweiss g/kg (1,2-2,4), klar als "manuell" gekennzeichnet, Standard bleibt Formel.
- Aufwand M, Prioritaet mittel.

F7. Minderjaehrige koennen Abnehmen/Aufbau mit Defizit waehlen
- Befund: Alter ab 14 erlaubt (profile-form.ts:19), unter 18 nur Hinweistext (profile-plausibility.ts:36-41), Defizit wird dennoch berechnet.
- Auswirkung: Defizit bei Wachsenden ist fachlich nicht vertretbar, Formeln ungeeignet.
- Vorschlag: Unter 18 Ziel "Halten" erzwingen oder Tempo-Auswahl ausblenden, Hinweis behalten.
- Aufwand S, Prioritaet niedrig (Zielgruppe Jakob, aber App-Store-Frage E8).

F8. Mikronaehrstoffe: Salz fehlt im Ziel, sonst nichts
- Befund: `saltG` wird erfasst (add-entry-sheet.component.html:239), hat aber kein Tagesziel und keinen Ring (dashboard.page.ts nutzt nur 6 Makros, kein saltG). Keine Mikros.
- Auswirkung: Gering fuer Kern "Protein/Kalorien". Fuer Sportler (Fertigprodukte, Proteinriegel, Whey) ist Salz der einzige Mikro-Wert mit echtem Nutzen (Richtwert unter 6 g/Tag, WHO 5 g).
- Vorschlag: Salz im Drill-Detail mit Richtwert 6 g zeigen, kein eigener Ring.
- Aufwand S, Prioritaet niedrig.

F9. Rezept-Naehrwerte: Rohgewicht gegen Garzustand nicht erklaert
- Befund: `ingredientFacts` rechnet Menge x Naehrwert je 100 g (recipe-nutrition.ts:45-78), unit-Gewichte per Naeherung (units-weight.ts:43). Nichts weist darauf hin, ob roh oder gekocht gemeint ist.
- Auswirkung: Typischer Fehler: 200 g gekochter Reis oder Nudeln mit Rohwerten (rund 350 kcal/100 g) ergibt rund 2,5x zu viele kcal. Fleisch roh/gebraten verschiebt Eiweiss um 20-30 %. Ein Sportler, der Mealprep wiegt, trifft das taeglich.
- Vorschlag: Bei Reis, Nudeln, Haferflocken, Huelsenfruechten, Fleisch Hinweis am Zutatenfeld "Rohgewicht" und Option "gekocht" (Faktor aus kleiner Tabelle). Mindestens Hinweistext im Rezeptformular.
- Aufwand M, Prioritaet hoch.

F10. `reconcileKcal` ueberschreibt kcal still
- Befund: Liegt kcal unter 75 % der Makro-Energie, wird kcal aus Makros ersetzt (recipe-nutrition.ts:19-34), ohne Kennzeichnung. Gilt nicht fuer Alkohol/Ballaststoffe/Polyole (Atwater-Abweichung, Proteinriegel mit Zuckeralkoholen liegen real unter 4/4/9).
- Auswirkung: Riegel/Proteinprodukte werden im Rezept hoeher gezaehlt als auf der Packung. Gering, aber verfaelscht Packungswerte.
- Vorschlag: Nur anwenden, wenn kcal unter 50 % der Makro-Energie (offensichtlicher Fehler), sonst Packungswert behalten.
- Aufwand S, Prioritaet niedrig.

Fragen/Thesen an andere Rollen
1. An Produkt/Coach: Soll das Eiweiss-Ziel im Hero Vorrang vor kcal haben, wenn beide kollidieren (Defizit-Tage)? Meine These: Ja, weil Muskelerhalt im Defizit das Hauptversprechen ist.
2. An UX/Text: Wie bekommt man F2/F4-Hinweise ("Schaetzung, Trend pruefen") sichtbar, ohne Disclaimer-Muedigkeit? These: ein einziger Satz direkt unter dem Ziel, keine Modals.
3. An QA/Daten: Wie testen wir F9 gegen echte Wiegewerte? These: 5 Referenzrezepte (Reis, Haehnchen, Haferflocken, Linsen, Pasta) mit Soll-Werten aus BLS als Regressionstest.

# Diskussion Runde 2: Rolle 19 (Ernaehrung)

Gelesen: Findings und Fragen der Rollen 01-18 und 20. Keine neue Laufzeitpruefung.

## (a) Zustimmung
- R11 F11 (Wochenmittel nur ueber "geloggte" Tage): deckt sich mit meinem F3. Gleicher Schwellwert (unter 50 % kcal-Ziel = unvollstaendig) fuer Mittel, Serie und Tagesstatus verwenden.
- R11 F5 (Serie bestraft): verstaerkt F3. Kalorienkorridor und Serie muessen zielabhaengig sein, sonst bricht die Serie an Aufbau-Tagen oder bei Restaurantbesuch.
- R12 F1 (Ziele nicht anpassbar): identisch mit meinem F6. R12 F7 (Aktivitaetslabel unklar) und R01 F5 (Vorschau im Profilformular fehlt): stuetzen F4. Zeigt man kcal/Eiweiss live im Formular, kann Jakob die Aktivitaetsstufe sofort plausibilisieren.
- R06 F11 (inkonsistente Ueberschreitungsfarben) plus mein F2: zusammen loesen (kcal rot nur nach oben beim Abnehmen, Zucker neutral, Eiweiss nie).
- R02 F6/F8, R03 F4, R06 F5: Eiweiss gleichrangig im Tagebuch, in Essenszeiten-Zeilen und im Eintragen-Flow. Fachlich zwingend: Eiweiss muss ueber den Tag verteilt gesteuert werden (ca. 0,3-0,4 g/kg je Mahlzeit), das geht nur mit Mahlzeitenwerten.
- R04 F8 (unplausible OFF-Makros): ergaenzt F10. Eine Plausibilitaetspruefung (Atwater-Summe, Makros ueber 100 g/100 g) gehoert in die Datenaufnahme, nicht in die Rezeptrechnung.
- R14 F4 (stilles 0 bei Fehleingaben, z. B. Eiweiss in meals-list): fuer Ernaehrungsdaten kritisch, weil ein falsches 0 g Eiweiss die Tagessumme dauerhaft verfaelscht.
- R05 F14/F15: Rundung und Scheingenauigkeit im Einkauf sind okay, aber nicht auf Naehrwerte uebertragen.

## (b) Widerspruch und Konflikte
1. R20 F4 (adaptives Ziel und Apple Health Overengineering): Teilweise Zustimmung. Voll adaptiv (MacroFactor) ist zu viel. Kompromiss: Formel bleibt, plus manueller Offset (R12 F1/mein F6) und ein Hinweis nach 14 Tagen Gewichtstrend ("Verbrauch liegt vermutlich um X kcal ab"), ohne automatische Aenderung.
2. R20 F5 (Mikros/Wasser nicht nachbauen): Zustimmung. Ich ziehe mein F8 (Salz) zurueck. Ballaststoffe behalten (kleiner Ring).
3. R11 Frage "Eiweiss allein bestimmt Serie?": Nein, nur Eiweiss reicht fachlich nicht, weil Aufbau/Defizit ueber Energie laeuft. Kompromiss: Serie = Eiweiss ab 90 % UND kcal ab Zielgrenze (Abnehmen: nicht ueber 100-105 %, Aufbau: nicht unter 95 %, Halten: 90-105 %).
4. R02 F7 / R20 F1 Hero (Energieanteile ausblenden?): Makroanteil-Zeile ist fuer Sportler nuetzlich (Fett/KH-Balance), aber nachrangig. Kompromiss: nur im Drill, nicht im Hero.
5. R15 F7 (Widget) gegen R11 (Gewichtsverlauf): Beides sinnvoll, aber Widget zeigt nur Eiweiss-Restwert, hat keinen fachlichen Vorbehalt. Reihenfolge: erst Datensicherheit und Eintragspfad, dann Widget, Gewichtstrend parallel (klein).
6. R18 Frage versioniertes Schema vs. berechnete Ziele: `dailyTarget(p)` wird live aus dem Profil gerechnet, `weekSummary` nutzt ein Ziel fuer alle 7 Tage. Aenderungen am Profil rechnen die Vergangenheit um. Das widerspricht nicht, ergaenzt aber die Forderung (siehe c).

## (c) Antworten auf Fragen an mich
- R02 (gemeinsames Verb): Ja, "noch 62 g Eiweiss" und "noch 480 kcal"; "uebrig" streichen, ausser bei Ueberschreitung ("480 kcal drueber").
- R04 (Sortierung nach Eiweissdichte): Relevanz bleibt vorn. Eiweiss je 100 kcal nur als Anzeige in der Zeile und optional als Chip "Eiweissreich" (ab ca. 10 g/100 kcal). Kein Default-Sort, sonst steigen Whey und Skyr fuer jeden Begriff nach oben.
- R05 (Wochenplan zeigt Tagesprotein): Ja, "Plan deckt 118 von 140 g/Tag", Warnung unter 90 % (gleicher Schwellwert wie PROTEIN_GOAL_SHARE).
- R06 (Eiweiss gleichrangig im Tagebuch): Ja, auch wenn kcal-Karte kleiner wird.
- R11: siehe b3.
- R12 (Override): Fachlich vertretbar. Eiweiss 1,2-2,4 g/kg Koerpergewicht (ab 2,2 Hinweis, Eingabe darueber sperren); kcal als Offset +/-500. Unter der Mindestzufuhr nur Warnung, keine Sperre. Override wird nie von Formelaenderungen ueberschrieben und als "manuell" markiert.
- R18 (Schema): Ja, versionieren. Profil-Regeln nicht still neu rechnen: Ziel pro Tag als Snapshot im Tagesdatensatz oder wenigstens Hinweis "Ziel wurde am ... geaendert". Sonst sind Wochen/Serien rueckwirkend verfaelscht.
- R20 (Hero nur kcal und Eiweiss): Ja. Fett/KH/Ballaststoffe sekundaer (kleine Ringe, bereits so), Zucker ohne Warnfarbe, Salz gestrichen.

## (d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Datenverlust beim Schreiben/Import (R13 F1/F12, R20 F1): falsche Zahlen sind schlimm, fehlende Historie ist schlimmer. S-M.
2. Schneller Eintragspfad mit Eiweiss: "Zuletzt gegessen" aus Tagebuch inkl. Menge (R04 F7, R03 F1/F2), Schnell-Eintrag kcal+Eiweiss (R03 F11, R20 F2). M.
3. Aufbau-Tempo und Ueberschuss korrigieren (mein F1). S.
4. Zucker-Fehlalarm und einheitliche Ueberschreitungssemantik (mein F2, R06 F11). S.
5. Ziel manuell anpassbar plus Aktivitaetshinweis/Vorschau (R12 F1/F7, mein F4/F6, R01 F5). M.

## (e) Streichen oder verschieben
- Streichen: Salz-Anzeige (F8), `reconcileKcal`-Feinschliff (F10) nur bei Gelegenheit.
- Verschieben: voll adaptives Ziel und Apple Health (R20 F4), Minderjaehrigen-Sperre (F7) bis Store-Entscheidung E8, Rezept Roh/gekocht-Option (F9) nach dem Hinweistext, Energieanteil-Zeile im Hero.
- Nicht vor 1 und 2 beginnen: Wochen-/Monatsauswertung ohne zielabhaengigen Korridor (F3), sonst werden falsche Serien gezeigt.

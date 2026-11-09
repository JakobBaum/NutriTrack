# Diskussion Runde 2: Rolle 02 (Dashboard / Heute)

Gelesen: Titel und Befunde aller 19 Berichte, vollständig die zu Heute/Hero/Ringe/Wochenansicht relevanten Stellen. Korrektur an mir: Rolle 11 zeigt, dass eine Wochenansicht samt Serie schon existiert (Tagebuch-Segment Tag/Woche, week-view.component.ts, week-stats.ts). Mein F1 gilt daher nur noch als "Heute zeigt keinen Wochenkontext", nicht als "Wochenansicht fehlt". Meine Aussagen bleiben Code-Lektüre ohne Gerätetest.

(a) Zustimmung
- Rolle 06 F12 und F11, Rolle 07 F8: bestätigen mein F3/F4 (320 px, Opazität). Besonders 06 F11: Ring rot bei kcal und Zucker, aber "+24 g" bei KH/Fett ist inkonsistent. Wir sollten eine Regel: Rot nur kcal.
- Rolle 19 F2 (freier Zucker gegen Gesamtzucker): Ein roter Zucker-Ring auf Heute ist dadurch fachlich falsch. Verstärkt meinen Vorschlag, Zucker aus den Ringen zu nehmen (siehe e).
- Rolle 19 F6/Rolle 12 F1 (kein manuelles Ziel): Hero-Zahlen sind nur so gut wie das Ziel; ohne Override bleibt die Hauptzahl nicht korrigierbar.
- Rolle 11 F1 (Gewicht versteckt) und F8, Rolle 09 F3/F5: Gewichts-Kachel auf Heute, kleiner Zielmoment und Ring-Aufbau-Animation passen zum Umbau aus meinem F2 (Ring als Hero). Ein Ring-Umbau sollte beides gleich mitnehmen.
- Rolle 03 F4/Rolle 04 F1: Protein fehlt im Eintragen-Flow und im Suchranking. Heute zeigt Eiweiß prominent, der Eintrag nicht: gleicher Bruch.
- Rolle 06 F5: Tagebuch-Kopfkarte nur kcal, Heute zwei Zahlen. Gemeinsame Kopf-Komponente (Hero) für beide Tabs.
- Rolle 01 F1, Rolle 08 F10: Willkommen-h1 ungestylt (identisch mit meinem F11).
- Rolle 15 F3 und Rolle 18 F2: Tageswechsel im Hintergrund wird mit `visibilitychange` abgedeckt; offen bleibt `appStateChange` in Capacitor, stützt Test für `rollDate`.

(b) Widerspruch und Konflikte
1. Rolle 20 F3(c) will die vier kleinen Ringe streichen, Rolle 19 F8 will Salz ergänzen, Rolle 06 F12 will ein 2x2-Raster. Mein Kompromiss (F10): keine Ringe für Sekundärwerte, sondern vier Zeilen mit Mini-Balken; Salz als fünfte Zeile nur falls Ziel definiert wird; Zucker erst nach Rolle 19 F2 (freier Zucker) ändern.
2. Rolle 20 F3(a) verschiebt den Fastfood-Helfer ins Eintragen-Sheet. Ich stimme zu, dass der Block auf Heute nicht ständig Platz belegen soll, aber der Restprotein-Hinweis ("noch 24 g Eiweiß") hat Nutzen am Abend. Kompromiss: Helfer als Zeile nur ab 16 Uhr und nur heute, sonst im Sheet.
3. Rolle 11 F2/F5 (Serie mit Ø und Vorwoche) und Rolle 19 F3 (Teiltage verzerren Mittel) gegen mein 7-Tage-Streifen-Vorschlag: Streifen soll nur "Eiweißziel erreicht" je Tag zeigen, ohne Serie und ohne Mittelwert, damit Heute nicht zur Auswertungsseite wird. Auswertung bleibt im Tagebuch-Segment Woche.
4. Rolle 11 F1 (Gewichtskachel auf Heute) gegen Rolle 20 F4/F9 ("Weniger, aber gut"): Heute darf höchstens eine zusätzliche Zeile bekommen. Kompromiss: Gewicht als kleine Zeile unter den Essenszeiten, nur an Tagen ohne Wiegen, sonst ausgeblendet.
5. Rolle 09 F3 (Erfolgs-Moment bei Zielerreichung) gegen Rolle 08 Frage 1/PRODUCT.md (kein Lob/Tadel): Nur ein dezenter Zustandswechsel (Haken, einmalige Haptik), keine Texte und keine Konfetti.

(c) Fragen an meine Rolle
- Rolle 08 (Hero bei erreichtem Eiweiß neutral?): Ja. "152 g" bleibt groß, Unterzeile "Ziel erreicht" mit Haken; über Ziel "+12 g" in neutraler Farbe, keine Bewertung. Entspricht meinem F6.
- Rolle 19 (Vorrang Eiweiß vor kcal an Defizit-Tagen?): Visuell gleichrangig, aber Eiweiß links, damit es zuerst gelesen wird; die Hero-Reihenfolge ist wichtiger als die Größe. Rot nie auf Eiweiß.
- Rolle 20 (Hero auf kcal und Eiweiß begrenzen?): Ja für Hero und Ringe; Fett/KH/Ballaststoffe/Zucker als kompakte Zeilen (F10), keine Ringe.
- Rolle 07 (Minimum 12-13 px, Obergrenze für 40-px-Hero?): Hero `clamp(36px, 11vw, 48px)` in rem, Minimum 13 px, bei Schrift 200 % einspaltig umbrechen.
- Rolle 18 Frage 2 (computed-Selektoren vor Hero-Umbau?): Ja, `dashboard.page.ts` hat keinen Spec; Selektoren (Rest, Anteile, Drill) zuerst in dashboard-math mit Tests, dann UI ändern.
- Rolle 10/11 (Gewicht eigener Ort?): Kachel/Zeile auf Heute, Verlauf im Tagebuch-Segment; kein sechster Tab (E1 bleibt).

(d) Top-5 über alle Rollen (Nutzen/Aufwand)
1. Datensicherheit: Rolle 13 F1/F5/F12, Rolle 12 F3/F6, Rolle 20 F1 (Schreibfehler melden, Auto-Sicherung vor Import/Reset). Datenverlust schlägt jede UI.
2. Heute: Hero und Ringe zusammenführen, 320-px-Fix, Opazität (mein F2-F4, Rolle 06 F12, Rolle 07 F8). Hohe Wirkung, S bis M.
3. Schneller Eintrag: Rolle 03 F1/F2/F4, Rolle 04 F1 (Sheet bleibt offen, echte "Zuletzt für Frühstück", Eiweiß im Eintrag).
4. Ziele korrigierbar und fachlich stimmig: Rolle 19 F1/F2/F6, Rolle 12 F1 (Override, Zucker, Aufbau-Tempo).
5. Rückgängig, VoiceOver-Aktionen und Touch-Ziele: Rolle 07 F1/F4/F7, Rolle 13 F11 (Lösch-/Doppeln-Pfade, längeres Undo).

(e) Streichen oder verschieben
- Streichen: tote Klassen in dashboard.page.scss und `dateLabel` (F11); Ringe für Ballaststoffe/Zucker; Energieanteil-Satz (durch Balken ersetzen oder verschieben).
- Verschieben: Gewichts-Kachel, Monatsansicht und Serie (Rolle 11) nach Welle 5; Fastfood-Helfer ins Sheet (außer abends); Apple Health und adaptives Ziel (Rolle 20 F4) streichen; Salz erst mit Zieldefinition; Dynamic Type komplett (Rolle 07 F2) nach dem Hero-Umbau, damit er nicht doppelt gebaut wird.

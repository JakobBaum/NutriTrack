# Diskussion Rolle 11 (Fortschritt, Gewicht, Retention)

Basis: Berichte der Rollen 01 bis 20, soweit sie Fortschritt, Gewicht, Serie, Wochensicht oder Erinnerung berühren.

## (a) Zustimmung
- Rolle 10 F5 / Frage 1: Gewicht liegt im Profil-Sammelbecken. Deckt sich mit meinem F1.
- Rolle 02 F1: 7-Tage-Streifen auf Heute. Ergänzt mein F2 und ist der billigste Weg zum Wochenkontext. Das Tagebuch hat die Wochenansicht schon, Heute noch nicht.
- Rolle 19 F3: Kalorienkorridor je Ziel; Tage unter etwa 50 % des Kcal-Ziels als "unvollständig". Deckt sich mit meinem F11 und entschärft F5 (Serie reißt sonst durch Teiltage und beim Aufbau durch zu enge Obergrenze).
- Rolle 19 F4/F2: Hinweis "nach 2 bis 3 Wochen Gewichtstrend prüfen". Das braucht den Trend, den die Gewichtskarte schon liefert (mein F4); Verknüpfung statt Neubau.
- Rolle 15 F-Health: Gewicht aus Health lesen spart Doppeleingabe. Sinnvoll, aber erst nach F1/F9.
- Rolle 20 F1 und Rolle 16: Datensicherheit (kein Backup-Reminder, localStorage). Je länger der Gewichtsverlauf, desto größer der Schaden bei Verlust. Ein "Backup fällig"-Hinweis passt als Reminder-Variante zu meinem F6.
- Rolle 18 F11: gemeinsame reine Aggregation für Tagessummen vor Monatsansicht. Voraussetzung für mein F2; Rolle 16 F3 (Tagesindex) bestätigt es.
- Rolle 07 (a11y) / mein F7: Balken nur über aria-label lesbar; sichtbare Werte helfen allen.

## (b) Widerspruch und Konflikte
1. Rolle 20 F4: adaptives Ziel und Apple Health streichen, nur Neuberechnungs-Hinweis. Ich stimme beim adaptiven Ziel zu (zu wenig Daten, Risiko falscher Werte). Widerspruch gering: der Hinweis sollte wegdrückbar sein (mein F10) und die Einordnung des Trends nach Ziel enthalten (F4). Kompromiss: Hinweis plus Trend-Einordnung, kein automatisches Lernen.
2. Rolle 20 F8: 4 Tabs (Kochen zusammenlegen) und Rolle 10 F5 (Gewicht als eigener Ort) laufen gegeneinander, wenn ein sechster Bereich entstünde. Mein Vorschlag: kein neuer Tab. Gewicht als Kachel auf Heute (Tippen öffnet das Sheet) plus Segment im Tagebuch (Tag, Woche, Gewicht). Das kippt weder E1 noch Rolle 20 F8.
3. Rolle 02 F2 (Hero oder Ringe streichen) und Rolle 20 Frage 1 (Hero nur kcal und Eiweiß): Heute bekommt Platz für Wochenstreifen und Gewichtskachel nur, wenn der Screen schlanker wird. Ich unterstütze das Streichen der Doppelanzeige, wenn Streifen und Kachel dafür einziehen.
4. Rolle 20 F3: Fastfood-Helfer von Heute verlagern. Konflikt mit nichts, schafft aber den Platz für Streifen und Gewicht; ich unterstütze.
5. Rolle 03 These (Schnell-Pfade vor Verlauf und Wochenansicht): Gegenthese teilweise. Schnell-Pfade sind günstiger und erhöhen die Eintragsquote, aber Gewichts-Kachel (F1) ist ebenfalls klein (M). Beides in dieser Reihenfolge, Verlauf nicht auf später schieben, weil die Serie ohne ihn kein Rückblicksgefühl liefert.
6. Rolle 02 F1 "Eiweiß-Ziel erreicht gefüllt, teilweise halb": passt zu meiner F5-Forderung, Serie primär über Eiweiß zu führen; gegen Rolle 19 (Korridor je Ziel) gibt es keinen Konflikt, wenn kcal nur Stufe zwei ist.

## (c) Antworten auf Fragen an mich
- Rolle 02: Reicht "Eiweiß-Ziel erreicht ja/nein" oder soll 90 % als "fast" gelten? Dreistufig: erreicht (ab 90 %), fast (70 bis 89 %, halber Punkt), leer. Die 90 %-Schwelle existiert in PROTEIN_GOAL_SHARE; "fast" ist nur Anzeige, zählt nicht zur Serie.
- Rolle 10: Gewicht eigener Ort? Ja, aber ohne neuen Tab (siehe b2).
- Rolle 15: Eiweiß-Widget gegen Gewichtsverlauf? Widget ist für "noch Z g" wertvoller im Alltag, aber erst nach den Eintragen-Schnellpfaden; Gewichtsverlauf existiert bereits, sein Mangel ist Sichtbarkeit, nicht Funktion.
- Rolle 16: Ab wann aggregieren? Bis etwa 365 Tage und ein Eintrag-Tag-Index reichen Berechnung bei Bedarf; Aggregate erst vorhalten, wenn Monatsansicht und Wochenstreifen gleichzeitig laufen und Messung >50 ms zeigt.
- Rolle 19: Hat Eiweiß Vorrang im Hero bei Defizit? Aus Fortschrittssicht ja: Serie und Wochenstreifen messen bereits an Eiweiß zuerst.

## (d) Top-5 über alle Rollen (Nutzen durch Aufwand)
1. Wochenstreifen und Eiweiß-Status auf Heute (Rolle 02 F1, mein F2): M, hoch.
2. Eintragen-Schnellpfade: Favorit ohne Sheet, "schnell kcal/Eiweiß", Gestern kopieren (Rolle 03 F1/F2/F11, Rolle 20 F2): M, hoch, erhöht die Datenmenge für alles Weitere.
3. Gewichts-Kachel auf Heute plus Ziellinie, Zeitfenster und Tippwerte im Diagramm (F1, F3): M, hoch.
4. Serie fairer machen: Eiweiß zuerst, Korridor je Ziel, unvollständige Tage herausnehmen (F5, F11, Rolle 19 F3): S bis M, hoch.
5. Backup-Erinnerung und Persistenz (Rolle 20 F1, Rolle 16, mein F6 als gemeinsame Erinnerungslogik): S, hoch, schützt die Daten.

## (e) Streichen oder verschieben
- Adaptives Ziel (CMP-02): verschieben, erst Hinweis und Einordnung (F4, F10).
- Apple Health: verschieben bis E8; höchstens später Gewicht lesen.
- Erinnerungen (F6) nur als Opt-in und erst nach Top-Punkten 1 bis 4; Wieg-Erinnerung zuerst weglassen, Backup- und Eintrags-Erinnerung reichen.
- Monatsansicht (F2 zweite Hälfte): hinter Vorwochen-Navigation zurückstellen.
- Gewichtsliste-Bearbeiten (F9): nach dem Datums-Picker im Sheet, kein eigener Editor.
- Konfetti und weitere Spielelemente (F8): bewusst nicht einführen; nur leise Haptik und Zeile.

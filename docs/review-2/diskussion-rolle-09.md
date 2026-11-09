# Diskussion Rolle 09 (Motion, Haptik, Rückmeldung)

Basis: Berichte der Rollen 01-08 und 10-20, nur Lektüre. Keine Fragen an Rolle 09 oder "Motion" explizit gestellt; zwei Rollen berühren meine Themen (Fragen unter c).

## a) Zustimmung und Ergänzung
- Rolle 11 F8 (Ziel-Moment, "keine Konfetti"): deckt sich mit meinem F3. Gemeinsame Linie: einmal pro Tag, Haptik plus ruhiger Ring-Puls, nie Verlust-Meldung.
- Rolle 15 F6 (Haptik ohne Semantik): identisch mit meinem F4; ich hebe es auf mittel, weil Success/Selection billig sind und F2/F3 darauf bauen.
- Rolle 13 F3 und F11 sowie Rolle 07 F7: Toast-Stau, zu kurzes Undo, Danger-Toast wird von `showEntryToast` geschlossen. Verstärkt mein F6; zusammen ein Umbau von `entry-toast.ts` (Undo 8 s, Fehler nie verdrängen, Aggregation).
- Rolle 05 F12 (Abhaken ohne Rückmeldung): ergänzt mein F2; Zähler "Erledigt (n)" kurz hervorheben ist die passende Animation.
- Rolle 13 F7 und Rolle 05 F7 (KI-Wartezeit ohne Abbruch/Fortschritt): stützt F7; Skeleton plus Abbrechen plus "n/m" gehören in einen Baustein.
- Rolle 07 F10 (Reduce-Motion nur beim Start): berechtigt; ich ergänze, dass auch neue Animationen (F5, F8) über die Tokens aus F10 laufen müssen.
- Rolle 02 F2 (Hero und Ringe doppelt) und Rolle 02 F10 (Ringe ohne Tipp-Affordance): Press-State auf den Ringen (F1) löst F10 teilweise ohne Layoutänderung.
- Rolle 12 F8 (Speichern-Toast unten, durch Tab-Bar verdeckt) und Rolle 15 F2 (Sheets ohne Swipe-Dismiss): beide Rückmeldungs-/Gestenthemen, die ich übersehen hatte.

## b) Widerspruch und Konflikte
1. Rolle 03 F1 (Sheet nach Schnell-Eintrag offen lassen) gegen meinen F6 (ein Toast, ein Undo): bleibt das Sheet offen, ist der Toast oben im Sheet nicht mehr die Bestätigung. Kompromiss: im offenen Sheet Bestätigung inline an der Zeile (Haken-Wechsel 200 ms plus Selection-Haptik), Toast mit Gesamt-Undo erst beim Schließen ("3 Einträge · 640 kcal").
2. Rolle 11 F8 (Haptik bei 90 % Eiweiß) gegen mein F3 (100 %): zwei Auslöser wären Rauschen. Kompromiss: ein Auslöser bei 100 % des Ziels; bei 90 % nur Textzeile, keine Haptik.
3. Rolle 11 F5 (Serie nicht bestrafen) gegen jede Belohnungsanimation: ich halte alle Effekte auf Zielerreichung des Tages, nie auf Serien. Keine Zähler-Animation für Streaks.
4. Rolle 16 (Performance, PreloadAllModules/Startzeit) gegen F5/F8: Count-up und Highlight dürfen Hauptthread nicht blockieren. Kompromiss: nur `transform`/`opacity`, kein Layout-Animieren (Höhen-Collapse über `grid-template-rows` oder Ionic-Animation), max. 1 Animation je Interaktion.
5. Rolle 15 F9 (Pull-to-Refresh weglassen) stimme ich zu; Rolle 06 F10 (Elevation/Schatten) betrifft Toast: Toast-Look und Dauer-Tokens gemeinsam entscheiden, nicht getrennt.

## c) Fragen anderer Rollen
- Rolle 07 an QA: `reducedMotion: 'reduce'` im E2E-Lauf. Aus Motion-Sicht: ja, und zusätzlich Prüfung, dass Ring-Puls/Highlight dort aus sind.
- Rolle 08 und 13: einheitlicher Zustandsbaustein statt Toasts für Offline/Speicherfehler/Kontingent. Antwort: ja. Toast nur für flüchtige Bestätigung und Undo; Zustand (Fehler, Offline) als Banner oben mit Haptik Warning einmalig, nicht auto-dismiss.
- Rolle 07 (Toast-Dauer für Screenreader): zustimmen, 8 s mit Undo; bei aktivem VoiceOver ohne Auto-Ablauf, mit Schließen-Button.

## d) Top-5 über alle Rollen (Nutzen/Aufwand)
1. Rolle 13 F1 und Rolle 20 F1 (Speicherfehler melden, Daten nicht verwerfen, sichtbares Backup): Datenverlust vor Politur, S bis M.
2. Mein F2 plus F1 (Press-State, Abhaken-Haptik): billig, täglich spürbar, S.
3. Mein F3 plus Rolle 11 F8 (Ziel-Moment einmal pro Tag): stärkster Kernschleifen-Effekt, M.
4. Rolle 15 F2 (Sheets mit Swipe-Dismiss/Breakpoints) plus Rolle 12 F8 (Toast sichtbar): iOS-Gefühl, S bis M.
5. Mein F6 mit Rolle 13 F3/F11 und Rolle 07 F7 (Toast-System: Undo 8 s, Aggregation, Fehler nicht verdrängen): M.

## e) Aus Sicht Motion streichen oder verschieben
- Mein F11 (Swipe-Haptik) und F10 (Token-Umbau) verschieben; Tokens erst, wenn F5/F8 gebaut werden.
- F5 Count-up streichen, nur Ring-Delta behalten; Zahlen-Animation ist Zierde.
- F8 Löschen-Collapse verschieben, Highlight der neuen Zeile genügt.
- Rolle 15 F7/F8 (Widget, Health) und Rolle 20 F4 (adaptives Ziel) sind nicht Motion, aber ich stimme der Verschiebung hinter Datensicherheit zu.

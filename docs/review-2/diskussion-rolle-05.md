# Diskussion Rolle 05 (Einkauf, Wochenplan, Rezepte)

Gelesen: alle 19 Berichte (bei Rolle 06/07/10/13/14/20 im Detail, übrige über Stichwortsuche und Fragenblock).

## (a) Zustimmung
- Rolle 08 F1 deckt sich mit meinem F16 (Leerzustand "unter Rezepte", Button springt nur ins Segment). Gemeinsamer Fix, Prio hoch ist berechtigt.
- Rolle 06 F8 ("geschätzt" dreifach, unruhige Liste) bestätigt F10/F15: Hinweis einmal als Fußnote bzw. am Summenblock, Badge nur bei "eigener Preis".
- Rolle 14 F9 (Preis per Alert: kein Feldfehler, Enter unzuverlässig, "Euro (€)" doppelt) stärkt F10. Zusätzlich verstärkt Rolle 14 (autocapitalize fehlt) mein F11: "milch" landet klein in der Liste.
- Rolle 13 F7 (kein Abbruch bei langer KI-Wartezeit) und Rolle 15 (Retry-Button im Fehlerzustand von Wochenplan) ergänzen F6/F7. Ein Abbrechen-Knopf muss auch die Übersetzungsschleife (`translateAll`) stoppen.
- Rolle 10 F1 (Segmentzustand nicht in der URL) verschärft F1: Nach Reload landet man immer in "Liste", der Plan hat keinen Deep Link. Rolle 10 F9 (Link "Profil › Rezept-Suche" ohne queryParams) gehört zu meinem F2.
- Rolle 09 F2 (Abhaken ohne Haptik/Übergang) ergänzt mein F12: gleiche Stelle, ein Fix.
- Rolle 18 F6 (zwei Einheiten-Welten) ist die Ursache hinter QAS-03/06 und meinem F14.
- Rolle 07 F1: Ich hatte angenommen, `nt-hover-delete` ersetze das Wischen. Das stimmt auf dem iPhone nicht (`hover: none` blendet den Button aus). Ich korrekt mich: In der Einkaufsliste ist Löschen nur per Wischen erreichbar.

## (b) Widerspruch und Konflikte
1. Mein F10 schlug "Löschen nur per Swipe" vor. Das widerspricht Rolle 07 F1 und ist nach der Korrektur oben falsch. Kompromiss: Zeile antippbar, öffnet ein kleines Sheet "Preis und Menge" mit sichtbarem "Löschen" (löst auch Rolle 14 F9); Swipe bleibt Abkürzung.
2. Rolle 06 F6 will den Einkaufs-FAB durch die Pille im Seitenkopf ersetzen. Beim Einkaufen im Laden steht die Daumenzone vor der Konsistenz (siehe auch MUX-02). Kompromiss: FAB im Einkauf als dokumentierte Ausnahme, aber ohne schweren Schatten und im Tokenstil; alle anderen Tabs wie von Rolle 06 vorgeschlagen.
3. Rolle 20 F3(b)/F8 will den Einkauf als "zweites Produkt" behandeln, Features einfrieren und evtl. auf 4 Tabs gehen. Teilweise Zustimmung: keine neuen Einkaufs-Features (QAS-05, CMP-07, F13 zurückstellen). Widerspruch: Der Wochenplan nutzt das Tagesprotein-Ziel (`week-plan.service.ts:68`) und ist damit Protein-Hebel; die Kernfehler F1, F2, F6 sind klein (S). Gegen 4 Tabs: Im Laden braucht man die Liste mit einem Tipp; ein Segment "Kochen" macht sie tiefer. E1 (5 Tabs) bleibt.
4. Rolle 19 F9 will im Rezeptformular "gekocht" als Option. Das darf die Einkaufsmengen nicht verändern: Die Liste braucht Rohgewichte. Kompromiss: Faktor nur für die Nährwertberechnung, Zutatenmenge bleibt Rohgewicht.

## (c) Antworten auf Fragen an meine Rolle
- Rolle 10 Frage 2 ("Einkauf" als Tabname, wenn dort der Wochenplan lebt?): Tabname "Einkauf" behalten (Standardansicht ist die Liste, `shopping.page.ts:128`). Segmente umbenennen in "Plan | Liste" und im Rezepte-Tab statt des Links "Zu den Rezepten" einen Eintrag "Wochenplan erstellen" mit Deep Link `?view=plan`. Der Plan hat so genau einen Ort.
- Rolle 20 F10 (KI-Abhängigkeit): Der Wochenplan hängt an Spoonacular plus Übersetzung. Ohne KI bleiben Wörterbuch (Zutaten) und englische Titel; das ist ehrlich, aber braucht den Retry (F6). Ohne Key greift nur "Aus meinen Rezepten planen", daher F2.
- Rolle 17 (Quota-DoS): Sequenzielle Übersetzung verbrennt KI-Kontingent pro Plan; ich schlage Wörterbuch zuerst, KI nur im Hintergrund und lazy beim Öffnen eines Rezepts vor (F7).

## (d) Top 5 über alle Rollen (Nutzen/Aufwand)
1. Hero "noch Z g Eiweiß" (PM-01, Rolle 02): Kernversprechen, M.
2. "Schnell eintragen" und Favorit/Zuletzt ohne Sheet-Umweg (Rolle 20 F2, Rolle 03 F1/F2): tägliche Schleife, S bis M.
3. Sichtbare Lösch-/Doppeln-Aktion im Bearbeiten-Sheet (Rolle 07 F1): Datenverlust-/Barriereproblem, S.
4. Plan -> Liste dauerhaft verknüpfen plus Retry für Übersetzung (mein F1, F6): S, schließt den Rezept-Plan-Liste-Flow.
5. Protein-Obergrenze (NUT-01, Rolle 19): falsche Ziele bei hohem Gewicht, S.

## (e) Aus meiner Sicht streichen oder verschieben
- Verschieben: F13 (Rezept tauschen/eintragen, L) bis nach Hero und Schnell-Eintrag; F7 (parallele Übersetzung) hinter F6; F12 und F15 (niedrig).
- Streichen: F14 als eigener Punkt (nur per Test absichern, keine Änderung).
- Einfrieren (mit Rolle 20): QAS-05, CMP-07 (Open Prices in der Liste), Märkte/Budget-Chips, bis die Kernfehler behoben sind.

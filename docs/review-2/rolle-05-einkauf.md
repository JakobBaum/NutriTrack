# Rolle 05: Einkauf, Wochenplan, Rezepte (Runde 2)

Basis: Code-Lektüre (shopping.page.*, shopping.store.ts, week-plan.service.ts, week-plan-cards.*, unit-format.ts, recipe-translate.ts). Laufende App nicht gestartet. Nicht doppelt gemeldet: QAS-01..10, STA-02/03/06, PM-08, UXL-02/03, RSP-08, CMP-07.

F1. Kein dauerhafter Weg Plan -> Liste. Der einzige Sprung ist der Toast "Zur Liste" (shopping.page.ts:142, 6 s, unten, von der Tab-Bar verdeckt, IOS-01). Danach muss man das Segment kennen. Auswirkung: Kernfluss bricht nach dem Erstellen ab. Vorschlag: in die Plan-Zusammenfassung (shopping.page.html:25-33) eine Zeile/Button "Einkaufsliste öffnen (42 Zutaten, offen ca. 38 €)". Aufwand S. Prio hoch.

F2. Primärbutton gesperrt, wenn keine Online-Suche eingerichtet ist (html:88 `[disabled]=!onlineAvailable()`). Der einzig mögliche Weg "Aus meinen Rezepten planen" liegt darunter als Outline-Button (html:132) mit Erklärtext. Auswirkung: Nutzer ohne Key sieht tote Hauptaktion. Vorschlag: bei `!onlineAvailable()` den eigenen Pfad als Primärbutton zeigen, Online-Button mit Verweis "Einrichten" statt disabled. Aufwand S. Prio hoch.

F3. Zwei Generatoren, ein Plan-Zustand: `generate()` (ts:320) ersetzt die Liste aus eigenen Rezepten, lässt aber `weekPlan` stehen. Wochenplan-Karten und Liste passen dann nicht mehr zusammen; die Liste behauptet "Einkauf für n Personen" ohne Bezug zum Plan. Vorschlag: im Bestätigungsdialog (ts:246) sagen, dass der Plan nicht mehr zur Liste gehört, oder Plan beim eigenen Generieren verwerfen/markieren ("Liste stammt aus eigenen Rezepten"). Aufwand S. Prio mittel.

F4. Rein manuelle Liste zeigt "Einkauf für 1 Person" und "Neu generieren" (html:145-153), weil `addItem` eine Basisliste mit persons:1 anlegt (shopping.store.ts:271-275). Falsche Aussage, Button irreführend. Vorschlag: Zusammenfassung nur bei `l.days != null` zeigen; sonst nur Positionszähler. Aufwand S. Prio mittel.

F5. Altlasten nach Neu-Planung: `mergeKept` behält alle abgehakten Positionen der Vorwoche (store.ts:119). Wer letzte Woche eingekauft hat, sieht nach dem neuen Plan die alten Erledigt-Zeilen weiter, teils mit alter Menge. Vorschlag: beim Neuerstellen standardmäßig abgehakte verwerfen (nur manuell behalten) oder im Dialog (ts:274) Checkbox "Erledigte behalten". Aufwand S. Prio mittel.

F6. Übersetzung ohne Ausweg: `attempted`-Set (week-plan.service.ts:44, 96) verhindert Wiederholung in der Sitzung; Hinweis "nicht übersetzt: n Rezepte bleiben Englisch (KI nicht erreichbar)" (week-plan-cards.component.html:10, auch week-recipe-sheet.component.html:17) hat keine Aktion, beginnt klein, nennt Ursache technisch. Vorschlag: Button "Erneut übersetzen" (löscht attempted, ruft ensureTranslated), Text "n Rezepte sind noch auf Englisch". Aufwand S. Prio hoch.

F7. Übersetzung läuft strikt nacheinander (recipe-translate.ts:68-76), Button zeigt nur "Übersetze Rezepte (3/10)" (html:91), kein Abbruch. Bei 10 Rezepten blockiert das Erstellen minutenlang. Vorschlag: Plan zuerst mit Originaltiteln speichern und anzeigen, Übersetzung im Hintergrund nachziehen (ensureTranslated existiert schon), oder 3 parallel. Aufwand M. Prio mittel.

F8. Fehlermeldung unter den Buttons: error() steht nach "Abbrechen" (html:99-101), auf 375 px unterhalb der Falz im Karteninneren. Vorschlag: Meldung direkt über dem Erstellen-Button, `role="alert"` bleibt, plus scrollIntoView. Aufwand S. Prio mittel.

F9. Leere Essenszeit-Auswahl wird still zu "Abend" (ts:289-294), Chips zeigen weiter nichts gewählt. Plan enthält Rezepte, die der Nutzer nicht gewählt hat. Vorschlag: Button deaktivieren oder Fehlertext "Mindestens eine Essenszeit wählen". Aufwand S. Prio mittel.

F10. Zeile in der Liste überladen: Name, Menge, Preis, Badge "geschätzt", dazu zwei Endbuttons "Preis ändern" (Textbutton) und Mülleimer (html:198-216). Auf 375 px bleibt für den Namen wenig; Badge "geschätzt" wiederholt sich in jeder Zeile und im Summenblock (html:169, 205). Vorschlag: Preis antippbar machen (Text "ca. 1,20 €" öffnet Alert), Badge nur bei eigenem Preis ("eigener Preis"), Schätzung einmal im Summenblock erklären; Löschen nur per Swipe plus Sichtbarkeit via Bearbeiten. Aufwand M. Prio mittel.

F11. Manuelles Hinzufügen: Standardeinheit "g" (ts:174, 543) ist für Milch/Eier falsch; Menge leer = "ohne Menge" ohne Hinweis. Doppelte Namen ergeben zwei Zeilen (addItem ohne Merge, store.ts:267). Kein Bestätigungs-Feedback nach "Hinzufügen" außer geleertem Feld. Vorschlag: Standardeinheit "Stk" bzw. zuletzt gewählte merken; vorhandenen gleichnamigen Eintrag addieren; kurze Meldung "Milch hinzugefügt (3 im Sheet)". Aufwand S. Prio mittel.

F12. Abhaken verschiebt Zeile in einen standardmäßig eingeklappten Bereich "Erledigt (n)" (ts:96, html:244-257) ohne Rückmeldung; Fehltipp wirkt wie Verlust. Vorschlag: Zeile kurz im Ziel zählen lassen ("Erledigt (3)" Animation) oder Toast mit Rückgängig; "Erledigte entfernen" per Dialog mit Anzahl (hat Undo, ok). Aufwand S. Prio niedrig.

F13. Rezepte im Plan sind eine Sackgasse: Karten öffnen nur das Sheet (week-plan-cards.component.ts:45); kein Tauschen, Entfernen, Portionsänderung, kein "als Mahlzeit eintragen". Zutaten kommen aber alle in die Liste. Auswirkung: ein unpassendes Rezept erzwingt kompletten Neuplan (mit Bestätigung, F5). Vorschlag: im Sheet "Anderes Rezept" (ein Slot neu suchen) und "In Tagebuch eintragen" (Nährwerte liegen vor, week-plan-format.ts:18); Liste nach Tausch neu mergen. Aufwand L. Prio hoch (größter Nutzen für Protein-Fokus).

F14. Einheitenanzeige rundet grob: >=500 g auf 50er, 50-500 auf 10er, kg auf 0,05 (unit-format.ts:15-30). Für Einkauf sinnvoll, aber die Rundung gilt auch für Teilmengen unter 10 g (ganzzahlig) und lässt "0,05 kg" statt "50 g" zu. Beim Teilen (formatShareText) identisch. Vorschlag: unter 1 kg nie auf kg wechseln (Schwelle ist korrekt), aber ml/l analog prüfen; ansonsten ok, nur per Test fixieren. Aufwand S. Prio niedrig.

F15. Preisschätzung vermittelt Scheingenauigkeit: Summe "ca. 41,35 €" mit 2 Nachkommastellen (html:161), Hinweis "Richtwerte Österreich" nur am Listenende (html:267). Vorschlag: auf ganze Euro runden ("ca. 41 €"), Hinweis-Icon neben der Summe mit Sheet. Aufwand S. Prio niedrig.

F16. Wording: Leerzustand sagt "unter „Rezepte“" (html:271) und Button "Zu den Rezepten" (272) springt auf Segment "Wochenplan", während ein eigener Tab "Rezepte" existiert; zweiter Button "Zu den Rezepten" (129) geht in diesen Tab. Gleiches Label, zwei Ziele. Vorschlag: 272 -> "Wochenplan erstellen", 129 bleibt "Zu meinen Rezepten". Aufwand S. Prio mittel.

Fragen/Thesen an andere Rollen:
1. Ernährungs-/Protein-Rolle: Soll der Wochenplan sein Tagesprotein-Ziel (dailyProteinG, week-plan.service.ts:68) sichtbar belegen ("Plan deckt 118 g von 140 g/Tag")? Ohne Beleg ist der Plan für Protein-Nutzer nicht prüfbar.
2. Texte/Glossar-Rolle: Einigt ihr euch auf "Wochenplan", "Einkaufsliste", "Rezepte" (eigene) und ein Verb für "in Liste legen"? Aktuell mischen html:129/271/272 die Begriffe.
3. Release/Worker-Rolle: Ist es vertretbar, dass 10 sequenzielle KI-Übersetzungen pro Plan das Tageslimit belasten (translateAll)? Alternative: Wörterbuch zuerst, KI nur auf Tipp.

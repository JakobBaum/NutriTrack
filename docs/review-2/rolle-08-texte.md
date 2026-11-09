# Rolle 08: Texte und Microcopy (Deutsch)
Stand 2026-11-09. Nur Code-Lektüre (src/app), keine Laufzeitprüfung. Pfade relativ zu src/app. TXT-01..09 aus Runde 1 nicht wiederholt.
Bereits gut: Glossar weitgehend umgesetzt (Eiweiß, eintragen, Essenszeit/Mahlzeit), Hero "g Eiweiß noch", Fehlertexte nennen meist den nächsten Schritt.

F1. Leerzustand Einkauf verweist auf falschen Ort. shopping/shopping.page.html:271 "Wochenplan unter „Rezepte“", Button :272 "Zu den Rezepten" wechselt aber nur das Segment "Wochenplan" im selben Tab.
 Auswirkung: Nutzer sucht im falschen Tab. Vorschlag: "Tippe auf „+“, um Artikel einzutragen, oder erstelle einen Wochenplan." Button "Wochenplan erstellen". Aufwand S, Priorität hoch.

F2. Fehlertext verweist auf Einstellung, die es nicht gibt. core/ai/ai-errors.ts:7 "Prüfe den Schlüssel unter Profil › KI-Verbindung", aber settings/settings.page.html:288 sagt "Es gibt nichts einzustellen". Gleiches in core/recipes/online/spoonacular.errors.ts:15-16 (eigener Schlüssel) und recipes/recipe-view.ts:137.
 Auswirkung: Sackgasse. Vorschlag: 401/403 -> "Die KI ist gerade nicht verfügbar. Bitte später erneut versuchen."; Schlüsseltexte nur, wenn das Feld existiert. Aufwand S, Priorität hoch.

F3. Bestätigung nennt Ziel und Eiweiß nicht. diary/add-entry-sheet/add-entry-sheet.component.ts:577,651 "Eingetragen · 250 kcal"; diary/diary.page.ts:470 "… · 800 kcal". Eiweiß ist Kern, steht nie im Toast.
 Vorschlag: "In Frühstück eingetragen · 250 kcal · 18 g Eiweiß". Aufwand S, Priorität hoch.

F4. Anleitung/Hilfe veraltet. settings/settings.page.html:323-327: "Dashboard" (Tab heißt "Heute"), "Einkaufsliste erstellt die KI" (Wochenplan läuft über Rezeptsuche), Mahlzeiten, Wochenplan und Gewicht fehlen; "(mit KI-Verbindung)" in Klammern als Link-Button (:324-326) wirkt wie Fußnote.
 Vorschlag: auf die 5 Tabs umschreiben, Klammer-Links durch Satz "Dafür brauchst du die KI-Verbindung." ersetzen. Aufwand S, Priorität mittel.

F5. Zeichensetzung und Ton der Fehlermeldungen uneinheitlich. ai-errors.ts:8-9 " - " statt "—" (Zeile 4-6 mit "—"); spoonacular.errors.ts nur Punkte; "Internet prüfen" (core/food/food-errors.ts:53, Infinitiv) vs "Prüfe deine Internetverbindung" (ai-errors.ts:6, Imperativ); "bitte erneut" klein vs "Bitte erneut" groß; drei Offline-Texte.
 Vorschlag: Regel "Satz 1 = was los ist, Satz 2 = Du-Imperativ, Punkt, Gedankenstrich „—“", ein gemeinsamer Offline-Text. Aufwand S, Priorität mittel.

F6. Rohtexte von Fremdsystemen im UI. recipes/recipe-view.ts:140 "Import fehlgeschlagen: ${raw}", core/ai/ai.service.ts:75 "…nicht erreichbar: ${reason}". Englische Strings ("Failed to fetch") können durchschlagen.
 Vorschlag: Whitelist-Meldungen, Rest: "Import fehlgeschlagen. Prüfe Text oder Link und versuche es erneut." Aufwand S, Priorität mittel.

F7. Unleserliche Abkürzungen und Einheiten im Zutatenformular. recipes/recipes.page.html:195 "Kohlenh.", :197 "Ballast." (für Ballaststoffe), :193/206 "kcal/100g" ohne Leerzeichen (sonst "100 g"), :194 aria-label "Eiweiß je 100g". diary/diary.page.html:85 "E · KH · F" nur mit Legende ganz unten (:113).
 Vorschlag: "Kohlenhydrate", "Ballaststoffe", "kcal je 100 g", Legende direkt unter der ersten Zeile oder aria-label "Eiweiß 18 g". Aufwand S, Priorität mittel.

F8. Irreführende/fehlende Handlungstexte. add-entry-sheet.component.ts:619 "… größer als 0 sein — oder lass das Feld leer." (Feld ist Pflicht, = QAD-04, noch offen); diary/diary-search.ts:84 "Keine Treffer … prüfe die Schreibweise" ohne Weg zu "Selbst eintragen"; fastfood-sheet.component.html:32 mischt Leerfall und Fehler.
 Vorschlag: Satz streichen; bei "Keine Treffer" Link "Als eigenes Lebensmittel eintragen"; Fehler und "nichts im Budget" trennen. Aufwand S, Priorität mittel.

F9. Begriffe für dieselbe Sache. "KI-Schätzung" (Badge, 6 Stellen) vs "geschätzt" (recipes.page.html:260) vs "Schätzung nach Formel" (settings:17); "Rezept-Suche" (spoonacular.errors.ts:15, online-search:21) vs "Rezeptsuche" (:6); "spoonacular" klein, Eigenname "Fastfood-Helfer" ohne Erklärung.
 Vorschlag: Glossar ergänzen: KI-Schätzung (nur KI), Richtwert (Formel/Tabelle), "Rezeptsuche" ein Wort, Spoonacular groß. Aufwand S, Priorität niedrig.

F10. Willkommensseite ohne Nutzenversprechen. dashboard/dashboard.page.html:11-14: weder Eiweiß noch Dauer genannt, "KI-Funktionen sind optional" ohne Kontext.
 Vorschlag: "Wie viel Eiweiß brauchst du? Gib Gewicht, Größe, Alter und Ziel ein (1 Minute), wir schätzen Kalorien und Eiweiß. Alles bleibt auf deinem Gerät." Aufwand S, Priorität mittel.

F11. Leerzustände uneinheitlich, oft ohne Handlung. "Noch keine Einträge an diesem Tag." (dashboard:163, kein Button), "Keine Anleitung hinterlegt." (shared/cook-mode:20), "Noch nichts eingetragen." in drei Varianten (dashboard:76, diary:64, weight-card:34); meals/meals-list.component.html:5 "füge sie … ein" statt Glossarverb "eintragen".
 Vorschlag: Muster "Noch kein X. <Handlung>." plus Button überall. Aufwand S, Priorität niedrig.

F12. Tab-Beschriftung vs Inhalt. tabs/tabs.page.html:13 sichtbar "Rezepte", aria "Rezepte und Mahlzeiten"; Tab "Profil" enthält Backup, KI, Hilfe, Datenschutz; Seitentitel recipes.page.html:3 wechselt zwischen "Rezepte"/"Mahlzeiten".
 Vorschlag: aria-Label und Label angleichen, Profil-Titel "Profil & Einstellungen". Aufwand S, Priorität niedrig.

F13. Rechtstexte schwer lesbar und lückenhaft. settings.page.html:343 nur "Kalorienbedarfe" (Eiweiß fehlt), :344 nennt nur Open Food Facts (nicht Open Prices/Spoonacular); langer Fließtext ohne Zwischenüberschriften auf dem iPhone.
 Vorschlag: Kurzfassung oben ("Daten bleiben auf dem Gerät, außer bei Suche und KI"), Zwischenüberschriften. Aufwand M, Priorität niedrig.

Fragen/Thesen an andere Rollen:
1. Coach/Ernährung: Soll der Hero bei erreichtem Eiweiß neutral "Eiweiß erreicht" zeigen und bei Überschreitung ("+X g") nichts bewerten (PRODUCT.md: kein Lob/Tadel)?
2. QA/Fehlerbehandlung: Können alle Fehlermeldungen über einen einzigen Katalog (Typ + Ton-Regel) laufen, damit F2, F5, F6 nicht nachwachsen?
3. Accessibility: Reicht "E/KH/F" mit Legende am Listenende für VoiceOver, oder braucht jede Zeile ein ausgeschriebenes aria-label?

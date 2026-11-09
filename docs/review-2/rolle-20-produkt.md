# Rolle 20: Produktstrategie / Advocatus Diaboli

Basis: Code-Lektuere (Stand 2026-11-09), REVIEW-ERGEBNIS.md, PRODUCT.md. Keine Live-Messung, Wettbewerb aus Produktwissen (Yazio, MFP, Lose It, Cronometer), keine frische Web-Recherche.
Vorab: Mehrere Runde-1-Punkte sind im Code schon erledigt (Eiweiss-Hero "noch Z g", Gewichtskarte, Wochenansicht, Favoriten/Zuletzt, Makro-Anteile). Ich melde diese nicht erneut.

## Wo NutriTrack besser ist (nicht kaputt machen)
Kein Konto, keine Werbung, kein Paywall-Druck (Yazio/MFP verstecken Makro-Ziele und Barcode hinter Abo). Eiweiss gleichwertig zu kcal im Hero. Antippen-zum-Eintragen (Favoriten, Zuletzt) ist auf Yazio-Niveau. DACH-Daten, ehrliche Schaetzkennzeichnung.

## Findings

F1. Datensicherheit ist die groesste Produktluecke. Alles liegt in localStorage (storage.service.ts:74); `restore` ersetzt alles (backup.service.ts:58), Backup ist rein manuell, es gibt keine Erinnerung (kein "Backup faellig" im Code, nur Anzeige `lastBackupLabel` settings.page.html:91) und kein `navigator.storage.persist()`. Auswirkung: Eine App, in die man Monate Daten eintraegt, ist bei iOS-Speicherbereinigung, App-Wechsel oder Geraetetausch verlustgefaehrdet; Konkurrenz hat Cloud. Vorschlag: Sanfter Hinweis auf Heute nach 14 Tagen ohne Export ("Sicherung teilen", ein Tipp ueber Share-Sheet), `persist()` beim Start, Auto-Sicherung vor Import. Cloud-Sync bewusst nicht bauen (DSGVO Art. 9, Principle 3). Aufwand S-M. Prioritaet hoch.

F2. Kernschleife "in Sekunden" ist nur halb belegt. Heute oeffnet das Sheet immer mit Suchfeld und Quellen-Buttons (add-entry-sheet.component.html:34-50); die schnellste Aktion (Favorit/Zuletzt) steht unter der Suche und nur wenn das Feld leer ist. Es fehlt ein "Kalorien schnell eintragen" (nur kcal/Eiweiss ohne Namen) und "Gestern kopieren" auf Heute. Lose It/MFP haben beides prominent. Vorschlag: Im Sheet "Schnell eintragen" (Zahl kcal, optional g Eiweiss) als erste Quellenzeile; Tag-Kopieren von Tagebuch nach Heute spiegeln. Aufwand S. Prioritaet hoch.

F3. Streichkandidaten (Ballast gegen Principle 4 "Weniger, aber gut"): (a) Fastfood-Helfer als eigener Block auf Heute (dashboard.page.html:114-130) belegt Prime-Platz fuer eine Gelegenheitsfunktion; in "Eintragen"-Sheet oder Profil verlagern. (b) Wochenplan + Einkaufsliste + Spoonacular + Preisschaetzung + Open Prices sind ein zweites Produkt (Meal-Planning) mit hoechster Pflegelast (Quota, KI-Kosten, Kategorien, Einheiten) und niedrigem Tagesnutzen. (c) Sechs Ringe (macros__secondary) neben dem Hero. Vorschlag: Fastfood-Block entfernen, Einkauf-Tab als "spaeter" behandeln und keine weiteren Einkaufs-Features (QAS-03/05, CMP-07 niedriger priorisieren), sekundaere Ringe als einklappbar oder auf eine Zeile Text. Aufwand S. Prioritaet mittel.

F4. These gegen Runde 1: "Gewichtsverlauf und Auswertung zuerst" ist richtig, aber adaptives Ziel (CMP-02, L) und Apple Health (E9, L) sind fuer Einzelnutzer Jakob Overengineering. Cronometer/MacroFactor-Logik braucht Monate Daten und Fehlertoleranz; ein falsch "gelernter" Wert schadet mehr als eine feste Formel. Vorschlag: Statt adaptivem Ziel nur Hinweis "Gewicht hat sich um X kg geaendert, Ziel neu berechnen?" (weight-card hat `recalculate` bereits). Apple Health streichen, bis App-Store-Entscheid (E8) steht. Aufwand S. Prioritaet mittel.

F5. Mikronaehrstoffe/Wasser/Training: Yazio und MFP bieten Wasser, Schritte, Training; Cronometer Mikros. Fuer "Protein und Kalorien sind Kern" ist das Ballast, keinesfalls nachbauen. Ausnahme mit hohem Nutzen/geringem Aufwand: Ballaststoffe und Zucker sind schon da (Ringe), reicht. Vorschlag: Explizit in PRODUCT.md als "Nicht-Ziele" festschreiben (Wasser, Training, Schritte, Social, Rezept-Community), damit Scope nicht driftet. Aufwand S. Prioritaet niedrig.

F6. Einstieg ohne Profil bremst den Aha-Moment (dashboard.page.html:14-20): leerer Bildschirm, ein Button, danach ein langes Profilformular (settings.page.html, 361 Zeilen, plus Zielgewicht/Tempo). Yazio fuehrt in 6 Schritten zum fertigen Plan. Vorschlag: Zweistufig: Geschlecht, Alter, Groesse, Gewicht, Ziel (5 Felder), Rest spaeter; am Ende sofort "Tagesbedarf: X kcal, Y g Eiweiss" zeigen und direkt in das Eintragen-Sheet springen. Aufwand M. Prioritaet mittel (Jakob ist Einziger Nutzer, also erst relevant bei Weitergabe; E8 abhaengig).

F7. Profil-Tab ist Sammelbecken (Ziele, KI, Einheiten, App, Rechtliches, Daten, Debug-Log; settings.page.html:31-116). Backup ist nur dort, wo man nie hinschaut. Vorschlag: Daten/Backup nach oben, Debug-Log und Rechtliches einklappen. Aufwand S. Prioritaet niedrig.

F8. Annahme der Runde 1 hinterfragt: "5 Tabs behalten" (E1). Der Einkauf-Tab und der Rezepte-Tab teilen sich de facto ein Thema (Kochen). Alternative waere 4 Tabs (Heute, Tagebuch, Kochen mit Segment Rezepte | Mahlzeiten | Plan | Liste, Profil). Gewinn: Tab-Leiste auf 320 px entspannt, "Wochenplan"-Benennungsproblem (UXL-02) verschwindet. Risiko: tiefere Segmentleiste. Aufwand M. Prioritaet niedrig, nur als Alternative zu E1 pruefen.

F9. Tagebuch vs. Heute doppelt: Beide zeigen Tag, Datum, Eintragen (diary.page.html, dashboard.page.html). Runde 1 hat Datums-Signale schon vereinheitlicht, aber die Rolle der Tabs bleibt unscharf (Heute = Summe, Tagebuch = Liste). Yazio/MFP haben ein Diary als Hauptscreen. Vorschlag: Pruefen, ob Heute die Liste der Eintraege (kompakt, loeschbar) direkt unter den Ringen zeigt und Tagebuch zur Verlaufs-/Wochenansicht wird. Aufwand L. Prioritaet niedrig (These).

F10. KI-Abhaengigkeit als Risiko fuer Versprechen "KI ist Helfer": Etikett-Scan, Rezept-Import und Wochenplan haengen am Gratis-Worker/Gemini (Quota, Billing offen, E7). Fallt der Worker weg, sind drei Leitfunktionen tot. Vorschlag: Ehrliche Degradation messen: Etikett-OCR laeuft lokal (Tesseract), URL-Import ohne KI per JSON-LD (CMP-06) zuerst, da das ~80 % der Rezeptseiten abdeckt. Aufwand M. Prioritaet mittel.

## Fragen/Thesen an andere Rollen
1. An Coach/Ernaehrung: Wuerdet ihr den Hero wirklich auf "kcal und Eiweiss" begrenzen und Fett/KH/Ballaststoffe/Salz/Zucker aus der Hauptansicht nehmen? Wer braucht sie taeglich, ausser Jakob nie?
2. An QA/Worker/Security: Wie viel Haertung ist fuer einen Einzelnutzer-Worker verhaeltnismaessig? These: Tageslimit + Kostendeckel reichen; alles darueber (Install-ID, Durable Objects) erst bei Weitergabe (E8).
3. An UX/iOS: Ist das Eintragen-Sheet tatsaechlich der schnellste Weg, oder braucht Heute einen Ein-Tipp-Pfad (Favorit/Zuletzt ohne Sheet-Oeffnen)? Wer hat gemessen, wie viele Taps ein typisches Fruehstueck kostet?

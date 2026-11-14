# Funktions- und UX-Check

Stand 2026-11-14. Nur gelesen: Templates, Komponenten, Stores und die Screenshots aus `w2-nachher` (375 und 320 px, Chromium). Nichts gebaut, nichts am Gerät geprüft. Pfade beziehen sich auf `src/app/`. "Nicht geprüft" kennzeichnet Aussagen, die aus dem Code abgeleitet, aber nicht gemessen sind.

Schweregrad: hoch = Datenverlust oder Kernablauf blockiert, mittel = merkliche Reibung oder Lücke, niedrig = Politur.

## A. Bestehende Funktionen im Check

### Tagesübersicht (Heute)
- Hero "kcal noch" und "g Eiweiß noch", zwei große Ringe, vier Mini-Balken, Wochenstreifen (Eiweißziel), Gewichtskachel, Essenszeiten, Fastfood-Helfer (`dashboard/dashboard.page.html:20-135`). Jeder Wert öffnet einen Drill mit Anteilen je Eintrag. Klar, das Eiweiß steht gleichrangig neben den Kalorien.
- Der Seitenaufbau braucht bei 667 px Höhe zwei Scrollschritte, bis die Essenszeiten sichtbar sind (Screenshot `dashboard-375-light`, `dashboard-320-light-unten`). Mittel.
- Die Gewichtskachel erscheint nur, wenn heute schon etwas eingetragen ist (`dashboard.page.html:81`: `isToday() && !isEmptyDay()`). Das Morgengewicht vor dem Frühstück lässt sich auf Heute nicht erfassen, nur über Profil. Mittel.
- Ohne Profil fehlt der Eintragen-Knopf ganz (`<ion-fab>` liegt im `@else`-Zweig, Zeile 137-139). Wer zuerst essen eintragen will, muss das Profil ausfüllen oder ins Tagebuch wechseln. Niedrig.
- Drill-Liste nutzt `track item.label` (Zeile 181). Zwei Einträge mit gleichem Namen erzeugen doppelte Schlüssel. Nicht geprüft, ob sichtbar. Niedrig.

### Eintragen (Sheet, `diary/add-entry-sheet`)
Gemeinsam: Essenszeit-Chips oben, vorbelegt nach Uhrzeit (`mealForHour`), Quellenkacheln Barcode, Etikett, Rezept, Eigene, Mahlzeiten, Manuell (`shared/food-sources/food-sources.component.html:3-13`). Danach Formular mit Menge, Chips (50/100/150/200), Vorschau, Akkordeon "Nährwerte anpassen". Toast mit Rückgängig.
- **Suche:** 400 ms Entprellung, ab 2 Zeichen, Treffer als Textzeilen, Enter wählt den ersten Treffer, "Manuell eintragen" ohne Treffer (`diary/diary-search.ts`, `shared/food-search/food-search.component.html`). Fehler laufen über `foodErrorMessage`. Gut gelöst, Schutz gegen veraltete Antworten (Sequenznummer, `diary-search.ts:81`). Hakt: Das Suchfeld wird nur dann automatisch fokussiert, wenn es keine Favoriten und kein "Zuletzt" gibt (`add-entry-sheet.component.ts:305-308`). Bei normaler Nutzung kostet die Suche also einen Extra-Tipp. Mittel.
- **Barcode:** Vollbild-Scanner mit Rahmen, "Code eintippen", Rescan nach Fehlschlag (`shared/barcode-scanner`). Gut: Fallback ohne Kamera öffnet das Eingabefeld. Hakt: Bei "Kein Produkt gefunden" (`barcode-scanner.component.ts:175`) bleibt nur ein Text; es gibt keinen Knopf "Etikett fotografieren" oder "Manuell eintragen mit diesem Code". Der unbekannte Code wird nirgends gemerkt. Mittel. Kamera im WKWebView: nicht geprüft.
- **Etikett-Foto:** KI-Vision wenn der Worker erreichbar ist, sonst Tesseract-OCR auf dem Gerät (`food-sources.component.ts:150-168`). Gut: Offline-Fallback, Statustext, Hinweis nach 8 s, bei Fehlschlag Wechsel ins manuelle Formular mit Meldung (`add-entry-sheet.component.ts:onScanFailed`). Hakt: KI-Etikett fragt fest `per100g` ab (Zeile 153); Etiketten nur mit "pro Portion" werden der KI als 100 g vorgelegt. Nicht geprüft, wie die KI darauf reagiert. Niedrig.
- **Manuell:** Name optional, nur kcal reicht (Schnell-Eintrag), Akkordeon ist offen (`add-entry-sheet.component.ts:379-396`). Hakt: Das kcal-Feld bekommt keinen Fokus, die Tastatur öffnet erst nach einem Tipp. Niedrig.
- **Zuletzt und Favoriten:** Ein Tipp trägt mit der letzten Menge ein, das Sheet bleibt offen, "Fertig" erscheint (`add-entry-sheet.component.html:16-18, 59-117`). "Zuletzt" ist nach Essenszeit gefiltert und auf 8 begrenzt. Der schnellste Weg der App, gut. Hakt: Beide Listen verschwinden, sobald ein Suchbegriff steht (Zeile 59, 81). Niedrig.
- **Mahlzeit/Rezept im Sheet:** Mahlzeit trägt alle Einträge mit einem Tipp ein. Rezept öffnet das Formular (Portionen) und braucht zwei Tipps mehr. Kachel "Mahlzeiten" nur sichtbar, wenn eine existiert (Zeile 52). Niedrig.

### Tagebuch (`diary/diary.page.html`)
- Segment Tag/Woche, Datumsleiste, Summenkarte, Fastfood-Helfer, je Essenszeit eine Liste. "Tag kopieren", "Vom Vortag übernehmen" je leere Essenszeit (Zeile 17-21, 78-83), Wischen mit Duplizieren/Bearbeiten/Löschen, zusätzlich ein "…"-Menü (Zeile 113). Stark: Kopieren und Duplizieren sind vorhanden.
- Hakt: Drei Wege zur selben Aktion (Tippen, Wischen, "…") ohne erkennbare Reihenfolge. Niedrig. Die Kürzel E/KH/F stehen erst in der Fußzeile erklärt (Zeile 123), sichtbar nur nach Scrollen ans Ende. Niedrig.

### Gewicht
- Gewichtskarte im Profil: letzter Wert, Trend in kg/Woche (28-Tage-Regression, ab 7 Tagen Spanne), SVG-Diagramm mit 7-Tage-Mittel, Hinweis "Ziel neu berechnen" ab 2 kg Abweichung vom Profilgewicht, Liste mit Löschen (`weight/weight-card.component.html`, `core/weight/weight-math.ts:9-18`). Solide und getestet.
- Hakt: Das Diagramm zeigt die letzten Einträge, keinen wählbaren Zeitraum (4/12 Wochen). Niedrig. Der Hinweis vergleicht nur mit dem Profilgewicht, nicht mit der tatsächlichen Aufnahme (siehe C). Niedrig.

### Rezepte lokal
- Karten mit kcal je Portion, vier Makrokacheln, "Eintragen" und "Kochen", "…"-Menü (`recipes/recipes.page.html:27-86`). Gut lesbar.
- Hakt: "Eintragen" läuft über zwei Action-Sheets (Essenszeit, dann Portionen) und trägt immer für heute ein, ohne Rückgängig-Hinweis (`recipes.page.ts:581-594`; das Eintragen-Sheet hat Rückgängig). Mittel. Gleiches gilt für Mahlzeiten (`meals/meals-list.component.ts:241-256`, Datum fest heute). Niedrig.

### Online-Suche, Import
- Online-Suche (spoonacular über Worker, Filter, Nachladen, Übersetzung) und Import (Text, Link, Foto) hängen als zwei reine Symbole im Kopf der Rezepte-Seite (`recipes.page.html:5-11`: Globus, Pfeil nach unten). Mittel (Auffindbarkeit, siehe B).
- Gut: Importergebnis läuft durch `recipe-import-normalize.ts`, Prüfschritt vor dem Speichern, KI-Kennzeichen. Offene Logikfehler laut CODE-REVIEW: `loadMore` nutzt den aktuellen Suchbegriff (8.2), `translating` springt zu früh (8.3). Niedrig.
- Link-Import bei TikTok liefert nur Titel und Beschreibung, nicht das Video (WELLE-4-ENTWURF). Mittel für den Nutzen, nicht für die Stabilität.

### Kochmodus
- Vollbild, erst Zutatenseite, dann Schritt für Schritt, Fortschrittsbalken, Zurück/Weiter/Fertig (`shared/cook-mode/cook-mode.component.html`). Funktioniert einfach.
- Hakt: Es gibt keinen Bildschirm-Wachhalter (Suche nach `wakeLock` im Projekt: 0 Treffer). Beim Kochen dunkelt das iPhone ab. Keine Timer. Schließen-Symbol ohne `aria-hidden` am Icon (Zeile 9-11). Mittel. Wischen zwischen Schritten: nicht geprüft.

### Mahlzeiten
- Gespeicherte Kombinationen, Einträge per "+" in eine Essenszeit, Löschen mit Rückgängig (`meals/meals-list.component.html`). Der Verwerfen-Dialog wurde in Welle 1 repariert.
- Hakt: Eine Mahlzeit lässt sich nur aus Suche und Rezepten neu zusammenbauen, nicht aus bereits eingetragenen Tagebuchzeilen ("Diese Essenszeit als Mahlzeit speichern" fehlt; Suche nach entsprechender Funktion: 0 Treffer). Mittel.

### Einkaufsliste
- Liste mit Kategorien, Abhaken, Preis je Zeile, Summe "Gesamt/offen", Teilen, Wischen zum Löschen, FAB für manuelle Artikel (`shopping/shopping.page.html:1-200`, Screenshots `liste-375`, `liste-320`). Kategorien-Überschrift erscheint bei importierten Zutaten englisch ("PRODUCE", Screenshot `liste-375`; bekannte Übersetzungsaufgabe in MEMORY). Mittel.
- Hakt: Jede Zeile trägt den Textknopf "Preis ändern" in Akzentfarbe und erzeugt damit visuell die lauteste Fläche der Zeile, lauter als der Artikelname. Die Preisfunktion ist für eine Protein-App Nebensache. Niedrig. Der Leerzustand erklärt "Tippe auf „+“" (Zeile 281), das Plus liegt aber unten rechts über der Tab-Leiste, nicht im Text. Niedrig.

### Wochenplan
- Formular: Personen, Tage, Essenszeiten, Quelle (online oder eigene Rezepte), Budget und Markt nur mit KI. Ergebnis als Karten je Essenszeit mit Detail-Sheet, Kochen, "In Tagebuch eintragen" (`shopping/week-plan`). Nachübersetzung läuft im Hintergrund.
- Hakte, **auf dem Branch `welle-2-layout` behoben (Commit 4ba8585, zwei Unit-Tests, Menü auch während der Übersetzung gesperrt)**: Race beim Nachübersetzen (CODE-REVIEW 7.1, `core/week-plan/week-plan.service.ts`). Alter Befund: Entfernt der Nutzer in der Wartezeit ein Rezept oder erzeugt einen neuen Plan, überschreibt der alte Stand den neuen, samt Einkaufsliste. Hoch (Datenverlust, aber nur Planungsdaten). Menü ist nur bei `busyId` gesperrt (`week-plan-cards.component.html:37`). Screenshot `plan-320` zeigt den Zustand "2 Rezepte sind noch auf Englisch" mit Knopf, also ist der Pfad im Alltag erreichbar.
- Der Planer sucht nach Eiweiß, zeigt aber je Karte nur "kcal · g Eiweiß · Portionen"; das Tagesziel erscheint nicht gegenüber dem Plan. Niedrig.

### Fastfood-Helfer
- Sheet mit Kette, kcal-Budget (aus Resttag vorbelegt), Geldbudget, Vorliebe; KI schlägt Gerichte vor, Tipp trägt ein (`diary/fastfood-sheet`). Nur mit KI-Verbindung. Gut: Resttag-Vorbelegung, Hinweis "noch X g Eiweiß".
- Hakt: Antwort einer alten Anfrage erscheint nach erneutem Öffnen, der Knopf bleibt bis dahin gesperrt (`fastfood-sheet.component.ts:44-48, 78-100`, CODE-REVIEW 7.4). Mittel. Eingetragen wird mit der Essenszeit der aktuellen Uhrzeit, auch wenn ein anderer Tag offen ist (Zeile ~115). Niedrig.

### Profil und Ziele
- Zielkarte, Gewichtskarte, "Mein Profil" (Sheet mit Mifflin-St Jeor, Aktivität, Ziel, Tempo, Zielgewicht, automatisch/manuell), KI-Status, Rezeptsuche, Einheiten, Anleitung, Rechtliches, Daten (`settings/settings.page.html`). Plausibilitätsprüfungen und Mindestzufuhr vorhanden. Gut.
- Hakt: Der lange Haftungstext steht als Absatz oberhalb der Gewichtskarte (Zeile 20) und schiebt den Verlauf bei 320 px unter die Falz (Screenshot `settings-320-light`). Niedrig. Die Seite ist eine lange Liste ohne Gruppen-Navigation. Niedrig.

### Backup und Export
- Export per Teilen-Dialog, sonst Download-Link, Import mit Prüfung, 20-MB-Grenze, Schlüssel-Whitelist, Auto-Sicherung vor Import/Reset, Erinnerung auf Heute (`core/backup/backup.service.ts:142-170`, `shared/backup-reminder`). Stark gebaut.
- Hakt: Ein Datei-Download per `<a download>` (Zeile 160-170) tut im iOS-WebView nach bisherigem Wissen nichts; im `package.json` stehen weder `@capacitor/share` noch `@capacitor/filesystem`. Hängt alles an `navigator.share` mit Dateien. Nicht auf iPhone geprüft. Wenn es dort nicht greift, ist die einzige Datensicherung wirkungslos. Hoch (bis geprüft).
- Import-Fehlerpfade: Erfolgsmeldung trotz fehlgeschlagenem Zurücksetzen (CODE-REVIEW 3.1, 3.6), `shopping: {}` im Backup kann die App beim Start abstürzen lassen (6.4). Mittel.

### Offline-Verhalten
- Lokal und offline: Tagebuch, Favoriten, Zuletzt, eigene Lebensmittel, Rezepte, Etikett per OCR, Gewicht, Wochenstatistik. Netz nötig: Namenssuche, Barcode, Online-Rezepte, KI, Preise. Jede Funktion zeigt bei Fehler die Meldung "Keine Internetverbindung ..." (`core/messages/state-messages.ts:7`).
- Hakt: Es gibt keinen globalen Offline-Hinweis und keine zwischengespeicherte Trefferliste früherer Suchen (Cache nur im Worker, 1 Stunde). Kein Service Worker in `angular.json` (Suche: 0 Treffer). Die iOS-App bündelt die Dateien und startet offline; die Web-Version auf GitHub Pages: nicht geprüft. Niedrig.
- Speicher: Übersetzungs-Cache bis 120 Rezepte konkurriert mit dem Tagebuch um die ca. 5 MB localStorage (CODE-REVIEW 7.3). Mittel auf lange Sicht.

## B. UI/UX-Befunde

### Reibung im Hauptablauf "Essen eintragen"
Gezählt wird ab geöffneter App auf Heute (Starttab), ohne Tippen von Text und ohne Systemdialoge der Kamera. Essenszeit ist nach Uhrzeit vorbelegt; eine andere Essenszeit kostet +1 Tipp.

| Weg | Tipps | Ablauf |
|---|---|---|
| Favorit oder Zuletzt | 2 | FAB, Zeile. Sheet bleibt offen, "Fertig" ist ein optionaler dritter Tipp |
| Barcode | 3 | FAB, Barcode, (Scan automatisch), Eintragen. Beim ersten Mal +1 für die Kamera-Freigabe |
| Mahlzeit | 3 | FAB, Kachel "Mahlzeiten", Mahlzeit |
| Suche (leere Historie) | 3 | FAB (Suchfeld fokussiert), Treffer, Eintragen |
| Suche (normale Nutzung) | 4 | FAB, Suchfeld, Treffer, Eintragen. Dazu Tippen und 400 ms Wartezeit plus Netz |
| Manuell | 4 | FAB, Manuell, kcal-Feld, Eintragen (plus Zahl) |
| Rezept im Sheet | 4 | FAB, Rezept, Rezept, Eintragen |
| Rezept über Rezepte-Tab | 4 | Tab, "Eintragen", Essenszeit-Sheet, Portionen-Sheet (ohne Rückgängig) |
| Etikett-Foto | 5 | FAB, Etikett, Auslöser, "Foto verwenden", (Wartezeit KI oder OCR), Eintragen |

Einordnung: Die schnellen Wege (2-3) sind gut. Der häufigste Weg für neue Lebensmittel, die Suche, ist mit 4 Tipps der zweitlängste der Standardwege.

### Befundtabelle

| Befund | Beleg | Grad | Vorschlag |
|---|---|---|---|
| Navigation nur mit Symbolen; Beschriftung entfiel in Welle 2. DESIGN.md nennt noch "Labels 13 px". Rezepte (Buch), Tagebuch (Kalender), Einkauf (Korb) sind mehrdeutig, Rezepte enthält zusätzlich Mahlzeiten | `tabs/tabs.page.html:3-21`, `tabs.page.scss:36`, Screenshot `dashboard-375-light` | mittel | Beschriftung unter dem Symbol des aktiven Tabs oder aller Tabs (11-12 px), DESIGN.md angleichen |
| Zwei Symbol-Buttons im Kopf der Rezepte-Seite (Globus = Online-Suche, Pfeil = Import) erklären sich nicht; "Importieren" ist ein Kernweg für Rezepte | `recipes/recipes.page.html:5-11`, Screenshot `rezepte-320` | mittel | Text-Pille "Importieren" im Leerzustand (vorhanden) auch in der Liste, Online-Suche als Segment oder Kachel |
| FAB überdeckt Inhalt beim Scrollen: "520 kcal", "Zucker 10 / 68 g", letzter Balken der Wochenansicht (Heute-Tag), Einkaufszeile | Screenshots `dashboard-375-light`, `diary-tag-375`, `diary-woche-320`, `liste-375`, `rezepte-320` | mittel | Wertspalte rechts mit 72 px Einzug in Listen, oder FAB beim Scrollen einklappen |
| Heute: Essenszeiten (die Haupt-Einstiege) liegen unter Ringkarte, Wochenstreifen und Gewicht, bei 667 px erst nach zwei Scrollschritten. Drei Darstellungen derselben Zahl (Hero, Ring, Mini-Balken) | `dashboard.page.html:20-118`, `dashboard-320-light-unten` | mittel | Essenszeiten direkt unter den Hero, Ringkarte und Wochenstreifen darunter |
| Einhändig: Hero-Zahlen, Datum-Navigation und Kopf-Aktionen liegen oben, außerhalb der Daumenzone. Zeilen-Aktionen "…" und Plus je Essenszeit liegen rechts am Rand | `dashboard.page.html:16`, `diary.page.html:67,113` | niedrig | Wichtigste Aktion (Eintragen) liegt unten rechts, das ist gut; Datumswechsel zusätzlich per Wischen: nicht geprüft |
| Quellenkacheln im Sheet nur Symbol plus Kurzwort; "Eigene" ist unklar, "Etikett" verbirgt eine KI-Funktion | `food-sources.component.html:3-13`, `add-entry-sheet.component.html:48` | niedrig | "Eigene Lebensmittel", Etikett mit Kamera-Symbol |
| Leerer Suchzustand "Suche oder scanne ein Lebensmittel." ist nur ein 13-px-Hinweis; kein Weg "Zuletzt" bei erstem Start | `add-entry-sheet.component.html:116` | niedrig | Beispielzeile oder Hinweis auf Manuell |
| Barcode nicht gefunden: nur Text, kein Anschluss (Etikett, Manuell) | `barcode-scanner.component.ts:175` | mittel | Zwei Knöpfe unter dem Fehlertext |
| Vorschau im Formular zeigt "– kcal – g Eiweiß", bis Werte stehen; bei Manuell steht die Eingabe des kcal-Feldes unterhalb der Vorschau und des Akkordeon-Kopfes | Screenshot `diary-eintragen-320` | niedrig | kcal-Feld zuerst, Fokus setzen |
| Rückmeldungen uneinheitlich: Sheet-Eintrag mit Rückgängig (3,5 s, oben), Rezept- und Mahlzeit-Eintrag ohne Rückgängig, Backup-Erfolg als Toast | `diary/entry-toast.ts`, `recipes.page.ts:593`, `meals-list.component.ts:241` | mittel | Alle Einträge ins Tagebuch über `showEntryToast` mit Rückgängig |
| Ladezustände vorhanden (Suche, Etikett, KI, Wochenplan), aber KI-Aufrufe ohne Abbrechen; Wochenplan-Erstellung bis ca. 1 Minute | `food-sources.component.html:16`, `week-plan-cards.component.html:7-9` | niedrig | "Abbrechen" neben dem Ladezustand |
| Fehlerzustände sind klar und deutsch, aber KI-Rohfehler können durchschlagen (`TypeError`-Text in der Einkaufsliste) | CODE-REVIEW 6.2, `shopping.page.ts:~380` | mittel | Antwort normalisieren, feste Meldung |
| Wochenansicht zeigt Balken ohne Zahlen; Wert pro Tag nur im `aria-label` des Diagramms | `diary/week-view/week-view.component.html:42-55` | mittel | Tipp auf Balken zeigt Wert, oder Zahl über dem Balken |
| 320 px: Umbruch statt Abschneiden ist umgesetzt (Welle 1 und 2); Texte wie "Anteil an der gegessenen Energie: Eiweiß 17 % · ..." brechen mitten in der Zahl ("17 / %") | Screenshot `dashboard-320-light-unten` | niedrig | Nichtumbrechbares Leerzeichen vor "%" |
| 320 px: Einkaufszeile hat Name, Menge, "Preis ändern" in einer Zeile; langer Name nimmt zwei Zeilen | Screenshot `liste-375` | niedrig | Preis in zweite Zeile, nur Symbol |
| Kontrast: Tokens im Dokument auf 4,5:1 und mehr ausgelegt (DESIGN.md); Sekundärtext 5,5:1. Fett-Farbe auf Spur 4,0:1 und Zucker-Farbe knapp, unter 4,5:1 bei Text | `DESIGN.md` Tokens | niedrig | Nur Balkenfüllung, nie kleinen Text in Fett/Zucker-Farbe |
| Dynamic Type: Schriftgrößen laufen über `rem`-Tokens (`theme/variables.scss:82-87`), aber 27 `px`-Schriftangaben bleiben (z. B. Hero 56 px) | Suche `font-size: *px` in `*.scss`: 27 Treffer | niedrig | Auf `rem` umstellen; Verhalten mit großer Systemschrift: nicht geprüft |
| Barrierefreiheit: Icon-Buttons haben `aria-label` (Tab-Leiste, FAB, Kopf, Sheets). Cook-Mode-Close ohne `aria-hidden` am Icon; Chips mit `role="radio"` ohne Pfeiltasten | `cook-mode.component.html:9`, `add-entry-sheet.component.html:33-37` | niedrig | Icon `aria-hidden`; Screenreader-Test mit VoiceOver: nicht geprüft |
| Auffindbarkeit versteckter Funktionen: "Tag kopieren", "Vom Vortag übernehmen", Favoriten-Stern (nur nach Bearbeiten oder in "Zuletzt"), Wischen im Tagebuch | `diary.page.html:17,78`, `add-entry-sheet.component.html:95` | mittel | Kurzer Erstnutzungs-Hinweis; Stern direkt in Zuletzt (ist da), Anleitung erwähnt es nicht (`settings.page.html:186-193`) |
| Anleitung (6 Punkte) erwähnt Favoriten, Kopieren, Gewicht, Etikett, Fastfood nicht | `settings.page.html:186-193` | niedrig | Zwei Zeilen ergänzen |
| Heute zeigt "kcal noch" mit großem Wort "noch" unter der Zahl; Lesefolge "1 718 kcal noch" ist ungewohnt | `dashboard.page.html:30`, Screenshot `dashboard-375-light` | niedrig | "übrig" statt "noch", in der Hero-Zeile vereinheitlichen |

## C. Ideen für weitere Funktionen

Geprüft, dass es nicht schon existiert: Favoriten, Tag und Essenszeit kopieren, Duplizieren, Gewichtstrend mit Drift-Hinweis, Serie im Ziel, Wochenstatistik, Wochenstreifen, Fastfood-Helfer, Kochmodus, Einheitensystem, Backup-Erinnerung. Nicht vorhanden (Suche im Projekt: 0 Treffer): Wasser, Erinnerungen (kein Notification-Plugin), Apple Health, Widget, Eiweiß-Dichte, Vorrat, Tagebuch-Einträge als Mahlzeit speichern.

### Empfehlung: die fünf besten

1. **Eiweiß-Restbedarf mit konkreten Vorschlägen (offline).** Heute steht nur "noch 84 g". Aus Favoriten, Zuletzt, Rezepten und Mahlzeiten wird gerankt, was Resteiweiß bei Restkalorien am besten füllt. Nutzen: Beantwortet die Kernfrage der App am Abend. S-M, nur App, kein KI-Aufwand. Risiko niedrig (reine Rechnung, gut testbar). Begründung: höchster Nutzen je Aufwand, nutzt vorhandene Daten und das Heute-Hero.
2. **Eiweiß-Dichte sichtbar machen (g Eiweiß je 100 kcal) und Suche danach sortierbar.** Nutzen: Eiweißreiche Lebensmittel erkennen, ohne zu rechnen. S, nur App. Risiko niedrig (OFF-Daten lückenhaft, Treffer ohne Eiweiß ausblenden). Begründung: passt zum Fokus, billig.
3. **Einträge einer Essenszeit oder eines Tages als Mahlzeit speichern.** Nutzen: Wiederkehrende Frühstücke ohne Neuanlage. S, nur App. Risiko niedrig. Begründung: schließt die Lücke zwischen Tagebuch und Mahlzeiten, spart Tipps im Alltag.
4. **Kalorienbedarf aus Gewichtsverlauf und Aufnahme nachführen.** Nutzen: Aus 3-4 Wochen Aufnahme und Trend einen realen Verbrauch ableiten, statt nur nach 2 kg Drift auf die Formel zu verweisen. M, nur App. Risiko mittel (Rechenfehler bei lückigem Tagebuch, nur Vorschlag mit Bestätigung, wie schon beim Drift-Hinweis). Begründung: Der Text im Profil ("nach 2 bis 3 Wochen vergleichen") verlangt das heute vom Nutzer.
5. **Beschreiben (Freitext/Diktat) mit Bestätigungsliste.** Entwurf in WELLE-4-ENTWURF vorhanden. Nutzen: Eine Mahlzeit in einem Satz statt vier Suchläufen. M, Worker-Deploy, ein KI-Aufruf je Eingabe (1 % des Tagesdeckels bei 5 Eingaben). Risiko mittel (KI-Schätzwerte, durch Prüfliste und Plausibilitätsregeln begrenzt). Begründung: größter Hebel bei den 4-5 Tipps der Suche, ohne natives Plugin.

### Weitere Ideen (nach Nutzen/Aufwand)

| # | Idee | Nutzen | Aufwand | Abhängigkeit | Risiko |
|---|---|---|---|---|---|
| 6 | Tagesabschluss: Resteiweiß am Abend eintragen oder bewusst überspringen, Serie bleibt nachvollziehbar | Streak ehrlicher, weniger Frust | S | nur App | niedrig |
| 7 | Wochenrückblick über 4 und 12 Wochen (Mittel, Tage im Ziel, Gewicht daneben) | Trends statt 7-Tage-Fenster | M | nur App | niedrig |
| 8 | Schnell-Eintrag "Eiweiß-Shake/Riegel" als wiederverwendbare Kachel auf Heute | 1 Tipp für häufigste Zusatzeinträge | S | nur App | niedrig |
| 9 | Kochmodus: Bildschirm wach halten und Timer je Schritt | Kochen ohne Abdunkeln | S | Web-API `wakeLock` oder Plugin | niedrig |
| 10 | Rezeptmenge im Tagebuch skalieren (z. B. "halbe Portion", "300 g vom Topf") | Präzisere Rezepteinträge | S-M | nur App (Gewichtsbasis ist vorhanden: `cookedWeight`) | niedrig |
| 11 | Erinnerung "Eiweiß noch offen" am Abend und Backup-Erinnerung als Systemmeldung | Weniger vergessene Tage | M | natives Plugin (Local Notifications), Berechtigung | mittel (App-Store-Texte, Nutzerakzeptanz) |
| 12 | Apple Health: Gewicht lesen/schreiben | Wiegen ohne Doppeleingabe | L | natives Plugin (HealthKit), Berechtigungstexte, Datenschutztext | mittel |
| 13 | TikTok/Video-Import (Stufe 1: oEmbed plus mehrere Screenshots) | Rezepte aus Social-Media übernehmen | M | Worker, KI-Kosten | mittel (Seiten ändern sich, Nutzungsbedingungen) |
| 14 | Portionsfoto: Schätzung von Menge aus Foto | Schnellerer Eintrag ohne Waage | L | Worker, KI-Kosten, Gewicht 2 je Foto | hoch (Genauigkeit, Vertrauen) |
| 15 | Vorratsliste: Einkaufsliste um vorhandene Zutaten kürzen | Kürzere Einkaufsliste | M | nur App | mittel (Pflegeaufwand, Nutzer hält Liste nicht aktuell) |
| 16 | Kostenübersicht Einkauf (Woche, Monat, je Gramm Eiweiß) | Preis pro Eiweiß vergleichen | M | nur App, Preise sind Schätzungen | mittel (Schätzpreise aus Tabelle, `ingredient-price-table.ts`) |
| 17 | Widget "Eiweiß noch" auf dem Home-Bildschirm | Wert ohne App-Start | L | natives Widget (WidgetKit, Swift), Datenaustausch über App Group | hoch (Xcode-Arbeit, getrennte Datenhaltung) |
| 18 | Wassertracking | Zusatz für Alltag | S | nur App | niedrig, aber abseits vom Fokus (siehe D) |

## D. Was ich weglassen oder vereinfachen würde

- **Preisschätzung, Budget und Markt im Einkauf** (`shopping.page.html:131-150`, `core/shopping/ingredient-price*.ts`). Preise aus einer Richtwerttabelle oder KI-Schätzung sind unzuverlässig (Screenshot `liste-375`: 129,99 € für Hafermilch, vermutlich Testwert). Vereinfachen: Preisfeld nur manuell und optional, Summe nur über eingegebene Preise, Budget/Markt entfernen. Spart Worker-Aufrufe und Fehlerfälle (CODE-REVIEW 6.2). Regel Nr. 1 in DESIGN.md verbietet Entfernen; Gruppieren hinter "Mehr" ist erlaubt.
- **Wochenplan online mit Nachübersetzung.** Größte Komplexität der App (Race 7.1, Cache 7.3, englische Zutaten, Kategorien auf Englisch) bei vermutlich seltener Nutzung. Vereinfachen: Plan standardmäßig aus eigenen Rezepten; Online-Variante hinter einem zweiten Schritt. Nicht geprüft, wie oft der Plan tatsächlich benutzt wird.
- **Doppelte Eintrags-Pfade für Rezepte** (`recipes.page.ts:581` gegen `add-entry-sheet`). Beide tragen Rezepte ein, mit unterschiedlicher Rückmeldung. Zusammenführen auf das Sheet.
- **Drei Aktionswege am Tagebucheintrag** (Tippen, Wischen, "…"). Wischoptionen und "…" doppeln sich. Wischen behalten (iOS-üblich), "…" nur bei Bedarf für Screenreader oder entfernen.
- **Drei Darstellungen derselben Tageswerte auf Heute** (Hero, Ringe, Mini-Balken plus Energieanteile in Prozent, `dashboard.page.html:20-77`). Hero und Ringe zeigen dieselben zwei Zahlen. Vereinfachen: Hero plus ein Balkenblock, Ringe nur für kcal und Eiweiß in der Drill-Ansicht.
- **Imperial-Einheiten** (`settings.page.html:48-57`). Für einen Nutzer in Österreich mit metrischer Nutzung kaum Nutzen; Pflege in Rezepten, Kochmodus und Einkauf kostet Tests. Nur auf Bedarf, sonst entfernen.
- **Debug-Log** (`?debug=1`), Diagnose-`fetch` ohne Timeout (CODE-REVIEW 3.3). Für Ein-Personen-App nach Stabilisierung entbehrlich.
- **Veralteter Proxy `server/gemini-proxy`** (CODE-REVIEW 2.1): löschen.

## E. Nicht geprüft

- Echtes iPhone, Safari/WebKit: Kamera-Freigabe, Barcode-Scan im WKWebView, Foto-Aufnahme, Auto-Zoom bei Feldfokus, Tastaturhöhe, Safe Area (Welle 1 UMSETZUNG nennt dasselbe).
- Backup-Export auf iOS (Teilen-Dialog gegen Datei-Download): der Pfad wurde nur im Code gelesen.
- Wischgesten: Zeilen im Tagebuch, Einkauf, Mahlzeiten, Toast wegwischen, Kochmodus-Schritte, Datum wischen.
- Dark Mode: bewusst aus (`color-scheme: light`, DESIGN.md Entscheidung E5); die `-dark`-Screenshots wurden nicht ausgewertet.
- Dynamic Type bei großer Systemschrift, VoiceOver, Schalter-Steuerung, Reduzierte Bewegung am Gerät.
- Last und Zeit: Dauer der Namenssuche, der KI-Aufrufe und der Nachübersetzung; Verhalten bei langsamem Netz.
- Web-Version auf GitHub Pages offline (kein Service Worker gefunden, nicht ausprobiert).
- Datenmengen: Tagebuch mit mehreren Monaten, localStorage-Grenzen (CODE-REVIEW 7.3).
- Tatsächliche Nutzungshäufigkeit von Wochenplan, Preisen und Fastfood-Helfer; Entscheidungen in D sind Einschätzungen aus dem Code, keine Messung.
- Worker-Verhalten (`worker.js`) und KI-Qualität: nur über CODE-REVIEW und WELLE-4-ENTWURF übernommen, nicht neu gelesen.

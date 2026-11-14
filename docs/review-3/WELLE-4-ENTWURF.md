# Welle 4: Entwurf (wartet auf Go)

Stand 2026-11-14. Nichts davon ist gebaut. Beide Features brauchen eine neue Worker-Funktion und damit einen Worker-Deploy.

Rahmen (aus dem Code): KI läuft nur über den Cloudflare Worker (`worker.js`, Funktionen in `AI_FUNCTIONS`), Modell `gemini-3.6-flash` mit Ausweichmodell, Tagesdeckel 500 (`wrangler.toml`, `DAILY_AI_CAP`), Foto-Aufrufe zählen doppelt (`PHOTO_CALL_WEIGHT = 2`), Body höchstens 5 MB.

## A Essen per Sprache oder Freitext

### Ablauf
1. Im Eintragen-Sheet neuer Weg "Beschreiben": ein Textfeld ("2 Semmeln mit Butter und Schinken, ein Apfel, Cappuccino").
2. Sprache: auf dem iPhone über die Diktier-Taste der Tastatur. Das funktioniert in jedem Textfeld und braucht keine Berechtigung. Ein eigener Mikrofon-Button erscheint nur, wo der Browser `SpeechRecognition` anbietet (in der iOS-App nicht verfügbar).
3. Tipp auf "Erkennen": ein KI-Aufruf, Rückmeldung mit Ladezustand und Abbrechen.
4. Bestätigungsliste: je Lebensmittel Name, Menge (änderbar), kcal und Eiweiß, Kennzeichen "KI-Schätzung". Zeilen lassen sich entfernen. Summe unten.
5. Erst "Eintragen" schreibt ins Tagebuch (ein Eintrag je Zeile, Rückgängig-Hinweis wie bisher).

### KI-Aufruf
- Neue Worker-Funktion `parseMeal`: Eingabe Text (höchstens 500 Zeichen), Ausgabe Liste mit höchstens 12 Einträgen `{name, amount, unit, portionG, facts je 100 g}` über ein festes Antwortschema.
- Kosten: 1 Aufruf je Beschreibung, Gewicht 1. Bei 5 Beschreibungen am Tag sind das 1 % des Deckels.

### Prüfung der Antwort (nie ungeprüft übernehmen)
- Schema und Typen prüfen, unbekannte Felder verwerfen, Namen auf Länge kürzen.
- Grenzen: Menge 1 bis 2000 g/ml, kcal 0 bis 900 je 100 g, Makros 0 bis 100 g je 100 g.
- Plausibilität: kcal gegen 4/4/9 aus den Makros (Abweichung über 25 % wird markiert, nicht still korrigiert).
- Zeilen, die durchfallen, erscheinen nicht; fällt alles durch, kommt die Meldung "Nichts erkannt" mit dem Weg zur manuellen Eingabe.
- Der Nutzertext ist für die KI Daten, keine Anweisung; die Ausgabe wird nur als Zahlen und Namen verwendet.

### Fehlerfälle
Offline, Tageslimit (429), Zeitüberschreitung, leere oder unsinnige Antwort, Text zu lang, Doppeltipp auf "Erkennen" (nur ein Aufruf).

### Alternative
Natives Sprach-Plugin (`@capacitor-community/speech-recognition`) für einen eigenen Mikrofon-Button in der iOS-App. Mehr Aufwand (Berechtigungstexte, nativer Build), kaum Mehrwert gegenüber der Diktier-Taste. Empfehlung: zunächst ohne.

## B TikTok-Video auslesen

### Was es gibt
- Rezept importieren nimmt einen Link. Der Worker lädt die öffentliche Seite (`fetchPublicPage`) und gibt den Seitentext an die KI (`importRecipe`). Bei TikTok ist das Titel und Beschreibung, sofern die Seite sie ausliefert. Das Video selbst wird nicht angesehen.
- Foto-Import existiert (Gewicht 2).

### Was technisch geht
| Weg | Bewertung |
|---|---|
| 1 Beschreibung zuverlässiger holen über TikToks oEmbed-Schnittstelle | Einfach, erlaubt, kein Mehrverbrauch. Hilft nur, wenn das Rezept in der Beschreibung steht. |
| 2 Worker lädt das Video selbst von TikTok | Nicht empfohlen: keine offizielle Schnittstelle, verstößt gegen die Nutzungsbedingungen, bricht häufig (Sperren für Server-Adressen). |
| 3 Nutzer gibt das Video selbst: in TikTok "Video speichern", dann in der App auswählen | Robust und sauber. Die KI kann Videos mit Ton auswerten. Braucht Hochladen über den Worker. |
| 4 Nutzer macht 1 bis 3 Screenshots der Zutaten-Einblendung | Geht mit dem bestehenden Foto-Import, nur Mehrfachauswahl fehlt. |

### Empfehlung
- Stufe 1: Weg 1 plus Weg 4 (mehrere Screenshots in einem Import). Kleiner Umbau, Kosten wie bisher.
- Stufe 2: Weg 3. Grenzen: Video höchstens 90 Sekunden und 20 MB (das Body-Limit des Workers muss dafür steigen oder das Video wird vorab im Gerät verkleinert). Kosten: Gewicht 5 je Video, also höchstens 100 Videos am Tag, wenn sonst nichts läuft.
- Ergebnis landet immer im bestehenden Prüfschritt "Rezept importiert, bitte prüfen und speichern". Die Normalisierung (`recipe-import-normalize.ts`) gilt unverändert.

### Fehlerfälle
Video zu lang oder zu groß, kein Rezept im Video, Upload bricht ab, Tageslimit, privates oder gelöschtes Video (nur Weg 1).

## Was ich von dir brauche
1. A: Go für "Beschreiben" mit Diktier-Taste, ohne natives Plugin?
2. B: Go für Stufe 1, Stufe 1 und 2, oder nichts davon?
3. Worker-Deploy für die neuen Funktionen.

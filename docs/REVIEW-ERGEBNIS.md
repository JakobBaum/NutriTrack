# NutriTrack: Review-Ergebnis (Runde 1, 28 Rollen)

Stand: 2026-11-08, Branch `weekly-recipes` (f635956). Quelle: 28 Einzelberichte (Rollenkürzel = ID-Präfix, z. B. QAD-01).
Alles beruht auf Code- und Screenshot-Lektüre. Nichts davon wurde auf einem Gerät oder gegen die Live-APIs geprüft. Befunde mit "(Vermutung)" im Original sind hier mit "?" markiert.
Die Diskussionsrunde (Runde 2) ist nicht zustande gekommen. Widersprüche zwischen Rollen sind unter "Offene Konflikte" gesammelt.

Aufwand: S (unter 1 h), M (unter 1 Tag), L (mehrere Tage).

---

## 1. Entscheidungen, die zuerst bei Jakob liegen

| # | Frage | Betrifft | Empfehlung |
|---|-------|----------|------------|
| E1 | Tabs: 5 (Mahlzeiten als Segment in Rezepte) festschreiben oder wieder 6? | UXL-01, RSP-03 | 5 behalten, Doku korrigieren (5 Tabs passen auf 320 px knapp) |
| E2 | Begriffe festlegen: Essenszeit (Frühstück/Mittag), Mahlzeit (gespeicherte Vorlage), Eintrag, Eiweiß statt Protein, "eintragen" als einziges Verb | TXT-01..03, UXL-02 | Glossar in PRODUCT.md, dann einmal durch die UI ziehen |
| E3 | Protein-Berechnung: Gesamtgewicht, Referenzgewicht oder Obergrenze (z. B. max. 2,2 g/kg, bei BMI über 30 auf Zielgewicht)? | NUT-01, NUT-07 | Obergrenze plus Referenzgewicht |
| E4 | Mindestzufuhr (Kalorien) nur beim Abnehmen anheben, nicht bei "Halten"? Tempo relativ (z. B. max. 1 % Körpergewicht pro Woche)? | NUT-03, NUT-04, DSG-06 | Ja, relativ statt absolut |
| E5 | Dark Mode: bewusst aus lassen (DESIGN.md) oder Token-Set bauen? | THM-04, DSY-06 | Aus lassen, Hardcodes aufräumen |
| E6 | Farbe für Eiweiß: Violett (`--nt-protein`, derzeit ungenutzt) oder Akzent-Teal? | UID-02, THM-09 | Eigene Farbe für Eiweiß, Teal bleibt Akzent |
| E7 | Worker-Kostendeckel: Durable Object oder KV? Hartes Tageslimit, Gemini-Billing aktivieren? | WRK-01, SEC-02, DSG-02 | Durable Object, Deckel setzen, Billing erst mit Datenschutztext |
| E8 | Zielplattform: nur privat (TestFlight) oder App Store? | REL-*, DSG-04, DSG-09 | Bestimmt, wie viel Welle 6 nötig ist |
| E9 | Apple Health: ja, nur Schreiben zuerst? | CMP-04 | Später, nach Gewichtsverlauf |
| E10 | `weekly-recipes` nach main mergen (geht sofort live)? | REL-05 | Erst nach Welle 1 (Bugfixes) |

---

## 2. Themen (nach Wichtigkeit)

### T1. Datenverlust und Datenintegrität (Tagebuch)
Wirkung: Blocker bis Hoch. Zuerst beheben, weil es echte Daten betrifft.

| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| QAD-01 (Blocker) | Namen im Bearbeiten-Dialog leeren setzt `label: undefined` | Leeren Namen ablehnen oder alten Namen behalten | S |
| QAE-01 | Import prüft nur "Objekt", nicht Felder; fehlendes `createdAt` lässt `entriesForDate` abstürzen | Schema-Validierung (zod) beim Import | M |
| QAE-02 | Schreibfehler (localStorage voll) werden still verschluckt | Fehler fangen, Toast "Konnte nicht gespeichert werden" | S |
| QAE-03 | Mengenprüfung nur in der UI; `add()` lässt NaN/Infinity zu | Prüfung in den Store ziehen | S |
| QAD-02 | Datum nur einmal gesetzt: nach Mitternacht zeigt "Heute" den Vortag | `ionViewWillEnter` bzw. Tageswechsel-Check | S |
| QAD-03 | Salz bleibt nach Mengenänderung unskaliert | `saltG` mitskalieren | S |
| QAD-04 | Hinweis "oder lass das Feld leer" ist falsch | Text korrigieren oder Verhalten anpassen | S |
| QAD-05 | Zweimal "Tag kopieren" verdoppelt alle Einträge | Bestätigung mit Anzahl, Doppelklick sperren | S |
| QAD-06 / QAD-07 / IXD-02 | Rückgängig vergibt neue Id und Position; zweites Löschen entfernt das erste Rückgängig | Undo-Stapel, ursprüngliche Position und Id erhalten | M |
| QAE-04 | Kein Busy-Flag, Doppelklick auf "Eintragen" legt doppelt an? | Button nach erstem Klick sperren | S |
| QAE-05 | Zwei Tabs überschreiben sich (letzter gewinnt)? | `storage`-Event oder Version-Check | M |
| QAE-06 / FRM-03 | "0.500" wird als 500 gelesen | Heuristik nur bei Gruppen mit genau 3 Stellen und Vorziffer ungleich 0 | S |
| QAE-07 | Zutatenmenge nimmt 0/negativ an (läuft in Einkaufsliste?) | Validierung | S |
| QAE-08..10 | `lastBackup` nach Reset, Rundung, Import ersetzt alles ohne Sicherung | Auto-Sicherung vor Import | S bis M |
| QAD-08 | Seiten-Logik des Tagebuchs ohne Unit-Tests | Tests nachziehen | M |
| QAD-09 / QAD-10 | Getrennte Datums-Signale in Heute und Tagebuch; Deep-Link setzt Datum zurück | Ein gemeinsames Datum | S |

### T2. Protein-Fokus und Heute-Screen
Kernversprechen der App: "vor allem Protein". Fast alle Rollen aus Coach, PM, VIZ, UX nennen dasselbe.

| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| PM-01 / COA-02 / VIZ-02 | Hero zeigt "kcal übrig", Eiweiß nur "X von Y g", kein "noch Z g" | Hero um "noch Z g Eiweiß" erweitern, Eiweiß gleichwertig zu kcal | M |
| PM-02 / COA-05 | Mahlzeiten zeigen nur Anzahl und kcal | Protein je Mahlzeit anzeigen; Inhalte oder Doppeln/Löschen auf Heute | M |
| PM-03 / VIZ-01 | Sechs Ringe gleichwertig, Ring wird rot bei Überschreitung (bei Eiweiß unpassend) | Eiweiß und kcal groß, Rest klein; `warnAbove` nur für kcal/Zucker | M |
| VIZ-08 | Makro-Verteilung in % der kcal fehlt | Aus vorhandenen Werten berechnen | S |
| VIZ-06 | Drill zeigt "Anteil am Tag" statt am Ziel | Label klären, Anteil am Ziel zeigen | S |
| COA-04 / COA-06 / COA-08 | Keine Favoriten, leerer Zustand ohne Hinweis, "kcal übrig, was passt?" ohne Protein | Favoriten, Hinweis im Sheet, Fastfood-Hinweis mit Restprotein | M |
| FDB-05 | Suchtreffer zeigen Protein nicht | Protein pro 100 g in der Zeile | S |
| NUT-07 | Protein-Mindestwert je Mahlzeit bei 50 g gedeckelt | Cap an E3 koppeln | S |
| VIZ-07, VIZ-09 | Ring-Labels bei 320 px, "was passt" bei Vergangenheit | Layout prüfen, Zeile ausblenden | S |

### T3. Verlauf und Auswertung (Feature-Lücke)
Pflichtstandard bei allen Vergleichs-Apps. Reihenfolge: Gewicht, dann Auswertung, dann adaptives Ziel.

| ID | Inhalt | Aufw. |
|----|--------|-------|
| COA-01 / VIZ-04 / CMP-01 / PM-04 | Gewichtsverlauf (Log, Diagramm) | M |
| COA-03 / VIZ-03 / CMP-03 / VIZ-05 | Wochen-/Monatsansicht, 7-Tage-Mittel, "Tage im Ziel", Serie | M bis L |
| CMP-02 / NUT-06 | Ziel passt sich Gewichtstrend und Ist-Aufnahme an (MacroFactor-Prinzip); Hinweis, dass das Ziel nach Gewichtsänderung neu gerechnet werden sollte | L |
| CMP-04 | Apple Health / Health Connect, zuerst nur Schreiben | L |

### T4. Ernährungsberechnung und Verantwortung
Hängt an den Entscheidungen E3 und E4.

| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| NUT-01 | 120 kg Abnehmen ergibt 216 g Eiweiß (44 % der kcal) | Obergrenze plus Referenzgewicht | S |
| NUT-02 | 27 % Fett unter DGE-Richtwert (30 bis 40 %) | Auf 30 % anheben oder begründen | S |
| NUT-03 | Mindestzufuhr hebt auch das Halte-Ziel an | Nur für Abnehmen | S |
| NUT-04 | 0,75 kg/Woche absolut, bei 60 kg 1,25 % | Relativ begrenzen | S |
| NUT-05 / NUT-08 | Erwachsenenformeln ab 14 Jahren ohne Hinweis; keine BMI-Plausibilisierung; veralteter Kommentar zu `computeTargets` | Hinweis, Plausibilitätsgrenzen, Kommentar und Worker-Route entfernen | S |
| DSG-06 | Medizin-Disclaimer nur im Einstellungs-Modal | Kurzhinweis am Zielbereich | S |
| ONB-05 | Text nennt nicht, dass es eine Schätzformel ist | Text ergänzen | S |

### T5. Einkauf und Wochenplan
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| QAS-01 | Ohne KI kein `manual:false`, Altbestände sammeln sich an | Flag setzen | S |
| QAS-02 | Abgehakte/manuelle Position behält alte Menge, neuer Bedarf geht verloren | Neue Menge übernehmen oder Differenz zeigen | M |
| QAS-03 | g/kg, ml/l, Stk/Stück getrennt; `canonicalUnitKey` ungenutzt | Normalisieren vor dem Merge | M |
| QAS-04 | Mehrere manuelle Positionen gleichen Namens werden auf eine reduziert | Mengen addieren | S |
| QAS-05 / QAS-06 / QAS-08 / QAS-09 | Teilwort-Matching (Zwiebelpulver), zwei Gewichtstabellen, falsche Kategorien, "stk"/"Stk" | Wortgrenzen, eine Tabelle, Kategorieregeln, Anzeige vereinheitlichen | M |
| QAS-07 | Suche auf 20 Treffer begrenzt, bei 14 Tagen eng? | Gegen Live-Suche prüfen | S |
| QAS-10 | `ShoppingStore.generate` ohne Aufrufer, ersetzt Liste inkl. Abgehaktem | Entfernen | S |
| STA-01 | Lebensmittelsuche ohne Timeout | `timeout()` | S |
| STA-02 / STA-03 / STA-06 | Wochenplan ohne Fortschritt, Abbruch, Teilergebnis, Restpunkte | Fortschritt, Abbruch, Teilplan behalten, Quota anzeigen | M |
| PM-08 | Bei erschöpftem Kontingent gar kein Plan | Fallback "Aus meinen Rezepten planen" anbieten | S |
| UXL-02 / UXL-03 | Segment heißt "Rezepte", zeigt aber Wochenplan; Ablauf unklar | In "Wochenplan" umbenennen, Zustandsleiste Plan, Rezepte, Liste | M |
| RSP-08 | Englische Titel ("main course 2") im Plan | Titel säubern | S |
| CMP-07 | Open-Prices nicht in der Einkaufsliste | Anbinden | M |

### T6. Lebensmitteldaten und Scanner
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| FDB-01 | Fehlende Makros werden 0 | `null`, Anzeige "–", Summen ohne | M |
| FDB-03 | Kamera bleibt nach "nicht gefunden" aus; Produkte ohne kcal heißen "nicht gefunden" | Scanner neu starten, Meldungen trennen | S |
| FDB-04 | KI-Schätzungen/Teilwerte werden als Lebensmittel gespeichert, Überschreiben still | Nur ohne `isEstimate`/`isPartial` speichern, bei Konflikt fragen | S |
| FDB-06 / FDB-07 / FDB-08 | Teilstring-Ranking, Dedupe ohne Barcode, `product_name_de` fehlt | Wortanfang, Barcode in Dedupe, Feld anfragen (gegen API prüfen) | S |
| CMP-05 | Nur Open Food Facts | Basisdaten (z. B. BLS) später | L |
| STA-05 | "Keine Vorschläge im Budget" auch nach Fehler | Fehlerzustand trennen | S |

### T7. KI-Qualität
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| KIX-01 | Worker ohne `temperature 0` | Setzen | S |
| KIX-02 | Etikett: immer per100g, Modell rechnet selbst um | Basis mitgeben, Atwater-/Makro-Summenprüfung | M |
| KIX-03 | Rezept-Prompt widerspricht sich, erfindet Nährwerte | Prompt klären, Schätzung kennzeichnen | M |
| KIX-04 | Direktpfad erfindet bei URL-Import (kein Seiteninhalt) | Seitentext mitgeben oder URL-Import nur über Worker | S |
| CMP-06 | URL-Import braucht KI | JSON-LD-Parser ohne KI | M |
| KIX-05 / STA-04 | Leere/Nicht-JSON-Antwort wird HTTP 500 "überlastet"; falscher Fehler bei Fallback | Fehlerklassen trennen, letzten Fehler zeigen | S |
| KIX-06 / KIX-07 / KIX-08 / KIX-09 / KIX-10 | Weg unsichtbar, Prompt Injection, kein `responseSchema`, `estTotal` vom Modell, keine Fehlerfalltests | Jeweils kleine Härtung; Testset für Etiketten und Rezepte | S bis M |

### T8. Worker, Kosten, Missbrauchsschutz
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| WRK-01 / SEC-02 | Nur 20 Anfragen/IP/Min, kein Tageslimit | Globaler Tageszähler (Durable Object), harter Deckel | M |
| WRK-02 | Ohne `AI_LIMITER` läuft der Worker ohne Limit, /health zeigt es nicht | `hasRateLimiter` in /health, fail-closed | S |
| WRK-03 | Spoonacular nicht gecacht, 50 Punkte/Tag geteilt | `caches.default` (6 bis 24 h), Quota speichern | M |
| WRK-04 | Kein `maxOutputTokens`; `computeTargets` läuft über KI | Limit setzen, lokal berechnen, Route entfernen | S |
| FDB-02 / WRK-07 | `/off-search` ohne Rate-Limit | Limiter pro IP | S |
| WRK-05 / WRK-06 / WRK-08 / WRK-09 | Keine Kostenmessung, 429-Fallback wirkungslos?, nur IP als Nutzerkennung, 9-MB-Fotos | Strukturiertes Log, 429 sofort 503, Install-ID, Fotos verkleinern | S bis M |

### T9. Sicherheit
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| SEC-01 | Backup-Import übernimmt `endpoint`/`proxyUrl`/`baseUrl`; lokaler Key geht an fremden Host | Beim Import verwerfen oder Allowlist | S |
| SEC-03 | Keine CSP | Meta-CSP mit `connect-src` auf Worker, Gemini, Spoonacular, OFF | S |
| SEC-04 / SEC-05 / SEC-08 | Interne Fehlertexte an Client; SSRF ("localhost.", Ports, DNS-Rebinding); Freitext in Prompts, Body ungedeckelt | Generische Meldungen, Trailing-Dot und Ports, Längenprüfung | S |
| SEC-06 / SEC-07 / SEC-09 | Keys im Klartext (localStorage), `zod`/Router-Advisories, Bilder von Drittservern | Secure Storage nativ, `npm audit fix`, optional Bild-Proxy | S bis M |

### T10. Datenschutz und Recht
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| DSG-01 | Spoonacular fehlt in der Datenschutzerklärung | Ergänzen | S |
| DSG-02 | Gemini-Tarif, Nutzung unbezahlter Eingaben, Speicherdauern fehlen | Billing aktivieren, Text ergänzen | S bis M |
| DSG-03 | Gewicht/Größe/Alter per Worker-Route an Gemini möglich | Route entfernen (siehe WRK-04) | S |
| DSG-04 | Privacy Labels "nicht erhoben" wären falsch | Vor Store-Einreichung korrekt deklarieren | S |
| DSG-05 | Backup unverschlüsselt, Web Share ohne Warnung | Warnhinweis, später Passphrase | S bis M |
| DSG-07 / DSG-08 / DSG-09 / DSG-10 | Open-Prices-Quelle/Lizenz, Spoonacular-Terms, Impressum, EXIF beim Rezeptfoto | Prüfen und ergänzen | S |

### T11. Release und Betrieb
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| REL-01 (Blocker) | iOS-Signing und CI fehlen | Team-ID, Codemagic oder fastlane | M |
| REL-02 | Pages-Build und Capacitor teilen `www/` | Eigenen Output-Pfad | S |
| REL-03 | Version dreifach hart codiert | Eine Quelle, Build-Nummer automatisch | S |
| REL-04 / REL-05 | Push auf main geht ungeprüft live; weekly-recipes wartet | Tests als Pflicht vor Deploy, Tags, Rollback-Notiz | S bis M |
| REL-06 | Keine Tests und kein Lint in CI | CI-Job mit Unit- und Worker-Tests | M |
| REL-07 | Kein Crash-Monitoring | `ErrorHandler`, Sentry oder Crashlytics | M |
| REL-08 / REL-09 / REL-10 | Export-Compliance, Privacy-Manifest, Android-Signing, veraltete Doku | Info.plist-Schlüssel, Manifest, später | S bis M |

### T12. Performance
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| PRF-01 | Tesseract-Worker pro Scan neu (4,3 MB) | Lazy Singleton mit Idle-Timeout | M |
| PRF-02 | 11,7 MB Core-Varianten in jedem Build | Nur benötigte Variante (nach Gerätetest) | S |
| PRF-03 / PRF-04 | zxing statisch im SharedModule; alle Tabs vorgeladen | Dynamic Import; eigene PreloadingStrategy | M / S |
| PRF-05 / PRF-06 | Budget zu lax; kein Service Worker/Manifest | Budget 800 kB / 1 MB; PWA nur falls Web relevant | S / M |
| PRF-07..10 | Foto in voller Auflösung, Bilder ohne Maße, localStorage-Schreiben, Methoden im Template | Kleinere Verbesserungen | S bis M |

### T13. Navigation, Begriffe, Text
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| UXL-01 | Doku sagt 6 Tabs, Code 5 | Doku korrigieren (E1) | S |
| UXL-02 / TXT-01 / TXT-02 / TXT-03 | Begriffe uneinheitlich | Glossar (E2), dann durch UI ziehen; e2e-Selektoren prüfen | M |
| UXL-04 / UXL-05 / UXL-06 / UXL-07 / UXL-08 | Vier Erfassungswege, Kopfzeilen-Aktion wechselt, Zutatenformular, Profil überladen, Titel "Rückblick" | Je kleine Bereinigung | S bis M |
| TXT-04..09, STA-09 | Interpunktion, "…" mit Leerzeichen, "Ergibt … Portionen" für Screenreader, HTTP-Codes im Text, "E" für Eiweiß, Name/Titel | Textpass | S |
| ONB-01 / ONB-02 / ONB-03 / ONB-04 | Ohne Profil nur ein Button; Vorbelegungen nicht als Entscheidung; Rücksprung nach Speichern fehlt; Aha-Moment spät | Einstieg überarbeiten | M |

### T14. UI, Design-System, Theming
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| IOS-01 / MUX-01 / UID-08 | Toast verdeckt Primärbutton und Quellenangabe in Sheets | Toast in Sheets oben oder mit Abstand | S |
| UID-01 / IOS-05 | Sheet-Titel nicht mittig, Köpfe uneinheitlich | Einheitlich über `.nt-sheet-header` | S |
| MUX-02 | "Speichern" oben rechts, weit vom Daumen | Primäraktion in Footer (einheitlich) | M |
| UID-02 / THM-09 | Farbe ohne feste Bedeutung | Eiweißfarbe (E6) | S |
| UID-03 / MUX-06 / A11-02 / DSY-01 | Label "Name" hellgrün, ca. 2:1, zwei Platzhalterfarben | Auf Token mit mind. 4,5:1 | S |
| UID-04..09 / DSY-02..09 | Maße der Zeilen/Stepper, drei Pfeilstile, Auswahl ohne Sheet-Stil, "gespeichert" wie aktive Aktion, Schriftgrößen außerhalb der Skala, doppelte Klassen, ungenutzte Tokens | Aufräumen gegen DESIGN.md | M |
| THM-01 / THM-02 / THM-03 | `--ion-color-warning` undefiniert; Statusleiste alte Palette; Kopien mit alter Palette | Token definieren, Meta-Farbe, Kopien prüfen | S |
| THM-05 / THM-06 / THM-07 / THM-08 | Grauton unter 4,5:1; Warnton ähnelt Fett-Token; Literale statt Tokens | Tokenisieren | S bis M |
| IOS-03 / IOS-04 | Statische Großtitel, "Hinzufügen" je Tab anders | `ion-title size="large"`, einheitliche Kopfaktion | M |
| IOS-06 / IOS-07 / IOS-08 / IOS-09 / IOS-10 | Profil-Auswahl als Liste, Button in Zeile verschachtelt, Zahnrad statt Person, kein Vollswipe, StatusBar/Keyboard ungenutzt | ActionSheet, Optionen verlagern, Icon tauschen, Plugins nutzen | S |

### T15. Interaktion, Haptik, Barrierefreiheit, Responsive
| ID | Problem | Vorschlag | Aufw. |
|----|---------|-----------|-------|
| IOS-02 / IXD-01 | Haptik über `navigator.vibrate` (iOS: nichts) | `@capacitor/haptics` bei nativer Plattform | S |
| IXD-03 | Löschen auf Touch nur per Wischen | Sichtbare Alternative | S |
| IXD-04..08 | Toast vs. Tab-Bar, "Bewegung reduzieren" nur beim Start, Zeile verschwindet vor Toast, fehlende Belege, Abhaken ohne Feedback | Je kleine Korrektur | S |
| A11-01 | Feste px-Schriftgrößen, kein Dynamic Type | rem/Skalierung | M bis L |
| A11-03..06 | Abgekürzte Labels vs. `aria-label`, Shadow-DOM-Animationen, Toast als Live-Region?, Lösch-Icons nur bei Hover | Einzeln prüfen | S |
| MUX-03 / MUX-04 / MUX-05 / MUX-07 / MUX-08 | Reiter 40 statt 44 px, Footer ohne Safe-Area, Fokus öffnet Tastatur sofort, Dreieck statt Chevron, zwei Griffmuster | Einzeln beheben | S |
| FRM-01 / FRM-02 / FRM-04..06 | Nur Stepper, Fehler nicht am Feld, `inputmode`, `updateOn: blur`, Stepper-Grenzen | Textfeld zusätzlich, Inline-Fehler | M |
| RSP-01..07 | Meta-Zeile bricht, nur 375 px belegt, 5 Tabs auf 320 px, Safe-Area links/rechts, Sheet-Höhe im Querformat, Spacer, Ellipse | Screenshots bei 320/768/Querformat, einzeln beheben | S bis M |

---

## 3. Offene Konflikte zwischen Rollen (hier wäre Runde 2 sinnvoll)

1. **Speichern oben oder unten** (MUX-02 gegen IOS-05): iOS-Konvention "Abbrechen links, Sichern rechts" gegen Daumenzone. Vorschlag: Aktion im Footer, Kopf nur Titel und Schließen.
2. **Hinzufügen** (IOS-04 gegen UXL-05): Kopf rechts gegen Pille im Inhalt. Vorschlag: eine Kopfaktion je Tab, Pille nur auf Heute.
3. **Protein-Farbe** (UID-02 gegen THM-09): Violett einführen gegen Akzent-Teal behalten.
4. **Dark Mode** (THM-04 gegen DSY-06): Tokens vorbereiten gegen weglassen.
5. **Wochenplan ohne Kontingent** (PM-08 gegen STA-02): Fallback gegen Fehlermeldung mit Rest-Anzeige. Vorschlag: beides.
6. **Scope vs. Fokus** (PM-06 gegen CMP): Feature-Breite begrenzen oder Pflicht-Features (Gewicht, Auswertung) ergänzen. Vorschlag: Gewicht und Auswertung vor weiteren Helfern.
7. **KI-Zugang** (WRK-04, DSG-03 gegen NUT-08): `computeTargets` komplett entfernen, nicht nur ungenutzt lassen.

---

## 4. Empfohlene Reihenfolge zum Einbauen

**Welle 1: Fehler und Datenverlust (klein, riskoarm)**
QAD-01, QAD-02, QAD-03..05, QAE-01..04, QAE-06/FRM-03, QAS-01..04, FDB-01, FDB-03, FDB-04, STA-01, SEC-01, IOS-01.
Danach `weekly-recipes` mergen (E10).

**Welle 2: Kosten und Missbrauch am Worker**
WRK-01 bis WRK-04, FDB-02, KIX-01, SEC-03/04, DSG-01. Bringt den Worker auf "öffentlich vertretbar".

**Welle 3: Kernprodukt Protein und Berechnung**
Entscheidungen E3, E4 treffen; dann PM-01..03, VIZ-01, VIZ-08, NUT-01..04, FDB-05.

**Welle 4: Begriffe, Navigation, Design-Einheitlichkeit**
Entscheidungen E1, E2, E6; dann TXT, UXL, UID, DSY, THM, MUX, IOS-03..08, A11-02.

**Welle 5: Neue Features**
Gewichtsverlauf, Wochen-/Monatsansicht, Favoriten (T3, COA-04), danach adaptives Ziel; Haptik (IOS-02).

**Welle 6: Store und Betrieb**
REL-01..09, DSG-02/04/05/09, Crash-Monitoring, CI mit Tests. Je nach Entscheidung E8 vorziehen oder streichen.

**Welle 7: Performance und Feinschliff**
PRF-01..04, Dynamic Type (A11-01), Responsive-Belege (RSP-02).

---

## 5. Was schon gut ist (nicht kaputt ändern)
- Lokal-first ohne Konto, ohne Analytics; Reset-Button vorhanden.
- Worker: Parameter-Whitelist, Key nur im Header, Retry mit Zeitbudget, SSRF-Grundschutz, ODbL-Quellenangabe.
- Zentrale Fehlerklassifizierung mit nächstem Schritt; Leerzustände mit Handlungsaufforderung.
- `recipe-import-normalize.ts`; Mock verweigert Foto- und Link-Import ehrlich.
- Sheets mit Detents und "Verwerfen?"-Abfrage; Swipe-Löschen mit Undo im Tagebuch.
- Safe-Area über `env()`, 44-px-Ziele, schwebende Tab-Bar passt zu "Sanft iOS".
- OCR-Bild auf 1600 px und Graustufen; OnPush, Signals, `track` in allen `@for`.
- Pages-Workflow, App-Icon, deutsche Berechtigungstexte, versionierte native Projekte.
- Protein-Ziel in g/kg mit ehrlichem Mindestzufuhr-Hinweis; Preise als "Nur eingetragene Preise" gekennzeichnet.

## 6. Dokumentation, die veraltet ist
- `PRODUCT.md`: "kein Backup/Export" (Code hat Export), "6 Tabs" (Code hat 5).
- `docs/TESTING.md`: verweist auf `src/app/home/`, das es nicht gibt.
- Kommentar in `openfoodfacts.mapping.spec.ts` (Zeilen 78 bis 86) und der Kommentar zu `computeTargets`.

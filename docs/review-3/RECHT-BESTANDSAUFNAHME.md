# Rechtliche Bestandsaufnahme NutriTrack

Stand: 2026-11-14. Erstellt durch Lesen des Codes und Recherche. Es wurde nichts geändert, deployt oder committet.

**Dies ist keine Rechtsberatung.** Ich bin kein Anwalt. Das Dokument ordnet Fakten und Fundstellen, damit eine Absicherung geplant werden kann. Für die Entscheidung "öffentlich ja/nein" (Szenario C) sollte eine Juristin oder ein Jurist mit Österreich-Bezug drüberschauen.

Kennzeichnung der Aussagen:
- **[Code]** im Code belegt, mit Datei:Zeile (Pfade relativ zu `projects/NutriTrack`).
- **[Quelle]** aus Quelle belegt, URL und Abrufdatum 2026-11-14 in Abschnitt "Quellen".
- **[Einschätzung]** meine Auslegung, unsicher.

Szenarien: **A** nur ich nutze die App. **B** Weitergabe an Freunde (TestFlight). **C** App Store öffentlich.

---

## Teil 1: Fakten aus dem Code

### 1a Datenflüsse

Alle Profil-, Tagebuch- und Rezeptdaten liegen lokal (`localStorage`), laut `settings.page.html:196`. Folgende Flüsse verlassen das Gerät. Die Worker-URL ist `https://nutritrack.baumgartner-jakob12.workers.dev` (`src/environments/environment.prod.ts:3,7`).

| Nr | Fluss | Wohin | Wann | Inhalt (Kategorien) | Beleg |
|----|-------|-------|------|---------------------|-------|
| F1 | Lebensmittelsuche | Gerät -> Worker -> `search.openfoodfacts.org` | bei jeder Textsuche | Suchbegriff (max. 200 Zeichen), IP beim Worker; Worker setzt User-Agent mit GitHub-Repo-URL | `worker.js:47-49,232-276`, `openfoodfacts.provider.ts` |
| F2 | Barcode | Gerät direkt -> `world.openfoodfacts.org/api/v3/product` | beim Scan | Barcode, IP (direkt vom Gerät) | `openfoodfacts.provider.ts:20` |
| F3 | Preise | Gerät direkt -> `prices.openfoodfacts.org` | nach Barcode | Barcode, IP | `open-prices.provider.ts:6` |
| F4 | Rezeptsuche, Wochenplan | Gerät -> Worker -> `api.spoonacular.com` | bei Online-Rezeptsuche | Suchbegriff, `diet` (z. B. vegan, glutenfrei, keto), `intolerances`, `excludeIngredients`, `maxCalories`, `minProtein`, Typ, Zeit; API-Key nur im Worker | `worker.js:62-84,286-359`, `spoonacular.query.ts` |
| F5 | KI-Funktionen | Gerät -> Worker -> `generativelanguage.googleapis.com` (Gemini) | wenn KI genutzt wird | siehe unten | `worker.js:126-133,363-386,789-822` |
| F6 | Rezept-Import per Link | Worker holt fremde Seite, gibt Text an Gemini | bei Link-Import | URL, Seitentext (max. 12.000 Zeichen) | `worker.js:642-698,904-918` |
| F7 | Bilder | Gerät lädt Rezeptbilder direkt vom Anbieter (Hotlinking) | bei Anzeige | IP an den Bild-Host (Spoonacular/Blogs) | `online-search.component.html:27,137`, `week-recipe-sheet.component.html:13`, CSP `img-src https:` in `index.html:11` |
| F8 | Web-Version | GitHub Pages | beim Laden | IP in GitHub-Logs | `.github/workflows/deploy-pages.yml:1-5`, `settings.page.html:201` |
| F9 | Backup, Einkaufsliste teilen | Teilen-Dialog des Betriebssystems, vom Nutzer ausgelöst | manuell | gesamter Datenbestand inkl. Profil | `backup.service.ts:139-152`, `shopping.page.ts:449` |

KI-Funktionen im Detail (`AI_FUNCTIONS`, `worker.js:126-133`):
- `recognizeLabel`: **Foto** eines Etiketts (max. ca. 3 MB, `worker.js:108-110`). Der Prompt ist reine Extraktion (`worker.js:843-861`).
- `importRecipe`: Foto, Link oder Text eines Rezepts (`worker.js:541-551,904-918`).
- `generateShoppingList`: Personenzahl, Tage, Mahlzeiten, Budget, Supermarkt, Rezepttitel (`worker.js:489-500,826-841`).
- `suggestFastfood`: Restaurant, **kcal-Restbudget**, Geldbudget, Kriterien (z. B. "viel Protein", "vegetarisch"), Land, Ausschlussliste (`worker.js:528-539,869-888`).
- `translateRecipe`, `translateSearchQuery`: Rezepttitel, Zutaten, Schritte, Suchbegriff (`worker.js:947-985`).
- Gewicht, Größe, Alter, Geschlecht und Ziel nehmen die Validatoren nicht entgegen. Es gibt keine solche Route (`worker.js:489-583`). Das stützt die Aussage in `settings.page.html:200`.

Art. 9 DSGVO (Gesundheitsdaten) **[Einschätzung]**: Gewicht, Größe, Alter, Ziel und Tagebuch sind Gesundheitsdaten im weiten Sinn, bleiben aber laut Code lokal. Berührt werden Art.-9-Kategorien dort, wo Merkmale das Gerät verlassen: `intolerances` (Unverträglichkeiten, Gesundheitsbezug) und `diet` (vegan/vegetarisch, ggf. Weltanschauung) gehen an Spoonacular (`worker.js:64-80`). Fotos von Etiketten sind meist unkritisch, Fotos mit Personen oder Standort-EXIF können personenbezogen sein.

Speicherung und Logging im Worker:
- **Rate-Limit:** Schlüssel ist die IP (`CF-Connecting-IP`), `worker.js:415-420`; 20 Anfragen je Minute (`wrangler.toml:5-12`). Wie lange Cloudflare diesen Schlüssel hält, ist im Code nicht ersichtlich **[offen]**.
- **Tageszähler (KV):** nur ein globaler Zähler je UTC-Tag (`cap:YYYY-MM-DD`), Ablauf nach 2 Tagen, keine IP, kein Gerätekennzeichen (`worker.js:96-97,434-448`). Deckel 500 (`wrangler.toml:31-32`).
- **Cache:** Suchtreffer 1 Stunde (`worker.js:91,268-273`), Rezeptsuche 6 Stunden (`worker.js:93,317-328`); Schlüssel ist die Ziel-URL, ohne IP.
- **Logs:** `console.error/warn` bei Fehlern (`worker.js:179,326,445,779,783`). Zeile 819 loggt die ersten 200 Zeichen einer KI-Antwort, die aus Nutzereingaben abgeleitet sein können. `wrangler.toml` hat keinen `[observability]`-Block. Ob Workers Logs im Dashboard aktiv sind, ist **nicht geprüft**.
- Es gibt keine Geräte- oder Install-ID im Client (Grep ohne Treffer auf `installId|deviceId|uuid|analytics`). Ein Install-ID-Vorschlag (WRK-08) steht nur in `docs/REVIEW-ERGEBNIS.md`.
- Die Server-zu-Server-Aufrufe zu Gemini und Spoonacular tragen die IP des Workers, nicht die des Nutzers. Beim Nutzer-IP-Kontakt bleiben Cloudflare (Worker), GitHub Pages sowie bei F2, F3, F7 die Zielserver. Die Datenschutzerklärung sagt bei F4 pauschal, "deine IP-Adresse" werde verarbeitet (`settings.page.html:199`) **[Einschätzung: ungenau]**.
- Der Worker ist ohne Anmeldung öffentlich: Wer keinen `Origin`-Header sendet, wird durchgelassen (`worker.js:149`, Kommentar `worker.js:29-33`). `/health` ist öffentlich (`worker.js:166-168`).
- `CapacitorHttp` ist aktiv (`capacitor.config.ts:6-11`): auf iOS laufen `fetch`-Aufrufe nativ ohne CORS.
- Tesseract-OCR (Etikett offline) und Barcode-Scan (zxing) laufen lokal (`label-ocr.service.ts:8-23`, `package.json`). Der KI-Weg wird gewählt, sobald `ai.isLive()` gilt, also immer in der Produktivversion (`food-sources.component.ts:149-155`).

### 1b Was die App dem Nutzer heute sagt

Alle Texte im Info-Modal `settings.page.html:164-225` (Anleitung, Datenschutzerklärung, Nutzungsbedingungen, Hilfe und Kontakt). Zitate verkürzt.

- Willkommen (`dashboard.page.html:10-11`): "Dein Tagesbedarf ist eine Schätzung nach Formel (Mifflin-St Jeor)." und "Deine Daten bleiben lokal auf diesem Gerät. KI-Funktionen sind optional."
- Datenschutz (`settings.page.html:195-202`): Verantwortlicher "Jakob Baumgartner" mit E-Mail; Rechtsgrundlage nur "Art. 6 Abs. 1 lit. b DSGVO" (Zeilen 197, 199); Cloudflare "als Auftragsverarbeiter, USA"; Gemini: "im kostenlosen Kontingent darf Google diese Eingaben ... zur Produktverbesserung nutzen"; "Gesundheitsdaten wie Gewicht oder Größe werden dabei nicht übertragen"; "KI-Ergebnisse ... können falsch sein — bitte prüfen" (Zeile 200); Beschwerde bei der DSB (Zeile 202).
- Nicht im Text: Art. 9 DSGVO und Einwilligung, Speicherdauer bei Google, Garantien für den USA-Transfer (DPF/SCC), Hotlinking von Bildern, Kamera/Fotos, Backup-Risiko, Spoonacular-Backlink.
- Nutzungsbedingungen (`settings.page.html:206-209`): "kein Medizinprodukt"; "Schätzwerte auf Basis anerkannter Formeln (Mifflin-St Jeor)"; Open Food Facts "(Lizenz: Open Database License, ODbL; Produktfotos: CC BY-SA)"; "Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig".
- Backup (`settings.page.html:118`): "Alle Daten liegen nur auf diesem Gerät. Exportiere regelmäßig ein Backup ..." Kein Warnhinweis zur fehlenden Verschlüsselung.
- Kennzeichnung KI: Badge "KI-Schätzung" (`add-entry-sheet.component.html:186`, `diary.page.html:96`, `fastfood-sheet.component.html:32`, `recipes.page.html:47,252,334,387`), "geschätzt" bei Rezeptgewicht (`recipes.page.html:267`).
- Filter-Hinweis (`diet-options.ts:41`): "Der Filter ist eine Hilfe und ersetzt nicht das Prüfen der Zutaten." Angezeigt nur im Profil-Sheet (`profile-sheet.component.html:178`).
- Quellenangaben: "Daten: Open Food Facts (ODbL)" unter Suchtreffern (`food-search.component.html:47`); "Rezepte von spoonacular.com" mit Link (`online-search.component.html:56,156`); "Quelle: <Blog>" mit Link in Suche und Wochenplan (`online-search.component.html:54`, `week-recipe-sheet.component.html:44-45`). Für Open Prices gibt es keine Quellenzeile außerhalb der Datenschutzerklärung (Grep `Open Prices` in `src/app/**/*.html`: nur `settings.page.html:198`).
- Keine Einwilligungsdialoge, kein Onboarding mit Zustimmung, keine Altersabfrage (Grep `Einwilligung|consent`: kein Treffer im Code). **Kein Impressum**; nur Name und E-Mail unter "Verantwortlich" und "Hilfe & Kontakt" (`settings.page.html:195,214`).
- Keine Lizenzübersicht der Bibliotheken in der App.
- `README.md` ist veraltet (nennt "Claude (Anthropic)" als Default-KI und Provider-Keys in den Einstellungen). Das widerspricht dem Code (Gemini über Worker, kein Nutzer-Key, `ai.service.ts:25-31`).

### 1c Gesundheitsbezug

- Formel: Mifflin-St Jeor (`nutrition-calc.service.ts:76-83`); Aktivitätsfaktoren 1,2 bis 1,9 (`:27-33`). Für "diverse" wird der Mittelwert der beiden Konstanten genommen (`:81-82`).
- Abnehmen: Defizit aus 7700 kcal/kg (`:15`), Tempo höchstens 1 % Körpergewicht pro Woche, Aufbau 0,5 % (`:18-21`). Mindestzufuhr beim Abnehmen: 1500 (m), 1200 (w), 1350 (d) kcal (`:36`); die Formel wird darauf angehoben (`:114-115,171-174`).
- Manuelles Ziel: 1000 bis 6000 kcal, Eiweiß 1,2 bis 2,4 g/kg (`manual-target.ts:4-7,36,44`). Hinweis ab 2,2 g/kg (`:10`).
- Eiweiß: 1,6 / 1,8 / 2,0 g/kg je Ziel, Deckel 2,2; ab BMI 30 Referenzgewicht (`nutrition-calc.service.ts:39-48,100-108`). Fett 30 %, Ballaststoffe 14 g/1000 kcal, Zucker 10 % (`:51-57`). Quellen sind nur als Kommentar genannt (DGE, WHO), nicht in der App.
- Hinweise (`profile-plausibility.ts:35-55`): unter 18 Jahren "nur eine grobe Orientierung - sprich bei Bedarf mit einer Ärztin oder einem Arzt"; BMI unter 18,5 **nur bei Ziel Abnehmen** Warnung; unplausibler BMI (unter 14, über 60). Keine Sperre für Minderjährige.
- Nicht vorhanden (Grep `schwanger|stillen|essstör|diabet|krank|erkrank` ohne Treffer): Hinweise zu Schwangerschaft, Stillzeit, Essstörungen, Erkrankungen. Ebenso keine Krankheitsversprechen im Code, was positiv ist.
- Fastfood-Helfer: KI nennt 3 Produkte mit Nährwert- und Preisschätzung, Prompt "Ernährungs-Coach" (`worker.js:869-888`). Restaurantliste mit 14 Namen: McDonald's, Burger King, KFC, Subway, Domino's, Pizza Hut, Vapiano, Nordsee, dean&david, L'Osteria, Five Guys, Taco Bell, Wienerwald, Le Burger (`fastfood-options.ts:17-20`).
- Unverträglichkeiten: feste Liste (Milch, Ei, Gluten, Erdnuss, Fisch, Schalentiere, Soja, Baumnüsse, Weizen, Sesam) und Ernährungsformen (`diet-options.ts:15-36`). Der Filter ist wortbasiert (Regeln mit Ausnahmen und Stämmen, `intolerance-filter.ts:5-30`, `intolerance-rules.ts`) und filtert zusätzlich zur Spoonacular-Abfrage. Heuristik, keine Zutatenprüfung am Produkt. Der KI-Fastfood-Helfer kennt keinen Unverträglichkeitsfilter (Payload ohne Profilfelder, `worker.js:528-539`).

### 1d Fremde Inhalte und Marken

- **Spoonacular:** Die App speichert beim Rezept-Speichern Titel, Zutaten (mit Nährwerten), Schritte, `sourceUrl` und `imageUrl` dauerhaft lokal (`spoonacular.mapper.ts:166-186`, `models/index.ts:124-125`, `week-plan-recipes.ts:14-15`). Bilder werden **gehotlinkt**, nicht kopiert. Die Quellenzeile steht in Suche und Wochenplan, in der Ansicht gespeicherter Rezepte habe ich keinen Quellen- oder Bildverweis gefunden (Grep `sourceUrl|imageUrl` in `src/app/recipes/`: nur `online-search`). Der Worker cached Antworten 6 Stunden (`worker.js:93`). Übersetzung der Rezepte läuft über Gemini (`worker.js:947-973`).
- **Link-Import (`fetchPublicPage`, `worker.js:642-664`):** Der Worker lädt jede öffentliche http(s)-Seite (max. 1 MB, 10 s, 3 Weiterleitungen), mit User-Agent `Mozilla/5.0 (compatible; NutriTrack/1.0; +GitHub-URL)` (`worker.js:50`). SSRF-Schutz: nur Ports 80/443, keine privaten/lokalen Adressen, keine IPv6-Literale, jede Weiterleitung neu geprüft (`worker.js:587-616`). **Keine robots.txt-Prüfung, keine Domain-Sperrliste.** Bevorzugt wird schema.org-JSON-LD, sonst Seitentext (`worker.js:681-698`). Das Ergebnis geht an Gemini; gespeichert wird das normalisierte Rezept mit `sourceUrl` als Quelle (`recipe-import-normalize.ts:63-75`).
- **TikTok:** Link wird als TikTok erkannt; Hinweis "die KI liest Titel und Beschreibung automatisch" (`recipes.page.html:420-433`). Es wird also serverseitig die TikTok-Seite abgerufen. Das Video selbst wird nicht ausgewertet.
- **Open Food Facts:** Nur Textfelder (Name, Marke, Nährwerte, Portionsgröße) werden abgefragt, **keine Produktbilder** (`openfoodfacts.provider.ts:21-28`, Feldliste ohne Bilder). Damit entfällt CC BY-SA für Bilder im heutigen Stand. Attribution nur wie in 1b. Eigene Lebensmittel und Tagebucheinträge können OFF-Werte lokal weiterführen (`customFoods`, `backup.ts:21`).
- **Bibliotheken** (`package.json`, `node_modules`): Produktivabhängigkeiten laut `package-lock.json`: MIT (42), Apache-2.0 (6), BSD-2-Clause, 0BSD, Unlicense/Apache. Tesseract.js und zxing sind Apache-2.0; Sprachdaten `@tesseract.js-data/*` MIT. Keine Lizenzübersicht in der App, keine eigenen Schriften (Schriften werden nicht von Google geladen, CSP `font-src 'self' data:`, `index.html:11`).
- **Welle-4-Entwurf** (`docs/review-3/WELLE-4-ENTWURF.md`): Teil B sieht fürs TikTok-Auslesen vor: (1) oEmbed-Beschreibung, (2) Worker lädt das Video selbst, vom Entwurf selbst als nicht empfohlen und AGB-widrig eingestuft, (3) Nutzer lädt gespeichertes Video hoch (Gewicht 5, 90 s, 20 MB), (4) Screenshots. Stufe 2 würde Videoinhalt an Gemini senden.

### 1e Native und Store

- `ios/App/App/Info.plist:71-76`: Kamera "NutriTrack nutzt die Kamera, um Lebensmittel-Etiketten zu scannen und Barcodes zu lesen."; Fotos lesen "... um Etiketten-Bilder für die Nährwert-Erkennung auszuwählen."; Fotos hinzufügen "NutriTrack speichert aufgenommene Etiketten-Fotos in deiner Fotobibliothek." Der letzte Text passt nicht zum Code: `Camera.getPhoto` ohne `saveToGallery` (`camera.service.ts:25-30`). Keiner der Texte nennt den Upload an Google.
- `ios/App/App/PrivacyInfo.xcprivacy`: kein Tracking, keine Tracking-Domains, `NSPrivacyCollectedDataTypes` leer, keine Required-Reason-APIs. Passt nicht zu den Flüssen F1 bis F6 (siehe `docs/STORE-PRIVACY.md`, dort selbst als offen markiert).
- Android: Berechtigungen `INTERNET` und `CAMERA` (`AndroidManifest.xml:40,43`). Kein Android-Workflow.
- Verteilung: `codemagic.yaml` baut bei Tags `v*` und lädt zu TestFlight hoch (`submit_to_testflight: true`, Zeile 58). `docs/RELEASE.md` beschreibt interne TestFlight-Tester und optional später den App Store (Entscheidung E8 in `docs/REVIEW-ERGEBNIS.md:22` offen). Daneben gibt es eine **öffentliche Web-Version**: GitHub-Pages-Deploy für `main` unter `https://jakobbaum.github.io/NutriTrack/` (`deploy-pages.yml:1-5`); ob Pages tatsächlich aktiv und das Repo öffentlich ist, ist **nicht geprüft**. Der Worker erlaubt diese Origin (`worker.js:53`).
- Worker: öffentlich nutzbar ohne Auth, CORS-Allowlist nur für Browser (`worker.js:52-60,147-152`); Kostenschutz sind Rate-Limit 20/min je IP und Tagesdeckel 500 (`wrangler.toml:5-12,31-32`). Foto-Aufrufe zählen doppelt (`worker.js:100,451-453`).

### 1f Sicherheit mit Rechtsbezug

- Secrets: Im aktuellen Dateibestand kein Gemini-/Spoonacular-Key gefunden (Grep nach `AIza` trifft nur gebündelte Tesseract-WASM-Dateien unter `dist/`, ein Fehlalarm; Keys sind Worker-Secrets, `worker.js:16-19`). `wrangler.toml:27-29` enthält die KV-Namespace-ID (Kennung, kein Secret). Git-Historie nicht geprüft; `docs/SECURITY-AUDIT.md` behauptet sie sei sauber.
- Backup: JSON-Datei mit gesamtem Bestand inkl. Profil, **unverschlüsselt**; Ausgabe über Web-Share oder Download (`backup.service.ts:139-166`). Kein Warnhinweis (DSG-05 offen).
- Fotos: `shrinkPhotoForUpload` gibt Bilder, die schon klein genug sind, unverändert zurück (`label-image.ts:60-83`, `factor >= 1`). Nur verkleinerte Bilder werden über Canvas neu kodiert. EXIF-Daten (Standort) können daher bei kleinen Fotos mitgehen **[Einschätzung]** (DSG-10).

---

## Teil 2: Recherche (Abrufdatum 2026-11-14)

**Spoonacular API Terms** [Quelle 1]
- Daten dürfen ohne schriftliche Erlaubnis nicht kopiert oder gespeichert werden; mit Erlaubnis Cache höchstens 1 Stunde; danach löschen. Ausnahme: Rezept-IDs, Titel und Bild-URLs dürfen dauerhaft gespeichert werden. Zutaten, Anleitung und Nährwerte dürfen nicht gespeichert werden.
- Quellenangabe: Ursprungsrezept mit Name und Link angeben. Backlink zu spoonacular nennen die Terms für kostenlose Sonderpläne (Hackathon, akademisch); Logo/Werbung kann Spoonacular einblenden.
- Kommerziell: Nutzung im eigenen Projekt erlaubt, kein Weiterverkauf, kein Konkurrenzprodukt. Free-Pläne beschreiben die Terms nur als Einladung für Hackathons und akademische Zwecke, Spoonacular kann Zugang jederzeit entziehen. Ob der übliche Gratis-Tarif (laut `docs/KI-WORKER.md:47` ca. 50 Punkte pro Tag) für eine öffentliche App reicht, steht in diesem Text nicht **[offen, Pricing-Seite nicht geprüft]**.
- Der Betreiber muss selbst Haftungshinweise zu Allergien, Kosten und Nährwerten anzeigen. Deutsches Recht, Gerichtsstand Dresden.
- **Befund [Einschätzung]:** Die lokale Speicherung ganzer Rezepte (Zutaten, Schritte, Nährwerte) und der 6-Stunden-Cache im Worker passen nicht zu den Terms (Speicherverbot außer IDs/Titel/Bild-URL, Cache 1 Stunde).

**Open Food Facts / Open Prices** [Quelle 2, Quelle 3]
- Datenbank unter ODbL, einzelne Datensätze unter DbCL, Bilder unter CC BY-SA. Details zu Namensnennung und Share-Alike verweist OFF auf sein Wiki; die konkreten ODbL-Pflichten habe ich dort **nicht abgerufen** (Zertifikatsfehler bei `support.openfoodfacts.org`). Aus allgemeinem Wissen **[Einschätzung]**: Quellenangabe und bei Weitergabe einer abgeleiteten Datenbank Share-Alike unter ODbL; bloße Anzeige in einer App mit Quellenangabe gilt üblicherweise als "Produced Work". Die App-Backups mit OFF-abgeleiteten Eigenlebensmitteln sind ein Randfall.
- OFF verlangt für Reuser einen User-Agent mit App-Name und Kontakt; der Worker setzt ihn (`worker.js:49`). Lizenz von Open Prices: **nicht abgerufen**.

**Google Gemini API Additional Terms** (Stand der abgerufenen Fassung: 23.03.2026) [Quelle 4]
- Wer API-Clients Nutzern im EWR, in der Schweiz oder im UK bereitstellt, darf nur **Paid Services** nutzen.
- Unbezahlte Dienste: Google darf Eingaben und Antworten zur Produktverbesserung nutzen, menschliche Prüfer können sie lesen; es steht dort, keine sensiblen oder personenbezogenen Informationen einzugeben. Bezahlt: kein Training, Datenverarbeitung unter dem Data Processing Addendum, begrenzte Protokollierung.
- Mindestalter 18; keine Clients anbieten, die sich an unter 18-Jährige richten oder von ihnen wahrscheinlich genutzt werden. Dienste sind für beruflichen/geschäftlichen Gebrauch, nicht für Verbraucher, formuliert.
- Keine klinische Nutzung, keine medizinische Beratung, keine Nutzung, die eine Medizinprodukt-Zulassung erfordert. Keine ausdrückliche Pflicht, KI-Nutzung offenzulegen oder Nutzereinwilligung einzuholen (Attribution nur, wenn Gesetz es verlangt).
- Tarif laut Code/Config: **nicht erkennbar** (der Key ist ein Worker-Secret). `docs/STORE-PRIVACY.md` und die Datenschutzerklärung (`settings.page.html:200`) gehen vom kostenlosen Kontingent aus; `docs/REVIEW-ERGEBNIS.md` E7 sieht "Billing erst mit Datenschutztext" vor. Modellnamen `gemini-3.6-flash` und `gemini-3.5-flash-lite` stehen in `worker.js:36-38` (nicht gegen die Google-Modellliste geprüft).

**Cloudflare Workers** [Quelle 5]
- Das Customer DPA (Version 6.4, April 2026) macht Cloudflare zum Auftragsverarbeiter, enthält EU-SCC (Module 2 und 3) und beruft sich zusätzlich auf das EU-US Data Privacy Framework; Sub-Processor-Liste. Er hängt an der Hauptvereinbarung (u. a. Self-Serve). Ob der Gratis-Plan darunter fällt und ob das DPA ohne Zutun gilt, nennt die Seite nicht **[offen, Cloudflare-Dashboard prüfen]**. Ob Workers Logs aktiv sind: nicht geprüft.

**DSGVO** (allgemeines Wissen, nur Art. 2 abgerufen [Quelle 6])
- Haushaltsausnahme Art. 2 Abs. 2 lit. c: gilt für rein persönliche Tätigkeit. **[Einschätzung]** Szenario A (nur ich) fällt voraussichtlich darunter. Sobald andere Personen die App nutzen und der Betreiber den Worker betreibt, über den ihre IP und Eingaben laufen, ist der Betreiber für diese Verarbeitung Verantwortlicher (der Worker ist ein Betreiber-Mittel); die Daten, die nur lokal bleiben, sind ein Grenzfall.
- Art. 9: Gesundheitsdaten brauchen in der Regel ausdrückliche Einwilligung (Abs. 2 lit. a). Art. 13: Informationspflichten (Zwecke, Rechtsgrundlagen, Empfänger, Drittlandtransfer, Speicherdauer). Die Rechtsgrundlage "Vertrag, Art. 6 Abs. 1 lit. b" für eine unentgeltliche App ist **[Einschätzung: fraglich]**; üblicher wäre Einwilligung oder berechtigtes Interesse.
- USA-Transfer: Das Gericht der EU wies die Klage gegen das DPF am 03.09.2025 ab (T-553/23); Berufung C-703/25 P ist laut der gefundenen Quellen anhängig, ein Hinweis auf ein Urteil war nicht überprüfbar [Quelle 7] **[Ausgang offen]**.
- Österreich, lokaler Speicher: § 165 Abs. 3 TKG 2021 nimmt Speicherung aus, die für den ausdrücklich gewünschten Dienst unbedingt erforderlich ist [Quelle 8, nur Suchauszug, Wortlaut nicht abgerufen]. Lokaler Speicher für Profil und Tagebuch ist **[Einschätzung]** dadurch gedeckt; ein Cookie-Banner ist ohne Tracking nicht nötig.

**Österreich: Offenlegung** [Quelle 9]
- WKO: § 5 ECG für kommerzielle Websites, § 14 UGB und § 63 GewO für Unternehmen, § 25 MedienG je nach Inhalt. Ob private, nicht-kommerzielle Seiten (oder Apps) pflichtig sind, sagt die Seite nicht; der Mindestinhalt für kleine Seiten ebenfalls nicht. `docs/RECHERCHE-FEATURES-RECHT.md` nennt Name, Wohnort und Gegenstand für kleine Websites (aus derselben WKO-Quelle, nicht erneut abgerufen). **[Einschätzung]** Für Szenario C und die öffentliche Web-Version sollte ein Impressum vorhanden sein.

**EU AI Act** [Quelle 10, Quelle 11]
- Art. 50 gilt seit 02.08.2026: Nutzer müssen erkennen, dass sie mit einer KI interagieren (Chatbots); Anbieter generativer Systeme müssen Ausgaben maschinenlesbar kennzeichnen; Betreiber müssen Deepfakes und KI-Texte zur öffentlichen Information kennzeichnen. Eine Suche nennt für die Kennzeichnungspflicht nach Art. 50 Abs. 2 eine Übergangsfrist bis 02.12.2026, nur für vor August 2026 am Markt befindliche Systeme; amtliche Veröffentlichung nicht geprüft.
- **[Einschätzung]** NutriTrack hat keinen Chat. Die KI liefert strukturierte Werte, die der Nutzer vor dem Eintragen prüft. Art. 50 trifft die App kaum; die bestehenden "KI-Schätzung"-Badges sind eine sinnvolle freiwillige Kennzeichnung.

**Medizinprodukt (MDR, MDCG 2019-11)** [Quelle 12]
- Maßgeblich ist die Zweckbestimmung des Herstellers (Kennzeichnung, Anleitung, Werbung). Wellness- und Lifestyle-Software ohne medizinischen Zweck ist kein Medizinprodukt; Aussagen wie Behandlung oder Management einer Krankheit würden es dazu machen. Das Primärdokument (PDF der EU-Kommission) war nicht abrufbar (HTTP 429); die Aussage stützt sich auf Sekundärquellen. **[Einschätzung]** Im Code keine Krankheitsbegriffe (siehe 1c); die ärztlichen Hinweise (Minderjährige, Untergewicht) sind unkritisch.

**Lebensmittelrecht (Health-Claims-VO 1924/2006, LMIV)**
- **Nicht recherchiert**, nur Einschätzung: Die Health-Claims-VO regelt Angaben in der Kommunikation über Lebensmittel durch Lebensmittelunternehmer; eine private Tracking-App ohne Produktwerbung fällt eher nicht darunter. Für den Unverträglichkeitsfilter ist die LMIV nur Hintergrund (Allergene sind auf der Packung maßgeblich); das Risiko ist Haftung bei falscher Sicherheit, nicht die LMIV selbst.

**Apple App Store Review Guidelines** [Quelle 13]
- 1.4.1: Medizinische Apps mit möglichen Fehlinformationen werden strenger geprüft; Genauigkeitsaussagen müssen belegt sein; Apps sollen an ärztlichen Rat erinnern.
- 5.1.1: Datenschutzerklärung als Link in App Store Connect **und** in der App; Angabe von Datenerhebung, Aufbewahrung, Löschung; Datensparsamkeit; Purpose-Strings müssen die Nutzung klar und vollständig beschreiben (5.1.1(ii)).
- 5.1.2: Vor Verwendung oder Weitergabe personenbezogener Daten Erlaubnis einholen; Weitergabe an Dritte, **ausdrücklich auch Dritt-KI**, offenlegen und ausdrücklich zustimmen lassen.
- 5.1.3: Gesundheits- und Fitnessdaten nicht für Werbung oder Data Mining weitergeben.
- 5.1.1(ix): in stark regulierten Bereichen (u. a. Gesundheitswesen) nur Einreichung durch eine juristische Person. **[Einschätzung: unklar, ob eine Ernährungs-App darunter fällt]**
- 2.1: Backend muss für die Prüfung erreichbar sein. Der Textabschnitt nach Zeichen 100.000 wurde nicht gelesen.
- Trader-Status für EU-Händler (Anschrift, Telefon, E-Mail öffentlich im Store): **nicht abgerufen**, aus allgemeinem Wissen als Pflicht bei Vertrieb in der EU bekannt; vor Szenario C prüfen.

**Markenrecht** [Quelle 14]
- Art. 14 UMV erlaubt die Nutzung fremder Marken zur Identifizierung oder zum Verweis auf Waren und Dienstleistungen des Markeninhabers, sofern der Gebrauch den lauteren Gepflogenheiten entspricht. Die Suche lieferte nichts speziell zu Restaurantnamen in Apps. **[Einschätzung]** Reine Namensnennung ohne Logos, ohne Herkunftsfunktion und ohne Anschein einer Verbindung ist üblicherweise tragbar; riskanter sind KI-Nährwertangaben, die wie offizielle Herstellerangaben wirken. Das Risiko steigt von A zu C. Anwaltliche Prüfung nötig.

**Urheberrecht** [Quelle 15, Quelle 16]
- Rezeptidee und Zutatenliste sind nach den gefundenen Quellen meist nicht geschützt; ausführlich formulierte Anleitungstexte können Schriftwerke sein; Fotos sind in der Regel als Lichtbilder geschützt. Die Quellen betreffen überwiegend Deutschland; **österreichische** Quellen zu Rezepten fand ich nicht. § 42 UrhG (Privatkopie) und die Text-und-Data-Mining-Schranke wurden **nicht gelesen** (RIS-Seite zu lang).
- TikTok: Nach den Nutzungsbedingungen (Stand Juli 2026) ist das Auslesen von Inhalten mit automatisierten Mitteln ohne Genehmigung untersagt (Abschnitt 4.5); Entwicklerbedingungen oder oEmbed-Regeln standen nicht auf der abgerufenen Seite [Quelle 15]. **[Einschätzung]** Der Worker ruft TikTok-Seiten serverseitig und automatisiert ab; das trifft den Betreiber des Abrufs, auch wenn der Nutzer den Link eingibt.

---

## Teil 3: Risikoliste

Skala: hoch / mittel / niedrig / entfällt, jeweils **[Einschätzung]**. A nur ich, B Freunde (TestFlight), C App Store.

| Nr | Befund | Beleg | A | B | C | Maßnahme in der App | Maßnahme außerhalb |
|----|--------|-------|---|---|---|---------------------|--------------------|
| R1 | Gemini im EWR nur mit Paid Services; Tarif unbekannt, Doku geht von Gratis aus | `worker.js:36-38`, Quelle 4, `settings.page.html:200` | niedrig | hoch | hoch | Datenschutztext an Tarif anpassen; KI-Funktionen bis zur Freigabe abschaltbar (Flag) | Billing im Google-Cloud-Projekt aktivieren, Quota und Budgetalarm setzen, DPA prüfen |
| R2 | Kein Einwilligungsdialog vor Versand an Dritt-KI; Etikett-Foto geht bei aktiver KI automatisch an Gemini | `food-sources.component.ts:149-155`, Apple 5.1.2 | niedrig | mittel | hoch | Einwilligung beim ersten KI-Foto/KI-Aufruf (Empfänger Google, Inhalt, Widerruf unter Profil); Etikett-Scan optional "nur auf dem Gerät lesen" (OCR vorhanden) | Datenschutzerklärung als öffentliche URL |
| R3 | Unverträglichkeiten und Diät (Art. 9) gehen an Spoonacular, Rechtsgrundlage nur Art. 6 lit. b | `worker.js:64-80`, `settings.page.html:199` | entfällt | mittel | hoch | Einwilligung vor der ersten Online-Suche mit Profilfiltern; Schalter "Profilfilter nicht senden, lokal filtern" (lokaler Filter existiert, `intolerance-filter.ts`) | Anwalt: Rechtsgrundlage |
| R4 | Spoonacular: Speicherung ganzer Rezepte und 6-h-Cache gegen Terms (nur IDs/Titel/Bild-URL, Cache 1 h) | `worker.js:93`, `spoonacular.mapper.ts:166-186`, Quelle 1 | niedrig | mittel | hoch | Cache auf höchstens 1 h; Online-Rezepte nur als ID/Titel/Bild-URL merken und beim Öffnen neu laden, oder Speichern auf eigene Rezepte beschränken | Spoonacular-Plan und schriftliche Erlaubnis klären |
| R5 | Spoonacular-Gratis-Tarif für öffentliche/kommerzielle Nutzung unklar; Quota ca. 50 Punkte/Tag für alle geteilt | `docs/KI-WORKER.md:47`, Quelle 1 | niedrig | mittel | hoch | Quota-Hinweis bei Limit (vorhanden); Online-Suche abschaltbar | Bezahlplan oder Verzicht, Terms-Abgleich |
| R6 | Quellenangabe fehlt im gespeicherten Rezept; Spoonacular-Hinweis nur in der Suche | `online-search.component.html:54-56`, Grep `sourceUrl` in `recipes/` | entfällt | niedrig | mittel | Quelle (Name, Link) und "Rezepte von spoonacular.com" auch in der Rezeptansicht | |
| R7 | OFF-Attribution nur unter Suchtreffern; Open Prices ohne Quellenzeile; Share-Alike-Randfall bei Backup | `food-search.component.html:47`, Grep Open Prices | niedrig | niedrig | mittel | Abschnitt "Quellen und Lizenzen" (OFF/ODbL, Open Prices, Spoonacular, Bibliotheken); Attribution auch bei Barcode- und Preisanzeige | OFF-Lizenzseite und Open-Prices-Lizenz lesen (reuse@openfoodfacts.org laut Quelle 3) |
| R8 | Datenschutzerklärung lückenhaft: kein Art. 9, nur Art. 6 lit. b, IP-Aussage ungenau, Hotlinking, USA-Garantien, Speicherdauer Google, Kamera/Fotos, Backup | `settings.page.html:195-202` | niedrig | mittel | hoch | Text überarbeiten (je Fluss F1 bis F9 Zweck, Grundlage, Empfänger, Dauer); auch als Web-Seite | Anwalt prüfen lassen |
| R9 | Kein Impressum; Betreiber nur mit Name und Gmail | `settings.page.html:195,214` | entfällt | niedrig | hoch | Abschnitt "Impressum" in der App und auf der Pages-Seite | Adresse klären (Postfach, Impressumsservice, Gewerbestatus), Apple-Trader-Angaben |
| R10 | Medizin-Disclaimer nur im Einstellungs-Modal; Altershinweis nur im Formular | `settings.page.html:206`, `profile-plausibility.ts:35-41`, DSG-06 | niedrig | niedrig | mittel | Kurzhinweis am Zielbereich und im Willkommen-Text: "Orientierung, kein Ersatz für ärztlichen Rat" (Apple 1.4.1) | |
| R11 | Keine Altersgrenze; Gemini verlangt 18+, keine Clients für Minderjährige | `profile-plausibility.ts:35-41`, Quelle 4 | niedrig | mittel | hoch | Altersbestätigung (18+) im Onboarding; bei Alter unter 18 Ziel Abnehmen, KI und Online-Funktionen sperren | Store-Altersfreigabe, Nutzungsbedingungen (ab 18) |
| R12 | Kein Hinweis auf Schwangerschaft, Stillzeit, Erkrankungen, Essstörungen; Untergewicht nur bei Ziel Abnehmen; manuell ab 1000 kcal erlaubt | `profile-plausibility.ts:43-55`, `manual-target.ts:4` | niedrig | mittel | mittel | Satz im Profil: "nicht für Schwangere, Stillende, Kinder, Erkrankte oder bei Essstörung"; Warnung bei manuellem Ziel unter Mindestzufuhr (`minimumKcal` existiert, `nutrition-calc.service.ts:181`) | |
| R13 | Allergenfilter ist Heuristik; Hinweis nur im Profil-Sheet; KI-Fastfood ohne Unverträglichkeitsprüfung; Haftungsausschluss nur für leichte Fahrlässigkeit | `diet-options.ts:41`, `profile-sheet.component.html:178`, `worker.js:528-539`, `settings.page.html:209` | niedrig | mittel | hoch | Hinweis "Filter ist keine Allergiesicherung, Packung/Anbieter prüfen" direkt bei Online-Rezepten, Wochenplan und Fastfood-Vorschlägen; Fastfood: "Allergene beim Anbieter erfragen" | Anwalt: Wirksamkeit des Haftungsausschlusses gegenüber Verbrauchern |
| R14 | KI-Nährwerte und Preise zu Markenprodukten wirken wie Herstellerangaben | `worker.js:869-888`, `fastfood-sheet.component.html:32` | niedrig | niedrig | mittel | Hinweis "Schätzung, keine Angaben des Restaurants"; Badge beibehalten | |
| R15 | Restaurantnamen (14 Marken) | `fastfood-options.ts:17-20` | entfällt | niedrig | niedrig-mittel | Satz "Marken gehören ihren Inhabern, keine Verbindung"; keine Logos; Liste zentral, schnell entfernbar | Markenrecherche/Anwalt bei Szenario C |
| R16 | Link-Import: Worker holt fremde Seiten automatisiert, ohne robots.txt-Prüfung, tarnender User-Agent; TikTok-AGB gegen Auslesen | `worker.js:50,642-664`, `recipes.page.html:420-433`, Quelle 15 | niedrig | niedrig-mittel | mittel-hoch | robots.txt prüfen oder Sperrliste (TikTok); nur JSON-LD-Rezeptdaten, keinen Volltext speichern; Quelle immer speichern/anzeigen; Hinweis "nur für private Nutzung, Rechte beim Urheber"; Welle-4-Weg 2 nicht bauen | Anwalt zu Urheberrecht AT, TikTok-Bedingungen |
| R17 | Hotlinking von Bildern: IP geht an Bild-Host; Bild nicht kopiert | `online-search.component.html:27,137`, `index.html:11` | niedrig | niedrig | mittel | In Datenschutztext aufnehmen; Option "Bilder nicht laden" | |
| R18 | Backup unverschlüsselt, Teilen ohne Warnung | `backup.service.ts:139-152`, `settings.page.html:84-93`, DSG-05 | niedrig | niedrig-mittel | mittel | Warntext vor Export ("enthält Gesundheitsdaten, nur sicher speichern/teilen"); später Passphrase | |
| R19 | Worker offen: ohne Origin nutzbar, Missbrauch und Kosten; `/health` öffentlich | `worker.js:29-33,147-152,166`, `wrangler.toml:5-12,31-32` | niedrig | niedrig | mittel-hoch | Anfragen nur mit signiertem Token/App-Attest; `/health` ohne Details | Google-Key-Quota, Budgetalarm, Cloudflare-Limits |
| R20 | Worker-Logging: IP als Rate-Limit-Schlüssel; Log von KI-Antwort-Auszug; Observability unbekannt; DPA-Geltung unklar | `worker.js:415-420,779,783,819`, Quelle 5 | entfällt | niedrig | mittel | Log-Zeile 819 entfernen oder nur Länge loggen; Speicherdauer im Text nennen | Cloudflare-Dashboard: Logs aus, DPA akzeptieren/prüfen |
| R21 | EXIF/Standort in kleinen Fotos beim KI-Upload | `label-image.ts:60-83` | niedrig | niedrig | mittel | Fotos immer über Canvas neu kodieren, auch wenn klein | |
| R22 | Purpose-Strings: "speichert Fotos in der Fotobibliothek" stimmt nicht; Upload an Google nicht genannt | `Info.plist:71-76`, `camera.service.ts:25-30` | entfällt | niedrig | mittel | `NSPhotoLibraryAddUsageDescription` entfernen oder korrigieren; Kamera-Text um KI-Upload ergänzen | |
| R23 | Privacy Manifest und Nutrition Label leer, tatsächliche Flüsse anders | `PrivacyInfo.xcprivacy`, `docs/STORE-PRIVACY.md` | entfällt | niedrig | hoch | Manifest und App-Store-Connect-Angaben nach F1 bis F6 angleichen | App Store Connect ausfüllen |
| R24 | Medizinprodukt-Abgrenzung, Kategorie "Gesundheit & Fitness" | `settings.page.html:206`, Quelle 12 | niedrig | niedrig | niedrig-mittel | Keine Krankheitsbegriffe in Texten, Store-Beschreibung, Screenshots; Zweckbestimmung "Ernährungstagebuch" festhalten | Dokumentierte Qualifizierungsentscheidung |
| R25 | EU AI Act Art. 50 | `add-entry-sheet.component.html:186`, Quelle 10 | niedrig | niedrig | niedrig | KI-Badges beibehalten | Stand Omnibus beobachten |
| R26 | Bibliotheken ohne Lizenzübersicht (Apache-2.0 verlangt Lizenztext/NOTICE) | `package.json` | entfällt | niedrig | niedrig-mittel | Seite "Lizenzen" aus `package-lock.json` erzeugen | |
| R27 | USA-Transfer (Cloudflare, Google, GitHub): DPF-Berufung offen | Quelle 5, 7 | entfällt | niedrig | mittel | Im Text DPF/SCC als Grundlage nennen | Verträge/DPA der Anbieter sichern |
| R28 | Web-Version auf GitHub Pages ist bereits öffentlich erreichbar und nutzt den Worker | `deploy-pages.yml:1-5`, `worker.js:53` | (faktisch C-nah) | mittel | hoch | Impressum, Datenschutz und Einwilligungen auch für Web | Pages deaktivieren oder bewusst belassen |

---

## Offene Fragen an den Betreiber (max. 6)

1. Ist GitHub Pages aktiv (öffentliche Web-Version) und das Repo öffentlich? Soll das so bleiben?
2. Welches Szenario ist das Ziel und bis wann: nur eigenes Gerät, TestFlight für wie viele Personen (auch unter 18?), oder App Store?
3. Läuft der Gemini-Key im Paid Tier (Billing aktiv)? Welcher Spoonacular-Plan ist gebucht?
4. Bleibt die App dauerhaft unentgeltlich und werbefrei (wirkt auf § 5 ECG und Spoonacular-Bedingungen), oder sind Abo, Werbung oder Spenden geplant?
5. Welche Adresse darf im Impressum und im Store stehen (Wohnadresse, Postfach, Impressumsservice)? Gibt es ein Gewerbe?
6. Sollen KI und Online-Funktionen künftig standardmäßig aus sein und per Einwilligung aktiviert werden (Produktentscheidung, bestimmt Umfang von R2 und R3)?

## Nicht geprüft

- Cloudflare-Dashboard (Workers Logs, DPA-Annahme, Plan), Google-Cloud-Konsole (Tarif, Quota), Spoonacular-Pricing-Seite, GitHub-Einstellungen (Pages, Sichtbarkeit).
- Open-Food-Facts-Nutzungsbedingungen und ODbL-Wiki im Wortlaut (Zertifikatsfehler), Open-Prices-Lizenz.
- Health-Claims-VO und LMIV im Wortlaut; § 42 UrhG und TDM-Schranke (§ 42h) im Wortlaut; § 165 Abs. 3 TKG im Wortlaut; MDCG 2019-11 im Primärtext; Apple-Guidelines nach Zeichen 100.000 und Apples Trader-Regeln; Google-Play-Data-Safety.
- Ob der Ausgang der DPF-Berufung (C-703/25 P) schon vorliegt; ob das AI-Omnibus im Amtsblatt veröffentlicht ist.
- Git-Historie auf Secrets; `.wrangler/`-Ordner; alle UI-Texte außerhalb der genannten Dateien (z. B. Barcode-Treffer-Ansicht auf OFF-Attribution); Android-Projektdateien über das Manifest hinaus.
- Keine österreichische Rechtsprechung oder Literatur; keine anwaltliche Bewertung.

## Quellen (Abruf 2026-11-14)

1. Spoonacular API Terms: https://spoonacular.com/food-api/terms
2. Open Food Facts, Lizenz-Tutorial: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/
3. Open Food Facts, Support (nicht abrufbar, Zertifikatsfehler): https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api
4. Gemini API Additional Terms (Stand 23.03.2026): https://aistudio.google.com/docs/terms (Weiterleitung von https://ai.google.dev/gemini-api/terms)
5. Cloudflare Customer DPA v6.4: https://www.cloudflare.com/cloudflare-customer-dpa/
6. DSGVO Art. 2: https://gdpr-info.eu/art-2-gdpr/
7. DPF, Latombe, Suchergebnisse (u. a. WilmerHale 2025-12-01): https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
8. § 165 TKG 2021 (Suchauszug): https://gesetzefinden.at/bundesrecht/bundesgesetze/tkg-2021/para-165
9. WKO, Website-Impressum: https://www.wko.at/stmk/internetrecht/website-impressum
10. AI Act Art. 50: https://artificialintelligenceact.eu/article/50/
11. AI Omnibus, Übergangsfrist (Suchergebnisse): https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-article50-watermarking-deadline/ und https://www.williamfry.com/knowledge/eu-ai-act-omnibus-deal-reached-postponed-deadlines-watermarking-compromise-and-the-nudificiation-prohibition/
12. MDCG 2019-11, Sekundärquellen: https://openregulatory.com/mdcg/mdcg-2019-11 und https://www.sanolabs.eu/blog/wellness-app-vs-medical-device-eu-mdr/ (Primär-PDF https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_qualification_classification_software_en_0.pdf nicht abrufbar)
13. Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
14. Art. 14 UMV: https://gesetze.legal/eu/vo_eu_2017_1001/14
15. TikTok Nutzungsbedingungen (EWR, Stand Juli 2026): https://www.tiktok.com/legal/page/eea/terms-of-service/en
16. Urheberrecht Rezepte, Suchergebnisse: https://www.e-recht24.de/urheberrecht/8208-abmahnung-rezepte-kochbuch.html und https://www.dpma.de/service/schutzrechte_kurz_erklaert/urheberrecht/

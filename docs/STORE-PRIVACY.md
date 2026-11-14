# Store-Datenschutz (Privacy-Labels und Betreiberangaben)

Stand: 2026-11-14 (Abschnitt Apple überarbeitet; übrige Abschnitte Stand 2026-11-08). Grundlage: Code- und Textlektuere (Worker, `settings.page.html`, Datenschutzerklaerung in der App). Kein Rechtsrat. Vor der Einreichung muss Jakob die Angaben pruefen, besonders die Punkte mit **[Jakob pruefen]**.

Die Antwort "Daten nicht erhoben" waere falsch, weil Eingaben ueber den Worker an Dritte gehen (DSG-04).

## Wo welche Daten liegen
| Daten | Ort | Verlassen das Geraet? |
|-------|-----|-----------------------|
| Profil (Gewicht, Groesse, Alter, Ziel), Tagebuch, Rezepte, Einstellungen | lokal im WebView-Speicher (`localStorage`) | Nein. Nur ueber Backup-Export, den der Nutzer selbst ausloest |
| Tagesziel-Berechnung | lokal | Nein (`computeTargets` im Worker entfernt) |
| Etikett-OCR | lokal (Tesseract im Geraet) | Nein |
| Lebensmittelsuche (Suchbegriff, IP) | Worker (Cloudflare) -> Open Food Facts | Ja |
| Barcode-Abfrage, Preise | direkt an Open Food Facts / Open Prices | Ja (Barcode, IP) |
| Rezeptsuche und Wochenplan (Suchbegriff, Filter, ggf. Mindest-Eiweiss) | Worker -> Spoonacular | Ja |
| KI-Funktionen (Rezepttext/-link, Etikett-/Rezeptfoto, Einkaufs-/Fastfood-Wuensche, Restbudget kcal) | Worker -> Google Gemini | Ja, nur bei Nutzung |
| Hosting Web-App | GitHub Pages | Server-Logs mit IP |

Gewicht, Groesse und Alter gehen nicht an Gemini (Datenschutzerklaerung in der App sagt das; im Worker pruefen, dass keine Route sie annimmt, siehe DSG-03).

## Apple: App-Datenschutz ("Ernährungsetikett")

**Wichtig: Die folgende Einordnung ist ein Vorschlag auf Basis des Codes (Stand 2026-11-14), keine Rechtsberatung.** Der Betreiber trägt die Angaben selbst in App Store Connect ein und verantwortet sie. Quelle der Datenflüsse: `docs/review-3/RECHT-BESTANDSAUFNAHME.md`, Teil 1a.

**Tracking:** Nein (kein Tracking im Sinne von ATT, keine Werbe-SDKs, keine Analytics, keine Tracking-Domains).

### Was in App Store Connect anzugeben ist

Für jeden Datentyp: "Mit Identität verknüpft" = Nein, "Für Tracking verwendet" = Nein, Zweck = "App-Funktionalität".

| Apple-Datentyp | Welche Daten | Wann | Empfänger | Anmerkung |
|----------------|--------------|------|-----------|-----------|
| Fotos oder Videos | Foto eines Etiketts oder Rezepts | nur bei Nutzung der KI-Foto-Funktion | Google (Gemini) über den Worker | App kann Fotos auch lokal per OCR lesen; der KI-Weg ist in der Produktivversion der Standard, solange KI aktiv ist |
| Suchverlauf | Suchbegriffe der Lebensmittel- und Rezeptsuche | bei jeder Online-Suche | Worker (Cloudflare), Open Food Facts, Spoonacular | Der Verlauf wird nicht gespeichert, die Begriffe werden aber übertragen |
| Sonstige Nutzerinhalte | Rezepttext, Rezept-Link, Einkaufs- und Fastfood-Eingaben (Personenzahl, Budget, Kriterien, Restaurant, kcal-Restbudget) | bei Nutzung der KI-Funktionen und des Link-Imports | Google (Gemini), bei Link-Import zusätzlich die abgerufene Seite | |
| Gesundheit | Unverträglichkeiten und Ernährungsform (z. B. glutenfrei, vegan) als Suchfilter | bei Online-Rezeptsuche und Wochenplan | Worker, Spoonacular | Einordnung siehe unten |
| Kennungen (Geräte-ID, Nutzer-ID) | keine | | | App vergibt keine ID |
| Nutzungsdaten, Diagnose, Standort, Kontakte, Finanzen | keine | | | |

**Begründung der Einordnung "Gesundheit" statt nur "Sonstige Nutzerinhalte":** Unverträglichkeiten (Milch, Gluten, Erdnuss usw.) sind vom Nutzer angegebene gesundheitsbezogene Angaben und gehen an Spoonacular. Apples Kategorie "Gesundheit" umfasst auch nutzerseitig angegebene gesundheitsbezogene Daten. Die Deklaration von "Gesundheit" ist die vorsichtigere Variante; eine zu knappe Angabe birgt mehr Risiko (Nachfrage oder Ablehnung bei der Prüfung) als eine großzügige. Der Betreiber kann bewusst anders entscheiden. Gewicht, Größe, Alter, Geschlecht, Ziel und Tagebuch verlassen das Gerät laut Code nicht und fallen deshalb nicht darunter.

**Gesundheits- und Fitnessdaten (Profil, Tagebuch):** bleiben lokal, werden nicht erhoben. Das gilt nur, solange (a) keine Worker-Route sie annimmt, (b) das Backup nur vom Nutzer selbst geteilt wird und (c) kein Apple-Health-Zugriff dazukommt. Bei Änderung neu bewerten.

**IP-Adresse:** Sie fällt bei jedem Netzwerkaufruf technisch an (Cloudflare, GitHub Pages, bei Barcode-Scan, Preisabfrage und Rezeptbildern auch direkt bei Open Food Facts, Open Prices und den Bild-Hosts). Ob das als Datentyp "Kennungen" oder "Nutzungsdaten" anzugeben ist, hängt davon ab, ob Betreiber oder Dritte sie speichern. Das konnte aus dem Code nicht geklärt werden (siehe offene Punkte).

### Privacy Manifest im Repo

`ios/App/App/PrivacyInfo.xcprivacy` entspricht der Tabelle: `NSPrivacyTracking` false, keine Tracking-Domains, `NSPrivacyCollectedDataTypes` mit `PhotosorVideos`, `SearchHistory`, `OtherUserContent` und `Health` (je nicht verknüpft, nicht Tracking, Zweck App-Funktionalität). `NSPrivacyAccessedAPITypes` ist leer, weil die App selbst keine Required-Reason-APIs aufruft; die eingebundenen Capacitor-Pakete bringen ihre eigenen Manifeste mit. Vor der Einreichung im Xcode-Datenschutzbericht ("Privacy Report") gegenprüfen, ob zusammengeführt noch etwas fehlt. Wird die Tabelle in App Store Connect geändert, Manifest und Tabelle gleichziehen.

### Offene Punkte, die nur der Betreiber klären kann

- Gemini-Tarif: Im EWR laut Google-Bedingungen nur bezahlter Tarif. Welcher Tarif läuft, ist aus dem Code nicht erkennbar. Davon hängen Datenschutztext und die Angabe "für Training verwendet" ab.
- Spoonacular: Plan und ob die Nutzung (öffentliche App, lokale Speicherung von Rezepten) von den Bedingungen gedeckt ist.
- Werden Logs im Cloudflare-Dashboard (Workers Logs) aufgezeichnet, und wie lange hält Cloudflare den IP-Schlüssel des Rate-Limits? Davon hängt die Antwort zur IP-Adresse ab.
- Ist GitHub Pages aktiv und das Repository öffentlich? Dann ist die Web-Version schon öffentlich und der Worker von jedem nutzbar.
- Soll das Etikett-Foto weiterhin automatisch an Gemini gehen, oder nur nach Einwilligung bzw. mit lokaler OCR als Standard? Davon hängt die Angabe "nur bei Nutzung" ab.
- Öffentliche Datenschutz-URL, Support-URL und Betreiberangaben (siehe unten).
- Alterseinstufung und Kategorie ("Gesundheit & Fitness" oder "Ernährung"), Trader-Status für den EU-Vertrieb.

## Google Play: Data safety
Analog: "Daten werden mit Dritten geteilt" fuer Suchbegriffe/Nutzerinhalte und Fotos (nur KI-Funktion), "Daten sind verschluesselt bei der Uebertragung": Ja (HTTPS), "Nutzer koennen Loeschung verlangen": lokale Daten ueber "Alle lokalen Daten zuruecksetzen". Gesundheitsdaten nicht uebertragen. **[Jakob pruefen]**

## Offene Datenschutz-Punkte (Quelle: REVIEW-ERGEBNIS T10)
- DSG-02: Gemini-Tarif. Im kostenlosen Kontingent darf Google Eingaben zur Produktverbesserung nutzen (steht bereits in der App-Erklaerung). Bezahlter Tarif und Speicherdauern ergaenzen, sobald entschieden **[Jakob]**.
- DSG-05: Backup ist unverschluesselt; Warnhinweis vor dem Teilen fehlt noch (App-Code).
- DSG-07/08: Lizenz/Quelle Open Prices und Spoonacular-Nutzungsbedingungen pruefen **[Jakob]**.
- DSG-10: EXIF-Daten (Standort) im Rezeptfoto vor dem Upload entfernen (App-Code).

## Betreiberangaben und Impressum (DSG-09) **[Jakob]**
Fuer den oeffentlichen Store (und bei oeffentlicher Web-Version) braucht es Betreiberangaben. Diese darf nur Jakob liefern. Platzhalter, nichts davon ist erfunden oder bestaetigt:

| Feld | Wert |
|------|------|
| Name des Betreibers | Jakob Baumgartner (so steht es bereits in der Datenschutzerklaerung der App) |
| Ladungsfaehige Anschrift | **[Jakob: Strasse, PLZ, Ort, Land]** |
| E-Mail | baumgartner.jakob12@gmail.com (aus der Datenschutzerklaerung; **[Jakob: bestaetigen, ob oeffentlich gewollt]**) |
| Telefon (falls erforderlich) | **[Jakob]** |
| Unternehmensform / UID / Firmenbuchnummer / Gewerbe | **[Jakob: nur falls vorhanden, sonst "privat"]** |
| Aufsichtsbehoerde (falls erforderlich) | **[Jakob]** |
| Oeffentliche URL fuer Datenschutz | **[Jakob: z. B. eigene Seite]** |
| Support-URL | **[Jakob]** |

Ob und in welcher Form ein Impressum Pflicht ist (Oesterreich: E-Commerce-Gesetz, Mediengesetz), haengt von Jakobs Situation ab (privat oder gewerblich, kostenlos oder entgeltlich). Das ist rechtlich zu klaeren und nicht Sache dieser Doku. Der Datenschutzbehoerden-Hinweis in der App verweist auf die oesterreichische DSB.

# Store-Datenschutz (Privacy-Labels und Betreiberangaben)

Stand: 2026-11-08. Grundlage: Code- und Textlektuere (Worker, `settings.page.html`, Datenschutzerklaerung in der App). Kein Rechtsrat. Vor der Einreichung muss Jakob die Angaben pruefen, besonders die Punkte mit **[Jakob pruefen]**.

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

## Apple: App Privacy ("Ernaehrungsetikett")
Jakob traegt das in App Store Connect > App-Datenschutz ein. Vorschlag, passend zum Ist-Zustand:

**Tracking:** Nein (kein Tracking im Sinne von ATT, keine Werbe-SDKs, keine Analytics).

**Datentypen, die die App ueber Dritte verarbeitet** (nicht mit der Identitaet verknuepft, nicht fuer Tracking, Zweck "App-Funktionalitaet"):
| Apple-Kategorie | Welche Daten | Empfaenger | Hinweis |
|-----------------|--------------|------------|---------|
| Sonstige Nutzerinhalte | Suchbegriffe, Rezepttexte, Einkaufs-/Fastfood-Eingaben | Open Food Facts, Spoonacular, Google (Gemini) | |
| Fotos oder Videos | Etikett-/Rezeptfoto fuer KI-Funktion | Google (Gemini) | nur bei Nutzung der KI-Foto-Funktion |
| Geraete-ID / Nutzer-ID | keine | | App vergibt keine ID; **[Jakob pruefen]** ob eine Install-ID kommt (WRK-08) |
| Nutzungsdaten, Diagnose | keine eigene Erhebung | | IP-Adresse fliesst technisch in Anfragen (Cloudflare, Google, Spoonacular, OFF) |

**Gesundheits- und Fitnessdaten:** Gewicht, Groesse, Alter, Ziel und Tagebuch bleiben auf dem Geraet und werden vom Entwickler nicht erhoben. Apples Definition von "erheben" betrifft Daten, die das Geraet verlassen. Da sie nicht uebertragen werden, ist "Gesundheit & Fitness" nicht anzugeben. Das gilt nur, solange (a) keine Worker-Route sie annimmt, (b) Backup nur lokal geteilt wird und (c) kein Apple-Health-Zugriff (E9) dazukommt. Bei Aenderung neu bewerten. **[Jakob pruefen]**

Hinweis zur IP-Adresse: Sie wird bei jedem Netzwerkaufruf technisch uebertragen. Ob das als "erhobene Daten" (Kennungen/Nutzungsdaten) anzugeben ist, haengt davon ab, ob Betreiber oder Dritte sie speichern. Der Worker speichert laut Doku nichts personenbezogenes ausser fluechtigen Rate-Limit-Zaehlern. **[Jakob pruefen]**

## Privacy Manifest im Repo
`ios/App/App/PrivacyInfo.xcprivacy`: `NSPrivacyTracking=false`, keine Tracking-Domains, keine Required-Reason-APIs, `NSPrivacyCollectedDataTypes` leer. Der letzte Punkt muss mit den App-Store-Connect-Angaben oben konsistent gemacht werden. Wenn Jakob dort Datentypen deklariert, sollten dieselben auch ins Manifest (Eintraege `NSPrivacyCollectedDataType`, Zweck `NSPrivacyCollectedDataTypePurposeAppFunctionality`, `Linked=false`, `Tracking=false`).

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

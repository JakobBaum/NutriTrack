# Recherche: Features & Rechtliches — 2026-11-04

> Keine Rechtsberatung. Das hier ist eine strukturierte Recherche mit Quellen. Bevor die App öffentlich
> oder kommerziell vertrieben wird (App Store, Werbung, Abo), sollte ein*e Jurist*in drüberschauen.

## 1. Feature-Ideen (priorisiert)

Grundlage sind Vergleichsartikel 2026 zu MyFitnessPal, Cronometer, MacroFactor, Yazio und Lose It!
([Fitia-Vergleich](https://fitia.app/learn/article/best-daily-calorie-tracking-apps-2026/),
[BGR](https://www.bgr.com/2246095/best-food-apps-to-track-your-calories/)). Achtung: Viele dieser
Rankings stammen von Anbietern selbst. Sie sind gut genug, um zu sehen, was es am Markt gibt, aber
keine unabhängigen Nutzerstudien. Muster im Markt: MyFitnessPal punktet mit der größten Datenbank,
Cronometer mit Mikronährstoffen, MacroFactor mit adaptivem Bedarf, Yazio mit Intervallfasten.
KI-Foto-Logging ist inzwischen Standard.

| Prio | Feature | Warum | Aufwand |
|---|---|---|---|
| 1 | **Backup/Export (JSON/CSV) + Import** | Alle Daten liegen nur lokal. Browser-Daten löschen oder ein Handywechsel heißt heute: alles weg. Deckt auch das Recht auf Datenübertragbarkeit (Art. 20 DSGVO) ab. | S |
| 2 | **Generische Lebensmittel (BLS 4.0 / USDA)** | Bei „Apfel“ liefert OFF französische Markenprodukte. Für Unverpacktes fehlt eine Basis-DB. Der `CompositeFoodProvider` ist dafür schon vorbereitet. | M |
| 3 | **Gewichtsverlauf + adaptiver Bedarf** | MacroFactor-Prinzip: Das Ziel wird aus Gewichtstrend und tatsächlicher Aufnahme nachjustiert. Das wäre der stärkste Unterschied zu Gratis-Apps. | M |
| 4 | **Teller-Foto → KI-Schätzung** | Gemini-Vision ist schon angebunden (Etikett-Scan). Nötig sind nur ein eigener Prompt und eine Bestätigungsmaske. Die UI muss klar „Schätzung“ sagen. | S–M |
| 5 | **PWA vollständig** (Manifest, Icons, Offline-Cache) | Die App wird als PWA genutzt, ein `manifest.webmanifest` fehlt aber. Offline-Cache für zuletzt genutzte Produkte. | S |
| 6 | **Wasser-Tracking** | Steht schon im eigenen `docs/DESIGN.md` (Wasser-Ring) und ist einfach umzusetzen. | S |
| 7 | **Intervallfasten-Timer** | Yazios Kernfeature, bei vielen Nutzer*innen gefragt | M |
| 8 | **Wochen-/Monatsstatistik, Streaks** | Motivation und Rückblick. Die Daten sind schon da (Tagebuch). | M |
| 9 | **Apple Health / Health Connect** | Gewicht und Schritte automatisch übernehmen (Capacitor-Plugins, nur nativ) | M–L |
| 10 | **Erinnerungen** (lokale Notifications) | „Mittagessen eintragen?“ ohne Server | S |

## 2. Rechtliches (EU/Österreich)

### Bereits umgesetzt (diese Session)
- **Datenschutzerklärung aktualisiert.** Neu drin sind: Verantwortlicher, die echten Datenflüsse
  (Cloudflare-Proxy, Open Food Facts, Open Prices, Google Gemini, GitHub Pages), Rechtsgrundlage,
  Betroffenenrechte und die Beschwerdestelle (DSB). Die alte Aussage „keine Daten an unsere Server“
  war mit der Proxy-Suche falsch.
- **Quellenangabe für Open Food Facts (ODbL)** unter allen Suchtreffern und in den Nutzungsbedingungen.
  Die ODbL verlangt Namensnennung und Share-Alike. Produktfotos stehen unter CC BY-SA
  ([OFF: Bedingungen](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api),
  [OFF: Lizenz-Tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side)).
- **„Kein Medizinprodukt“** steht jetzt in den Nutzungsbedingungen. Kalorienzähler gelten nach EU-MDR
  als Wellness-Software, **solange keine medizinische Zweckbestimmung behauptet wird**. Entscheidend sind
  Claims und Marketing. Personalisierte Gesundheitsratschläge können ein Grenzfall werden
  ([Mason Hayes & Curran](https://mhc.ie/latest/insights/health-and-fitness-apps-v-medical-devices),
  [Sano Labs](https://www.sanolabs.eu/blog/wellness-app-vs-medical-device-eu-mdr/)).
  Also keine Aussagen wie „bei Diabetes“ oder „therapiert“.

### Offen — deine Aktion
1. **Gemini-API-Bedingungen (wichtig).** Laut den archivierten Gemini API Additional Terms darfst du
   Nutzer*innen im EWR, in der Schweiz und im UK **nur über Paid Services** bedienen
   ([Terms Okt. 2025](https://ai.google.dev/gemini-api/terms-archive/terms_10_07_25)). Bei unbezahlter
   Nutzung kann Google Inhalte zur Produktverbesserung verwenden. Mit Paid Services nicht, dann gilt ein
   Data Processing Addendum ([Terms Nov. 2025](https://ai.google.dev/gemini-api/terms-archive/terms_11_20_25)).
   → Solange nur du die App nutzt, ist das ok. **Bevor andere sie nutzen:** Billing für den Key aktivieren
   und die aktuellen Terms prüfen, auch ob es eine Altersgrenze gibt.
2. **Offenlegung nach § 25 MedienG.** Sie gilt nach WKO für alle Websites, also auch private. Für eine
   „kleine Website“ reichen Name, Wohnort/Sitz und Unternehmensgegenstand
   ([WKO Website-Impressum](https://www.wko.at/stmk/internetrecht/website-impressum)).
   Wird die App kommerziell (Store-Verkauf, Abo, Werbung), kommt das volle Impressum nach § 5 ECG dazu
   (Anschrift, E-Mail …). → Für einen „Impressum“-Punkt im Profil brauche ich deinen **Wohnort**.
   Ob die Regel auf eine App genauso angewendet wird wie auf eine Website, sollte ein*e Jurist*in klären.
3. **Gesundheitsdaten (Art. 9 DSGVO).** Gewicht, Größe und Alter bleiben heute **nur auf dem Gerät**,
   du verarbeitest sie also nicht. **Sobald Cloud-Sync, Accounts oder Server-Backups dazukommen:**
   ausdrückliche, gesonderte Einwilligung (Art. 9 Abs. 2 lit. a) plus Grundlage nach Art. 6, das Ganze
   dokumentiert, und vermutlich eine Datenschutz-Folgenabschätzung (Art. 35)
   ([SRD Rechtsanwälte](https://www.srd-rechtsanwaelte.de/blog/health-apps-datenschutz)).
4. **EU AI Act, Art. 50 (gilt seit 2.8.2026).** Die Chatbot-Kennzeichnungspflicht betrifft NutriTrack nicht
   direkt, weil kein Chat-Assistent eingebaut ist
   ([Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026)).
   Empfehlung trotzdem: KI-Ergebnisse in der UI als „KI-Schätzung – bitte prüfen“ markieren. In der
   Datenschutzerklärung steht es schon.
5. **localStorage, Cookies, Tracking.** Lokales Speichern, das für die gewünschte Funktion nötig ist,
   braucht keine Einwilligung (§ 165 Abs. 3 TKG 2021). Solange kein Analytics oder Tracking eingebaut
   ist, gibt es **kein Cookie-Banner**. Das sollte so bleiben.
6. **App Stores (falls nativ veröffentlicht):** Datenschutz-URL und Privacy-Labels („Data not collected“
   bzw. die tatsächlichen Flüsse von oben) angeben. Löschfunktion für Accounts erst, wenn es Accounts gibt.

# Rolle 17: Sicherheit und Datenschutz (KI-Worker, CSP, lokale Daten)

Stand 2026-11-09. Nur Code gelesen (worker.js, wrangler.toml, index.html, backup.ts, Settings-Texte, Android/iOS-Konfig); nichts live gegen Cloudflare geprueft.
Bereits umgesetzt, hier NICHT mehr gemeldet: Tagesdeckel-Logik, temperature 0, maxOutputTokens, OFF-Limiter, SSRF-Trailing-Dot/Ports, Backup ohne endpoint/apiKey, generische Fehlertexte, Spoonacular im Datenschutztext, EXIF-Entfernung per Canvas.

F1. Tagesdeckel ist im Repo nicht aktiv (Konfiguration, nicht Code)
- Befund: wrangler.toml:30-34 `DAILY_KV` auskommentiert; worker.js:419 `takeDailySlot` gibt ohne Binding true zurueck (fail-open), ebenso bei KV-Fehler (:427-429).
- Auswirkung: Ein Deploy mit der Repo-Datei hat nur 20 Anfragen/IP/Min. Mit wechselnden IPs und fehlendem/gefaelschtem Origin sind unbegrenzte Gemini-Kosten moeglich, sobald Billing aktiv ist.
- Vorschlag: KV-Namespace anlegen, Block aktivieren; Deploy bricht ab, wenn /health hasDailyCap:false meldet; bei KV-Fehler fail-closed (503).
- Aufwand S, Prioritaet hoch

F2. Deckel zaehlt Anfragen, nicht Gemini-Aufrufe oder Kosten
- Befund: Ein Slot pro POST (worker.js:369), real bis zu 4 Gemini-Calls (2 Modelle x 2 Versuche, :38, :681-717); Fotoanfragen (bis 4 Mio. Zeichen, :103) kosten ein Vielfaches. KV get+put nicht atomar (:424-426).
- Auswirkung: Effektiver Kostendeckel bis ca. 4x ueber DAILY_AI_CAP; Fotoflut verbraucht das Budget ueberproportional.
- Vorschlag: Retries mitzaehlen; Foto-Funktionen (recognizeLabel, importRecipe mit Bild) mit Gewicht 5 oder eigenem kleinen Tageslimit; Durable Object statt KV (E7). Zusaetzlich Budget/Quota auf Google-Cloud-Projektebene als zweite, unabhaengige Schicht.
- Aufwand M, Prioritaet hoch

F3. Spoonacular-Tagesquote (50 Punkte) per Cache-Miss-Flut fuer alle blockierbar
- Befund: recipeSearch (worker.js:317-346) hat nur IP-Limiter und URL-Cache; `query` ist frei (200 Zeichen), jede neue Zeichenfolge kostet Punkte; kein Tageslimit auf diesem Pfad.
- Auswirkung: Ein Skript leert die Quote in Minuten; Rezeptsuche und Wochenplan fallen fuer Jakob aus (Denial of Service, kein Datenabfluss).
- Vorschlag: Eigener Tageszaehler (z. B. 35) im selben KV/DO, danach 429 mit klarer Meldung; Query normalisieren (lowercase, trim, Leerraum) fuer mehr Cache-Treffer; `X-Api-Quota-Left` <= 5 serverseitig als Sperre nutzen.
- Aufwand S, Prioritaet mittel

F4. Keine Content-Security-Policy (SEC-03 weiter offen), Daten und Key im localStorage
- Befund: src/index.html:4-22 ohne CSP-Meta; Gesundheitsdaten, Tagebuch und optionaler Spoonacular-Key liegen im localStorage (recipe-search-config.store.ts). Positiv: kein innerHTML/bypassSecurityTrust im App-Code.
- Auswirkung: Ein kompromittiertes npm-Paket koennte Daten und Key ungehindert senden. GitHub Pages erlaubt keine Header, Meta-CSP geht aber.
- Vorschlag: Meta-CSP mit default-src 'self'; connect-src auf Worker, world.openfoodfacts.org, prices.openfoodfacts.org, api.spoonacular.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'. Tesseract (Worker/WASM, blob:) und Schema capacitor://localhost im Gerätetest pruefen; script-src ggf. 'wasm-unsafe-eval'.
- Aufwand S, Prioritaet hoch

F5. Android: allowBackup=true sichert Gesundheitsdaten und Keys
- Befund: android/app/src/main/AndroidManifest.xml:5 allowBackup="true"; res/xml enthaelt keine data_extraction_rules/fullBackupContent.
- Auswirkung: WebView-Daten (Gewicht, Tagebuch, Key) landen in Google-Backups und sind per adb auslesbar; widerspricht "nur auf deinem Gerät" (settings.page.html:332).
- Vorschlag: allowBackup="false" oder WebView-Ordner per Regeln ausschliessen; Text anpassen, falls bewusst gesichert wird. Nur relevant, wenn Android ausgeliefert wird (E8).
- Aufwand S, Prioritaet niedrig

F6. Datenschutztext ungenau bzw. ueberzeichnet
- Befund: settings.page.html:332 "Wir haben keinen Zugriff": der Worker loggt Fehler inkl. Upstream-Texte (worker.js:172), Cloudflare-Logs enthalten IPs, keine Aufbewahrungsdauer genannt. :336 nennt nur "Produktverbesserung", nicht menschliche Pruefung durch Google im Free-Tier. Das Fastfood-Kalorienbudget (aus Profil abgeleitet) geht an Gemini, ist aber nicht als Gesundheitsbezug (Art. 9 DSGVO) eingeordnet.
- Auswirkung: Rechtliches Risiko bei Verteilung; fuer Eigengebrauch gering.
- Vorschlag: Saetze ergaenzen (Menschen koennen Eingaben lesen, keine Personendaten eingeben; Log-Aufbewahrung); einmaliger Zustimmungsdialog vor dem ersten KI-Aufruf (Text/Foto geht an Google, USA), Zustimmung in Settings widerrufbar.
- Aufwand S, Prioritaet mittel

F7. Origin-Pruefung schuetzt nur Browser; Default-Allowlist enthaelt lokale Origins
- Befund: worker.js:141-144 laesst Anfragen ohne Origin durch (Restrisiko in :31 dokumentiert); :51-59 erlaubt in Produktion http://localhost, :4200, :8100.
- Auswirkung: Kein Schutz gegen Skripte; jede lokale Seite/Software auf diesen Ports kann den Proxy nutzen. Gering, solange F1 geschlossen ist.
- Vorschlag: localhost-Origins nur per ALLOWED_ORIGINS in der Dev-Umgebung; optional geteiltes App-Token als Header (kein echtes Geheimnis, hebt aber die Huerde gegen Zufallsscans). Echter Schutz bleibt F1/F2.
- Aufwand S, Prioritaet niedrig

F8. Prompt-Injection ueber importierte Seiten manipuliert gespeicherte Rezepte
- Befund: worker.js:854 setzt Seitentext (max. 12.000 Zeichen) direkt in den Prompt; importRecipe nutzt kein responseSchema (:858); Ausgabe wird ohne Wertegrenzen uebernommen.
- Auswirkung: Praeparierte Rezeptseite kann Titel, Schritte und Nährwerte verfaelschen (absurde Makros, Werbetext). Kein Datenabfluss, da das Modell weder Tools noch Profildaten hat.
- Vorschlag: responseSchema fuer importRecipe/recognizeLabel/suggestFastfood; serverseitig Grenzen (kcal 0-1000 je 100 g, Titel 200 Zeichen, max. 60 Zutaten); Prompt: Seiteninhalt ist Daten, keine Anweisung. Ueberschneidet sich mit KIX-07/-08, hier nur der Sicherheitsaspekt.
- Aufwand S, Prioritaet niedrig

F9. /health ist oeffentlich und verraet den Konfigurationsstand
- Befund: worker.js:159-161, 182-194 liefert hasKey, hasDailyCap, Modellnamen und warning ohne Zugangsschutz.
- Auswirkung: Angreifer sieht sofort, ob der Deckel fehlt (F1). Gering.
- Vorschlag: Oeffentlich nur {ok:true}; Details nur mit Admin-Header (Secret) oder in die Logs.
- Aufwand S, Prioritaet niedrig

Fragen/Thesen an andere Rollen
1. Worker/Backend: Soll der Tageszaehler auf ein Durable Object, und gibt es ein hartes Euro-Limit auf Google-Cloud-Seite, das auch bei Worker-Fehlern greift?
2. Recht/Release: Reicht fuer TestFlight der aktuelle Datenschutztext, oder braucht es vor dem ersten KI-Aufruf eine Einwilligung (Gesundheitsbezug durch das Kalorienbudget)?
3. Frontend/Performance: Laeuft Tesseract (Worker, WASM, blob:) unter strikter CSP ohne 'unsafe-eval', oder muss script-src gelockert werden?

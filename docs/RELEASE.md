# Release: iOS (TestFlight) und Android

Stand: 2026-11-08. Diese Anleitung bereitet alles vor, was ohne Apple-Account und Secrets geht. Die mit **[Jakob]** markierten Schritte kann nur Jakob erledigen.

Bundle-ID / Application-ID: `com.nutritrack.app`. App-Name: NutriTrack. Mindest-iOS: 15.0.

## Versionierung (eine Quelle)
- Quelle: `version` in `package.json` (Format `x.y.z`).
- `node scripts/sync-version.mjs` schreibt sie nach iOS `MARKETING_VERSION` und Android `versionName`.
- Mit Build-Nummer (`--build=N` oder Umgebungsvariable `BUILD_NUMBER`) werden zusaetzlich iOS `CURRENT_PROJECT_VERSION` und Android `versionCode` gesetzt. Codemagic nutzt `PROJECT_BUILD_NUMBER`.
- `node scripts/sync-version.mjs --check` prueft nur, ob Repo und `package.json` uebereinstimmen (laeuft in CI).
- Neue Version: `package.json` aendern, `node scripts/sync-version.mjs`, committen, Tag `vX.Y.Z` setzen.
- Die Build-Nummer wird im CI-Lauf gesetzt und nicht committet. Jede Einreichung braucht eine hoehere Nummer als die vorherige.

## iOS: einmalige Einrichtung **[Jakob]**
1. **Apple Developer Program** beitreten (99 USD/Jahr): https://developer.apple.com/programs/ . Das dauert oft 1 bis 2 Tage.
2. **Bundle-ID registrieren**: developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > App IDs > `com.nutritrack.app` (Explicit). Keine besonderen Capabilities noetig (keine Push, kein iCloud).
3. **App in App Store Connect anlegen**: https://appstoreconnect.apple.com > Apps > Neue App. Plattform iOS, Name NutriTrack (muss weltweit frei sein, sonst anderer Name), Primaersprache Deutsch, Bundle-ID `com.nutritrack.app`, SKU frei waehlbar.
4. **App-Store-Connect-API-Key** erzeugen: App Store Connect > Benutzer und Zugriff > Integrationen > App Store Connect API > Schluessel erstellen (Rolle "App Manager"). Notieren: Issuer-ID, Key-ID, `.p8`-Datei (nur einmal downloadbar). Nie ins Repo.
5. **Codemagic** (https://codemagic.io, Anmeldung mit GitHub): Repo `NutriTrack` hinzufuegen, Workflow aus `codemagic.yaml` wird erkannt.
6. In Codemagic > Teams > Integrations > App Store Connect: Key mit Issuer-ID, Key-ID und `.p8` anlegen. Der Name muss zu `integrations.app_store_connect` in `codemagic.yaml` passen (Platzhalter dort: `NutriTrack-ASC`).
7. **Signing**: Codemagic > Team > Code signing identities. Entweder "Fetch from Apple Developer Portal" (ueber den API-Key; erzeugt Distribution-Zertifikat und App-Store-Profil automatisch) oder eigene Dateien hochladen. Die Team-ID ergibt sich aus Zertifikat/Profil, sie steht nicht im Repo.
8. **Erster TestFlight-Build**: Tag setzen und pushen (`git tag v1.0.0 && git push origin v1.0.0`) oder in Codemagic manuell "Start new build" (Workflow `ios-testflight`). Nach ca. 15 bis 25 Minuten erscheint der Build in App Store Connect > TestFlight (Apple verarbeitet danach noch einige Minuten).
9. In TestFlight: Interne Tester hinzufuegen (eigene Apple-ID), App auf dem iPhone ueber die TestFlight-App installieren.
10. Bei der ersten Einreichung fragt App Store Connect nach Export-Compliance. Der Schluessel `ITSAppUsesNonExemptEncryption = false` in `Info.plist` beantwortet das (nur HTTPS/Standard-Verschluesselung). Wenn sich das aendert, anpassen.

Ohne eigenen Mac geht alles ueber Codemagic. Lokal brauchst du nur fuer Debugging Xcode: `npm run build && npx cap sync ios && npx cap open ios`.

## iOS: was im Repo schon vorbereitet ist
- `codemagic.yaml`: Workflow `ios-testflight` (Tests, Web-Build, `cap sync`, Versions-Sync, Signing, IPA, TestFlight-Upload). Trigger: Tags `v*`. Keine Secrets enthalten.
- `ios/App/App/Info.plist`: `ITSAppUsesNonExemptEncryption=false`, deutsche Berechtigungstexte fuer Kamera und Fotos.
- `ios/App/App/PrivacyInfo.xcprivacy` (im Xcode-Projekt als Resource eingetragen): kein Tracking, keine Required-Reason-APIs. Geprueft: Der App-Code (`AppDelegate.swift`, `SceneDelegate.swift`) nutzt keine solche API; `localStorage` im WebView zaehlt nicht dazu; die Capacitor-Frameworks bringen eigene, leere Manifeste mit. Neue native Plugins (z. B. `@capacitor/preferences`) muessen neu geprueft werden, weil sie UserDefaults nutzen.
- Offen im Manifest: `NSPrivacyCollectedDataTypes` ist leer. Die ehrliche Deklaration der Datenfluesse an Gemini, Spoonacular und Open Food Facts steht in `docs/STORE-PRIVACY.md` und muss mit den App-Store-Connect-Angaben **[Jakob]** abgeglichen werden, bevor eingereicht wird.

## App Store (ueber TestFlight hinaus) **[Jakob]**
Nur noetig, wenn die App oeffentlich in den Store soll (Entscheidung E8).
- Privacy-Labels in App Store Connect nach `docs/STORE-PRIVACY.md` ausfuellen.
- Datenschutz-URL und Support-URL (oeffentlich erreichbar) eintragen; die Datenschutzerklaerung liegt bisher nur in der App (Einstellungen).
- Impressum/Betreiberangaben: siehe Abschnitt "Betreiberangaben" in `docs/STORE-PRIVACY.md`.
- Screenshots (6,7 Zoll und 6,5 Zoll iPhone), Beschreibung, Stichwoerter, Altersfreigabe, Kategorie (Gesundheit & Fitness oder Ernaehrung).
- Review-Hinweis: kein Login noetig; KI-Funktionen laufen ueber den Worker (`docs/KI-WORKER.md`), dieser muss zum Review erreichbar sein, Tagesdeckel gesetzt.
- Gesundheits-Disclaimer: NutriTrack ist kein Medizinprodukt (steht in den Nutzungsbedingungen der App).

## Android
Signing ist vorbereitet, der Upload nicht.
1. **Keystore erzeugen [Jakob]** (einmalig, Datei und Passwoerter sicher sichern, ohne sie ist kein Update mehr moeglich):
   ```bash
   keytool -genkeypair -v -keystore nutritrack-release.jks -alias nutritrack -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Lokal**: `android/keystore.properties` anlegen (ist gitignored):
   ```properties
   storeFile=C:/pfad/zu/nutritrack-release.jks
   storePassword=...
   keyAlias=nutritrack
   keyPassword=...
   ```
3. **CI**: stattdessen Umgebungsvariablen `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Build: `npm run build && npx cap sync android && node scripts/sync-version.mjs --build=N && cd android && ./gradlew bundleRelease` (Ergebnis `android/app/build/outputs/bundle/release/app-release.aab`). Ohne Signing-Angaben entsteht ein unsigniertes Bundle.
5. Play Console **[Jakob]**: Entwicklerkonto (einmalig 25 USD), App anlegen, AAB in "Interner Test" hochladen. Play App Signing aktivieren.
6. Es gibt noch keinen Android-Workflow in CI.

## GitHub Pages (Web-Version)
- Workflow `.github/workflows/deploy-pages.yml`: Job `ci` (tsc, `ng test --watch=false`, `node --test worker.test.mjs`, Skript-Tests, Versions-Check) bei jedem Push auf `main`/`weekly-recipes` und bei Pull Requests.
- Deploy nur auf `main` und nur bei gruenem CI. Die Pages-Bauausgabe liegt in `dist/pages/browser` (`npm run build:pages`), getrennt von `www/` (Capacitor `webDir`). Dafuer musste `angular.json` nicht angefasst werden: `--output-path` ueberschreibt den Pfad, Angular haengt `browser/` an.
- Empfohlen **[Jakob]**: GitHub > Settings > Branches > Branch protection fuer `main`, Status-Check `ci` als Pflicht, damit ein roter CI nicht gemergt wird.
- Rollback: Im GitHub-Repo den letzten guten Commit auf `main` per `git revert` zurueckdrehen und pushen (der Workflow deployt neu), oder Actions > fruehere erfolgreiche Ausfuehrung > "Re-run all jobs".
- Achtung (E10): Ein Push/Merge nach `main` geht sofort live.

## Offene Punkte (nicht Teil von Welle 6)
- Crash-Monitoring (REL-07): braucht Entscheidung (Sentry/Crashlytics) und App-Code.
- Android-CI-Workflow, Play-Upload.
- Datenschutzerklaerung als oeffentliche URL.

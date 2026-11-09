# Rolle 15: iOS-native Anmutung (Capacitor)

Stand 2026-11-09. Reine Code-Lektüre, nichts auf Gerät oder Simulator geprüft (Aussagen zum Ionic-Modal-Verhalten sind "zu verifizieren"). Nicht doppelt gemeldet: IOS-01..10, MUX-03..05, RSP-01..07, A11-01 aus REVIEW-ERGEBNIS.md. Haptik (IOS-02) ist inzwischen umgesetzt (`src/app/diary/haptics.ts`).

## Findings

F1. Zahlenfelder ohne Return-Taste, Tastatur nicht schließbar.
Befund: Felder mit `inputmode="decimal"/"numeric"` (`add-entry-sheet.component.html:216-239`, `meals-list.component.html:166-172`, `recipes.page.html:193-206`, `shopping.page.html:349,366`). Der iOS-Zahlenblock hat keine Return-Taste, `enterkeyhint` wirkt dort nicht. `@capacitor/keyboard` ist installiert (package.json), aber nirgends importiert.
Auswirkung: Nach kcal/Eiweiß-Eingabe bleibt die Tastatur offen und verdeckt Footer bzw. "Eintragen"; man muss ins Leere tippen.
Vorschlag: Beim Start auf nativer Plattform `Keyboard.setAccessoryBarVisible({isVisible: true})` (zeigt "Fertig"-Leiste); zusätzlich Tastatur beim Scrollen/Tippen auf freie Fläche schließen.
Aufwand S. Priorität hoch.

F2. Sheets ohne Breakpoints und ohne presentingElement: kein Wisch-zum-Schließen.
Befund: `ion-modal` in `add-entry-sheet.component.html:2`, `diary.page.html:126`, `recipes.page.html:116/316/372/466`, `meals-list.component.html:58/142`, `fastfood-sheet.component.html:2` setzen weder `breakpoints` noch `presentingElement` (Grep: kein `presentingElement` im Projekt). Ionic zeigt dann Vollbild-Modals ohne Griff und ohne Swipe-Down, obwohl `global.scss:558-570` Radius 28 und Griff stylt.
Auswirkung: Der Hauptflow "Eintragen" wirkt nicht wie ein iOS-Sheet; Radius und Griff sind wirkungslos, geschlossen wird nur per Button.
Vorschlag: `[presentingElement]` (Card-Stil) oder `breakpoints [0, 0.9]` mit `initialBreakpoint 0.9` für Erfassen/Bearbeiten/Rezept; `canDismiss` ("Verwerfen?") bleibt.
Aufwand S bis M. Priorität hoch (per Simulator verifizieren).

F3. Tageswechsel bei Rückkehr aus dem Hintergrund.
Befund: Seiten reagieren nur auf `ionViewWillEnter` (`dashboard.page.ts`, `diary.page.ts`). `@capacitor/app` ist installiert, aber es gibt keinen `appStateChange`-Listener (Grep leer).
Auswirkung: iOS hält die App tagelang im Speicher; morgens aus dem App-Switcher geöffnet zeigt "Heute" die Ringe von gestern (ergänzt QAD-02, das nur Mitternacht bei offener Seite meint).
Vorschlag: Zentraler `App.addListener('appStateChange')` (plus `visibilitychange`), bei Aktivierung Tagesdatum neu setzen.
Aufwand S. Priorität hoch.

F4. StatusBar-Plugin ungenutzt, Stil nur per Meta.
Befund: `@capacitor/status-bar` in package.json, kein Aufruf. `index.html:21` setzt nur `apple-mobile-web-app-status-bar-style`, das gilt für Homescreen-PWA, nicht für die native WKWebView. Info.plist hat `UIViewControllerBasedStatusBarAppearance=true`.
Auswirkung: Statusleisten-Schrift folgt dem Systemmodus; bei Dark-Mode-iPhone droht helle Schrift auf heller App.
Vorschlag: `StatusBar.setStyle({style: Style.Light})` beim Start oder `UIUserInterfaceStyle=Light` in Info.plist (passt zu E5 "Dark Mode aus", färbt auch Tastatur und Systemsheets hell).
Aufwand S. Priorität mittel, hoch bei Dark-Mode-Nutzung.

F5. Kontextmenü und Leading-Swipe fehlen.
Befund: Einträge (`diary.page.html:79-102`) haben drei Swipe-Aktionen nur am Zeilenende, kein Long-Press.
Auswirkung: "Doppelt eintragen" (häufig bei Protein-Snacks) ist hinter Wischen und drei Icons versteckt.
Vorschlag: `ion-item-options side="start"` mit "Doppelt"; Long-Press öffnet das vorhandene ActionSheet (Doppelt/Bearbeiten/Löschen).
Aufwand M. Priorität mittel.

F6. Haptik ohne Semantik.
Befund: `haptics.ts` kennt nur `Impact Light`.
Vorschlag: `notification(Success)` bei "Eingetragen", `selectionChanged` bei Segment/Datum/Stepper, `Warning` beim Überschreiten des kcal-Ziels.
Aufwand S. Priorität niedrig.

F7. Widget und Sperrbildschirm fehlen, größter Native-Hebel für den Eiweiß-Fokus.
Befund: Kein WidgetKit-Target in `ios/App`; Daten liegen in localStorage der WebView und sind für ein Widget nicht lesbar.
Vorschlag: Tageswerte nach jedem Schreiben in eine App-Group (`UserDefaults(suiteName:)`) spiegeln (kleines lokales Capacitor-Plugin); Widget "Noch Z g Eiweiß" plus Lockscreen-Kreis; Tap öffnet "Eintragen" per Deep-Link. Voraussetzung: Signing und App-Group (REL-01).
Aufwand L. Priorität mittel (hoher Alltagsnutzen, nach Welle 3).

F8. Apple Health und Shortcuts.
Befund: Nichts vorhanden (E9).
Vorschlag: Zuerst Gewicht aus Health lesen (spart Doppeleingabe, bedient COA-01), danach Eiweiß/Energie schreiben; Usage-Texte und Privacy-Manifest mitziehen. Zusatz: App-Intent "Eiweiß eintragen: 30 g" für Siri/Action Button.
Aufwand L. Priorität niedrig bis mittel.

F9. Pull-to-Refresh bewusst weglassen.
Befund: Kein `ion-refresher`; Daten sind lokal, ein Refresher wäre irreführend.
Vorschlag: Nur Retry-Button im Fehlerzustand von Wochenplan/Online-Suche (STA-02/05).
Aufwand S. Priorität niedrig.

F10. Querformat auf dem iPhone erlaubt.
Befund: `Info.plist:54-57` listet Portrait und Landscape für iPhone; Tab-Bar, Ringe und Sheets sind nur hochkant gestaltet (RSP-05 nennt nur die Sheet-Höhe).
Vorschlag: iPhone auf Portrait festlegen, iPad separat belassen.
Aufwand S. Priorität mittel.

F11. Teilen und Backup-Datei im Capacitor-Kontext.
Befund: `backup.service.ts:74` und `shopping.page.ts:396` nutzen `navigator.share`; Datei-Share ist in WKWebView unzuverlässig.
Vorschlag: `@capacitor/share` plus `@capacitor/filesystem` (Cache-Datei) nativ nutzen; Abbruch durch Nutzer nicht als Fehler melden.
Aufwand M. Priorität mittel (auf Gerät verifizieren).

## Fragen/Thesen an andere Rollen
1. An Produkt/Coach: Lohnt ein Eiweiß-Widget (F7) mehr als der Gewichtsverlauf, wenn "noch Z g" der tägliche Hauptblick ist?
2. An Sicherheit/Datenschutz: Reicht ein App-Group-Spiegel der Tageswerte (F7) unverschlüsselt, und wie passt Apple Health (F8) zum Privacy-Manifest?
3. An Design/Theming: Soll "Light erzwingen" (F4, E5) per `UIUserInterfaceStyle` festgeschrieben werden, damit Statusleiste, Tastatur und Systemsheets zur hellen Palette passen?

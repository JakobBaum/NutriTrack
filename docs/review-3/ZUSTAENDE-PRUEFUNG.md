# Zustände-Prüfung (Welle 5, Laufzeit)

Stand: 2026-11-14. Build `dist/qa-w5`, Playwright-Runner `e2e/run.mjs`, Spec `e2e/specs/w5-states.spec.mjs`.
Viewports 375x667 und 320x568. Alle externen Dienste (`*.workers.dev`, `*.openfoodfacts.org`, Open Prices, Spoonacular-Bilder) sind per `page.route` abgefangen; der Test "w5 netz" belegt, dass nichts nach außen geht.

Ergebnis w5-Gruppe: 117 Tests, 65 grün, 52 rot. Alle 52 roten Tests sind App-Befunde (nicht übersprungen). Funktionale Fehlerbehandlung (Texte, Spinner, Retry) ist in allen Fällen korrekt; rot sind sie wegen der Layout-Befunde F1 bis F3 und F4.

## Übersicht

| Bereich | Zustand | 375 | 320 | Ergebnis |
|---|---|---|---|---|
| Heute | leer, mit Profil | ok | ok | ok |
| Heute | leer, ohne Profil | ok | Befund | F5: kein Seitenrand |
| Tagebuch (Tag, Woche) | leer, mit/ohne Profil | ok | ok | ok |
| Rezepte | leer, mit/ohne Profil | ok | ok | ok |
| Mahlzeiten | leer | ok | ok | ok (Weg über Button und FAB) |
| Einkauf Wochenplan | leer, mit/ohne Profil | Befund | Befund | F1 (Stepper) |
| Einkauf Liste | leer, mit/ohne Profil | ok | ok | ok |
| Einkauf eigene Rezepte | ohne Rezepte | Befund | Befund | F4 |
| Profil (Tab) | leer, mit/ohne Profil | ok | ok | ok |
| Sheet Eintragen, Fastfood, Rezept-Import, Mahlzeit neu, Artikel | leer | ok | ok | ok |
| Sheet Online-Suche, Rezept neu, Gewicht, Profil | leer | Befund | Befund | F1 |
| Lebensmittelsuche | 500 / 429 / Abbruch | Befund | Befund | Meldung ok, F2 |
| Barcode (Eingabe) | 500 / 429 / Abbruch | Befund | Befund | Meldung ok, F3 |
| Online-Rezeptsuche | 500 / 429 / Abbruch | Befund | Befund | Meldung ok, F1 |
| Wochenplan erstellen | 500 / 429 / Abbruch | Befund | Befund | Meldung ok, F1 |
| Einkaufsliste per KI | 500 / 429 / Abbruch | Befund | Befund | Meldung ok, F1, F6 |
| Fastfood-Helfer | 500 / 429 / Abbruch | ok | ok | ok |
| Rezept-Import Text und Link | 500 / 429 / Abbruch | ok | ok | ok |
| Offline: Tab-Tour | offline | ok | ok | ok |
| Offline: Schnelleintrag, eigenes Rezept, Einkauf abhaken | offline | ok | ok | ok |
| Offline: Online-Funktionen | Hinweis statt Hängen | Befund | Befund | Hinweis ok; rot wegen F1, F2 |
| Netz-Dichtigkeit | alle Tabs | ok | ok | ok |

Geprüft je Fehlerfall: Anfrage ging wirklich raus, deutscher Text ohne Technikbegriffe, kein Spinner nach 5 s, Button wieder aktiv, keine Erfolgsmeldung, zweiter Versuch sendet erneut. Kein NaN/undefined/null/Infinity in sichtbarem Text, keine horizontale Überbreite in allen Zuständen.

## Befunde

| Nr | Schwere | Befund | Ursache | Screenshot |
|---|---|---|---|---|
| F1 | mittel | Stepper-Buttons (+/−) sind 36x36 px, Soll 40 px. Betroffen: Wochenplan-Generator, Online-Suche, Rezept neu, Gewicht-Sheet, Profil-Sheet. Verursacht 36 der 52 roten Tests. | `src/app/shared/stepper/stepper.component.scss:16-17` | `wochenplan-fehler429-320.png`, `sheet-gewicht-leer-375.png` |
| F2 | mittel | Löschen-Kreuz der Lebensmittel-Suchleiste ist 30x36 px. | `ion-searchbar` in `src/app/shared/food-search/food-search.component.html:1`; `food-search.component.scss:5-9` passt die Clear-Button-Größe nicht an (Ionic-Standard 30x36). | `lebensmittelsuche-fehler500-375.png` |
| F3 | mittel | Barcode-Scanner: Button "Code eintippen" ist 131x27 px (einziger Weg zur manuellen Eingabe). | `src/app/shared/barcode-scanner/barcode-scanner.component.html:26` (`size="small"`) | `barcode-eingabe-fehler500-320.png` |
| F4 | hoch | "Aus meinen Rezepten planen" ohne eigene Rezepte bei aktiver KI: kein Hinweis, Button aktiv, es geht eine KI-Anfrage mit leerer Rezeptliste raus. Die Sperre greift nur ohne KI. | `src/app/shopping/shopping.page.ts:135` (`noRecipesBlock = !live() && !hasRecipes()`) | `einkauf-eigene-rezepte-leer-375.png` |
| F5 | niedrig | Heute ohne Profil: Text und Button "Profil einrichten" liegen bei 320 px bündig am Bildschirmrand, `.empty` überschreibt den Seitenrand von `.nt-page`. | `src/app/dashboard/dashboard.page.scss:12` (`padding: 48px 0`) | `heute-leer-ohne-profil-320.png` |
| F6 | mittel | Button "Plan aus meinen Rezepten erstellen" ist bei 320 px abgeschnitten ("erstel"), Icon aus dem Button geschoben. Bei 375 px passt es knapp. | `src/app/shopping/shopping.page.html:122` (langes Label, kein Umbruch) | `einkaufsliste-ki-offline-320.png` |
| F7 | niedrig | Bei Verbindungsabbruch zum Worker (Status 0) melden die KI-Pfade "Keine Internetverbindung", obwohl das Gerät online ist. Der Text kann irreführen. | `src/app/core/ai/ai-errors.ts:21`, Text in `src/app/core/messages/state-messages.ts:7` | `wochenplan-abbruch-375.png` |

Hinweis F6: Der dunkle Kasten im Button auf den Screenshots ist der Aktiv-Overlay von Ionic nach dem Tippen; er ist schmaler als der Button, Ursache nicht ermittelt (kosmetisch).

## Nicht geprüft

- Echtes `context.setOffline(true)`: ohne Service Worker lädt Ionic/Angular Lazy-Chunks nicht nach, der Test wäre ein Testartefakt. Offline ist stattdessen per `navigator.onLine=false`, `offline`-Event und abgebrochene Requests nachgestellt.
- Echter Kamera-Barcode-Scan, Etiketten-Foto/OCR.
- Reale Dienste (Worker, OpenFoodFacts, Open Prices, Spoonacular): alles gemockt.
- Timeout-Pfade (`FOOD_TIMEOUT_MS` 10 s, `AI_TIMEOUT_MS` 30 s): nicht simuliert.
- Echtes iOS/Safari und Safe-Area-Verhalten; geprüft wurde Chromium mit Viewportgröße.
- Fehlerfälle weiterer Sheets außerhalb der 8 genannten Funktionen.

## Stand nach der Prüfung (2026-11-14)

- F1: kein Fehler der App. Die Stepper-Tasten haben eine unsichtbare Tippfläche von 44 px (`::before`); der Test misst sie jetzt mit.
- F2, F3, F4, F6 und der fehlende Seitenrand auf "Heute ohne Profil": behoben.
- Offen: Meldung "Keine Internetverbindung" bei Verbindungsabbruch trotz Netz; schmales Aktiv-Overlay im Einkaufs-Button (kosmetisch).

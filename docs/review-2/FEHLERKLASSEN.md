# Fehlerklassen hinter den Bugs 1.1-1.9 (Stand 2026-11-10)

Pruefung der ganzen App je Klasse per gezielter Suche (grep) und E2E-Messung. Status: behoben, ok (geprueft, kein Fehler), offen (unsicher oder nicht gemessen).

## K1 Blockierte Oberflaeche nach Vorgang / Fokus-Falle / Overlay nicht sauber beendet (Bug 1.2)
Check: alle `ion-modal`, ModalController, ActionSheet, Alert; Reset bei Dismiss/Abbruch/Fehler.
- `recipes/recipes.page.ts` `openOnlineSearch()`: Doppel-Tipp oeffnete zwei Sheets. Behoben (Sperre `onlineSearchOpening`, try/finally). E2E `klassen: Doppel-Tipp ...`.
- `shopping/week-plan/week-plan-cards.component.ts` `open()`: gleiche Luecke. Behoben (`isOpening`, try/finally).
- Import-Text zu Rezept-Sheet (recipes.page.ts, Importfluss): Uebergabe ohne Fokus-Trap, 6/6 Laeufe. ok. E2E `klassen: Text-Import ...`.
- Scan-Overlay (add-entry-sheet, food-sources): in 1.2 behoben, Rest ok (run/recognize mit finally).
- `fastfood-sheet.component.ts`: veraltetes Ergebnis einer laufenden Anfrage kann nach erneutem Oeffnen erscheinen. offen (nicht reproduziert).

## K2 Pfadunterschiede Scan / Suche / Foto / manuell (Bug 1.5)
Check: `applyFacts`-Pfad in add-entry-sheet gegen die anderen Quellen gelesen.
- Alle vier Pfade laufen ueber `applyFacts`; kein weiterer Unterschied gefunden. ok.

## K3 Fokus/Eingabe: ionChange/ionBlur/ionInput blubbern, Blur schliesst Bereiche, Tastatur (Bug 1.5, 1.6)
Check: grep `(ionChange)`, `(ionBlur)`, `(ionInput)` auf Containern (Akkordeon, Segment, Modal).
- Keine weiteren Handler auf Containern ohne Quellpruefung gefunden. Tage-Segment und Stepper in der Wochenplanung: kein NaN. ok.

## K4 Layout klein: Ueberlappung, Safe Area, abgeschnitten (Bug 1.4, 1.6, 1.7)
Check: neuer E2E `sheet-audit.spec.mjs`: 13 Sheets und 5 Seiten bei 375x667 und 320x568 (Abstand oben >= 12, Kopf ohne Ueberlappung, kein Ueberlauf, Schrift >= 13 px, Tippflaeche >= 40 px, Tab-Leiste 44-64 px).
- Drill-Down: Abstand oben 12 px, behoben.
- Rezept Detail bei 320: Fussleiste ragte heraus, behoben (`recipes.page.scss`, `ion-button.recipe__btn`).
- `.recipe__title-btn` Tippflaeche 38 px, behoben (min-height Token).
- Schrift < 13 px (0.75rem) in amount-chips, online-search, food-row, week-recipe-sheet, overlays-and-polish, dashboard: auf `--nt-fs-caption` (13 px) angehoben, behoben.
- Nicht auf echtem Geraet (Safe Area, WebKit) geprueft. offen.

## K5 Warten ohne Rueckmeldung: KI/Netz ohne Ladezustand, Timeout, Fehlertext, sequentiell statt parallel (Bug 1.3, 1.8)
Check: alle KI- und Netzaufrufe.
- `core/price/open-prices.provider.ts`: kein Timeout, behoben (`timeout(FOOD_TIMEOUT_MS)`, Unit-Test).
- Alle anderen KI-Aufrufe (proxy-ai-provider, food-sources, shopping.store generatePlan, Import): Ladezustand, Timeout und Fehlertext vorhanden. ok.
- `shopping/week-plan/week-plan-builder.ts`: Suche je Mahlzeit sequentiell. offen (nicht gemessen).
- `settings/settings.page.ts:291,300,311`: rohes `fetch()` ohne Timeout, nur Diagnose. offen (niedrig).

## K6 Irrefuehrende Bedienelemente (Bug 1.9)
Check: Buttons/Chips/Links, die wie Aktion aussehen aber Zustand sind (und umgekehrt); "Abbrechen" im Sheet-Kopf.
- Sheet-Audit prueft "kein Abbrechen im Kopf" in 13 Sheets: gruen. Keine weiteren Funde. ok.

## K7 Weitere Klassen
- Cache-Schluessel zu spezifisch (Bug 1.8): Uebersetzungs-Cache in 1.8 behoben; weitere Caches nicht systematisch geprueft. offen.
- Handler reagieren auf fremde Ereignisse: siehe K3.
- Zustand nach Abbruch nicht zurueckgesetzt: siehe K1 (try/finally).

## K8 Asynchrones Ergebnis ueberschreibt neueren Zustand (Stale-Write)
Check: alle `await` mit anschliessendem Schreiben in Signal/Store/Formular; Muster: Sequenz-Token (`requestSeq`) oder Neulesen des Stores nach dem `await`. Stand 2026-11-14, statisch gelesen.
- `core/week-plan/week-plan.service.ts:176-184` `retranslate` und `:144-149` `replaceRecipe`: lesen den Plan nach dem `await` neu und mischen per id. behoben/ok.
- `diary/fastfood-sheet/fastfood-sheet.component.ts:77,98-115,150-171`: `requestSeq` verwirft veraltete Antworten (schliesst den offenen Punkt aus K1). behoben.
- `diary/add-entry-sheet/add-entry-sheet.component.ts:612-626` `addPriceHint`: Preishinweis wird nach dem `await` ohne Pruefung auf die aktuelle Zutat gesetzt, kann zu einer anderen Zutat gehoeren. offen.
- `recipes/recipes.page.ts:419-439` Import: schreibt `form` nach dem `await`, Schliessen waehrend des Imports ist nicht gesperrt. offen (Verdacht).
- `shopping/shopping.page.ts:505-540` `editPrice(index)`: Index statt id; bei Neuschreiben der Liste waehrenddessen koennte die falsche Zeile geaendert werden. offen (Verdacht).
- `settings/profile-sheet/profile-sheet.component.ts:296-312` `save`: nutzt den Stand vor dem `await`. offen (niedrig).
- `recipes/online-search/online-search.component.ts:157-172` `loadMore` und `:117-123` `toggleProfileFilter`: Filter werden nach der Uebersetzung des Suchbegriffs gelesen, Nachladen kann zwei Filtersaetze mischen; kein Token. offen (8.2).
- `recipes/online-search/online-search.component.ts:187-197`: `translating` ist ein Boolean, die erste fertige Uebersetzung setzt es fuer das zweite Rezept zurueck. offen (8.3).

## K9 Ungeprueft uebernommene Fremddaten (gespeichert oder angezeigt)
Check: jede Stelle, an der KI-, Netz-, Backup- oder Storage-Daten ohne Pruefung in Stores oder UI landen.
- `core/food/openfoodfacts.provider.ts` (~150-190): nur `Math.max(0, n)`, keine Plausibilitaet (z. B. 9999 kcal pro 100 g). offen (hoch).
- `core/ai/proxy-ai-provider.ts:61-66` Einkaufsliste und Etikett: Antwort roh durchgereicht; `shopping.store.ts:188` uebernimmt `result.items`. offen.
- `core/ai/proxy-ai-provider.ts:70-86` Fastfood, Import, Uebersetzung: ueber Sanitizer/Normalizer. ok; `recipe-import-normalize.ts` ohne Laengen-/Mengengrenzen. offen (mittel).
- `core/state/profile.store.ts:42`, `week-plan.store.ts:13-15`: Laden aus localStorage nur teilweise bzw. gar nicht geprueft; `core/backup/backup.ts:22` laesst Profil/Plan im Backup ungeprueft. offen.
- `core/backup/backup-records.ts` `isFacts`: nur endlich, keine Obergrenzen. offen (niedrig).
- `core/recipes/translate/translation-cache.ts:43-46` `isTexts`: schwache Typpruefung. offen (niedrig).
- `core/recipes/online/spoonacular.mapper.ts`: URLs ueber `safeHttpUrl`, aber `.trim()` auf evtl. Nicht-String-Titel. offen (niedrig).
- Kein `innerHTML`/`bypassSecurityTrust*` im Code. ok.

## K10 Erfolgsmeldung trotz verschluckten Fehlers
Check: Toasts/Banner nach `try/catch`, Rueckgabewerte von Schreib- und Loeschvorgaengen.
- `settings/settings.page.ts:142-285` Zuruecksetzen: zeigt Erfolg, obwohl `storage.service.ts:178-189` `clearAll(): void` Fehler verschluckt (`backup.service.ts` `completeReset` ignoriert den Rueckgabewert). offen.
- `core/storage/storage.service.ts:362-368` `restoreRaw` schluckt Fehler; Import-Rollback meldet ggf. Erfolg. offen.
- `core/backup/backup.service.ts` `deliver`: Fallback von Teilen auf `<a download>` ohne Hinweis; in WKWebView meldet die App "heruntergeladen", ohne dass etwas ankommt. offen (Verdacht).
- Schreibfehler beim Speichern: `storage.service.ts:134-160` (lastError, globales Banner `app.component.html:4`). ok.
- `core/price/open-prices.provider.ts`: Fehler absichtlich verschluckt (Preis ist optional). ok.

## Kompakte UI (iPhone SE)
Globale Tokens in `src/styles/compact-phone.scss` (Media Query: Breite < 390 px oder niedrige Phones): Titel 34 auf 31 px, Hero 40 auf 36, Body 15 auf 14, Titel 22 auf 20, Touch 44 auf 40, Feldhoehe 48, Tab-Leiste 76 auf 56 px (Tab-Beschriftung ca. 12 px, bei 320 px 11,5 px). rem bleibt, Dynamic Type wirkt weiter. Screenshots: `e2e/artifacts/vorher-*` und `nachher-*` (5 Tabs, 375 und 320). Nicht auf echtem Geraet geprueft; Dashboard-Ringe (88/56 px) unveraendert.

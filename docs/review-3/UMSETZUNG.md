# Umsetzung Review 3

## Welle 1: Bugs (2026-11-13, Branch `welle-1-bugs`)

Annahmen: Rückgängig-Hinweis 3,5 s statt 5 s. Nutri-Score steht in der Nährwert-Zeile. Das Sheet "Artikel hinzufügen" öffnet in voller Höhe. iOS-Tastatur auf dem SE mit 304 px gerechnet (216 Tastatur, 44 Vorschläge, 44 Fertig-Leiste).

### 1 Mahlzeit: X im Sheet reagiert nicht
- Ursache (gemessen): X rief `closeCreate()` und setzte `createOpen` auf false. Lehnte man "Verwerfen?" mit "Weiter bearbeiten" ab, blieb das Sheet offen, das Signal aber false. Jeder weitere Tipp auf X änderte nichts mehr.
- Fix: `requestCloseCreate()` fragt zuerst und setzt das Signal nur, wenn wirklich geschlossen wird (`meals/meals-list.component.*`). Dieselbe Lücke im Rezept-Sheet behoben (`requestCloseModal()`, `recipes/recipes.page.*`). Tagebuch-Bearbeiten und Eintragen waren schon richtig. Shopping hat kein `canDismiss`.
- Aus dem Review: `confirmDiscard` zeigt bei Doppeltipp nur noch einen Dialog (`meals/confirm-discard.ts`, Spec neu).

### 2 Zoom: hinein ja, heraus nein
- Ursache: Felder mit `.nt-field` hatten auf dem SE 14 px (Einkauf Artikel und Preis, Mahlzeit-Name, Rezept neu, Rezept importieren, Online-Suche). iOS zoomt unter 16 px beim Fokus hinein. Capacitor sperrt Pinch-Zoom standardmäßig (`zoomEnabled` nicht gesetzt), daher kein Zurück. Der zweite Teil ist aus der Konfiguration abgeleitet, nicht am Gerät gemessen.
- Fix: Token `--nt-fs-input: max(16px, var(--nt-fs-body))` und eine zentrale Regel für alle Textfelder in `src/styles/foundation.scss`. Viewport-Meta unverändert (kein `maximum-scale`).
- Nebenwirkung: Felder im Tagebuch-Sheet und das manuelle Zielfeld im Profil haben 16 statt 17 px.

### 3 Einkaufsliste: Tastatur verdeckt "Hinzufügen"
- Ursache (gemessen bei 375x667): Sheet öffnete bei Breakpoint 0,5. Das Artikel-Feld begann bei y=409, sichtbar wäre mit Tastatur nur bis ca. y=363.
- Fix: Breakpoints `[0, 1]`, Start bei 1 (`shopping/shopping.page.ts`). Felder und Button liegen jetzt bis ca. y=245 (320x568).

### 4 Rückgängig-Toast
- 3,5 s statt 5 s (`TOAST_UNDO_MS`, `UNDO_TOAST_MS`), alle Toasts wegwischbar (`swipeGesture`, Konstante `shared/toast-options.ts`). Wegwischen löscht endgültig (Ionic-Rolle `gesture`, Unit-Test).
- Der Hinweis "Wochenplan erstellt" mit "Zur Liste" bleibt bei 6 s (kein Rückgängig-Hinweis).

### 5 Tag "geschätzt" abgeschnitten
- Ursache: `.qty` war `nowrap`; bei 320 px brauchte der Inhalt 170 px bei 128 px Platz, bei 375 px passte es nur genau.
- Fix: Zeile bricht um, Betrag und Tag bleiben je für sich zusammen; lange Artikelnamen brechen um (`shopping/shopping.page.{html,scss}`). Ungenutzte Regel `.suggested` entfernt (Stilbudget).

### 6 Nutri-Score nicht auf gleicher Höhe
- Ursache: `nt-food-row` war im `ion-item` nur inhaltsbreit, die Marke hing mittig zwischen den Textzeilen (29,5 px Versatz zur Nährwert-Zeile).
- Fix: Marke steht hinter der Nährwert-Zeile, vertikal mittig dazu (Versatz <= 2 px); Zeile füllt die Breite (`shared/food-row/*`).

### Geprüft
- `tsc` sauber, Lint sauber, 129 Dateien / 1264 Unit-Tests grün, `ng build` ohne Budget-Warnung.
- E2E gegen den Produktions-Build, mobile Emulation: 101 Tests, darunter neu `w1-meal-toast` (5) und `w1-shopping-zoom` (7) sowie die Feldschrift-Prüfung im Sheet-Audit (375x667 und 320x568). Die neuen Tests waren gegen den alten Stand rot.
- Screenshots bei 375 und 320 px angesehen: Add-Sheet, Einkaufsliste, Suchtreffer.
- Code-Review durch eigenen Agenten; mittlere Befunde eingearbeitet (Doppel-Dialog, Plan-Toast-Dauer, Konstante statt Literal, toter `backdropBreakpoint`).

### Nicht geprüft (nur Chromium)
- Auto-Zoom und Herauszoomen auf echtem iOS.
- Echte Tastaturhöhe; die 304 px sind ein Rechenwert.
- Toast und Sheet tatsächlich per Finger wegwischen (Tests prüfen Eigenschaft und Rolle, keinen Wisch).
- Safari/WebKit insgesamt.

### Offen (aus dem Review, niedrig)
- `allowClose` bleibt true, falls das Schließen nach bestätigtem Verwerfen scheitert (konstruierter Fall).
- Feste Wartezeiten in den neuen E2E-Tests.
- Die zentrale Feldschrift-Regel hat Spezifität (0,1,1); Komponenten, die bewusst größere Felder wollen, müssen `max(var(--nt-fs-input), …)` nutzen.

## Welle 2: Layout und Einheitlichkeit (Branch `welle-2-layout`, nicht gemergt)

Soll vom Nutzer freigegeben; Navigation Variante B. Die Regeln stehen in `DESIGN.md`, Abschnitt "Layout-Bausteine (Welle 2)".

### Geändert
- Tokens und Bausteine: `src/styles/layout.scss`, `src/styles/buttons.scss`, `src/theme/variables.scss`. Ein Seitenrand (`--nt-page-gutter`), Kartenabstand 12, Abschnittsabstand 24, Kopfzeile 44, Buttons und Symbol-Buttons 44, FAB 56 mit 16 Abstand, Innenradius = Kartenradius minus Kartenpadding (mind. 8).
- Alle Seiten auf `.nt-page` / `.nt-stack` und `<nt-page-header>`; je Seite höchstens ein FAB als direktes Kind von `ion-content`.
- Navigation: nur Symbole, Reihenfolge Heute, Rezepte, Tagebuch, Einkauf, Profil (`tabs.page.*`). Namen für Screenreader bleiben.
- Kennzahlen als `.nt-stat` (Zahl und Einheit zusammen, nie getrennt umbrechend).
- Sheets: Schließen-X rechts, 44x44; `.nt-sheet-footer` als ein globaler Baustein (`src/styles/sheets.scss`), lokale Kopien entfernt. Variante B (`ion-footer`) bleibt für Eintragen und Fastfood; Ausnahme Artikel-Sheet im Einkauf (Button unter den Feldern wegen Tastatur).
- Kochmodus: X rechts neben dem Zähler.
- Stepper, Mengen-Chips, Mahlzeit-Chips im Generator, Plus-Kachel der Suche: Innenradius statt Pille.
- Einkauf: "Einkaufsliste öffnen" entfernt (Segment "Liste" reicht), Checkbox als abgerundetes Quadrat, Wochenplan-FAB mit Plus.
- Rezepte/Mahlzeiten: Kopf mit zwei Symbol-Buttons (Online-Suche, Import), je Reiter eigener FAB. Mahlzeiten-Liste: "Eintragen" nur noch als Symbol (der Name brach bei 375 px mitten im Wort um).
- Online-Suche: Host hatte keine Höhe, der Fuß der Detailansicht lag 57 px unter dem Sheet-Rand; behoben (`online-search.component.scss`).
- Logikfehler (aus dem Code-Review, hoch): Nachübersetzen des Wochenplans schrieb den alten Plan zurück. Jetzt wird in den aktuellen Stand gemischt und ein neuer Plan nicht überschrieben (`core/week-plan/week-plan.service.ts`, zwei Unit-Tests). Menü während der Übersetzung gesperrt.

### Annahmen (ohne Rückfrage entschieden)
- Mahlzeit-Icon vor den Tagebuch-Überschriften entfällt.
- Checkbox der Einkaufsliste eckig mit Radius statt rund.
- Wochenplan bekommt einen FAB "Neuen Wochenplan erstellen" (öffnet nur den Generator, ersetzt noch nichts).

### Geprüft
- Stand 4ba8585: `tsc`, Lint, 1266 Unit-Tests, `ng build` ohne Budget-Warnung, E2E 247/247 (Chromium, mobile Emulation).
- Nacharbeiten danach: `tsc`, Lint, Unit-Tests grün; `w2-layout` um 18 Sheet-Tests erweitert (375 und 320), 18/18 grün, gegen den älteren Build rot. Der vollständige E2E-Lauf nach den Nacharbeiten erfolgt zusammen mit Welle 3 (siehe dort), weil beide Stände im selben Arbeitsverzeichnis lagen.
- Screenshots aller Tabs und der Sheets Gewicht, Eintragen, Rezept, Kochmodus bei 375 und 320 angesehen.
- Code- und Design-Review durch eigenen Agenten: 0 kritisch, 0 hoch, 5 mittel, 5 niedrig. Behoben: toter Code im Dashboard, Umbruch in der Mahlzeiten-Liste, Symbol des Plan-FAB, FAB-Name im Test über den Shadow-Button, Sheet-Tests erweitert.

### Nicht geprüft
- Echtes iPhone: Safe Area, Tastatur, Wischgesten (Tagebuch-Zeilen, Sheets), Safari/WebKit.
- Dark Mode: Die App hat keinen (`color-scheme: light` in `variables.scss` und `index.html`). Nichts zu prüfen; falls gewünscht, ist das eine eigene Aufgabe.
- Tablet-Breiten.
- Sticky-Verhalten des Sheet-Fußes mit offener Tastatur.

### Offen (aus dem Review, zur Entscheidung)
- Alte Klassen `.nt-pill` und `.nt-add-btn` leben als Alias in `buttons.scss` weiter (noch 10 Verwendungen). Migration auf `.nt-btn` wäre konsequent, ändert aber viele Dateien.
- Vermutlich tote Stilregeln (`.page-head__add`, `.kcal-note`, `.share-btn`, `.own-btn`, `.generate-btn`, `.cancel-btn`, `.content-spacer` u. a.) sind nicht systematisch entfernt.
- Der FAB überdeckt je nach Scrollposition einzelne Werte; am Seitenende ist Platz frei. Normales FAB-Verhalten.
- Ein Toast mit "Rückgängig" kann den FAB kurz überdecken.
- `:has()` in `layout.scss`/`sheets.scss` braucht iOS 15.4 oder neuer; das Deployment-Target ist nicht geprüft (kein `ios/`-Ordner im Repo).
- Feste Wartezeiten in den neuen E2E-Tests.

## Welle 3: Funktionen (Branch `welle-3-funktionen`, nicht gemergt, Worker nicht ausgerollt)

### Geändert
- **Rezeptsuche-Abschnitt entfernt:** Einstellungs-Komponente und `recipe-search-config.store.ts` gelöscht; die Suche läuft nur noch über den Worker. Alte Speicherwerte räumt `core/state/legacy-storage-cleanup.ts` beim Start weg; der alte Schlüssel wird nie gesichert oder wiederhergestellt. Hinweise in Einkauf und Wochenplan verweisen nicht mehr auf "Profil › Rezeptsuche".
- **Ernährungsprofil:** `UserProfile.diet`, `intolerances`, `dislikes` (plus englische Entsprechung `dislikesEn`). Abschnitt "Ernährung" im Profil-Sheet. Online-Suche und Wochenplan filtern damit; Chip "Profil-Filter aktiv" in der Online-Suche schaltet den Filter ab und sucht dann neu. Logik in `core/diet/`.
- **Kochmodus:** je Schritt "Dafür brauchst du" (Zutaten des Schritts), auf Seite 1 "Du brauchst" (Utensilien). Logik in `core/cook/`.
- **Fastfood-Helfer:** 1 bis 4 Kriterien als Chips, Land (feste Auswahl, Vorgabe Österreich), "Weitere Vorschläge" ohne Wiederholungen (höchstens 4 Runden). KI-Antworten werden geprüft (`core/ai/fastfood-sanitize.ts`): Kalorien müssen zu den Makros passen, unplausible Einträge fallen weg, Vorschläge über dem Budget werden gekennzeichnet.
- **Worker (nur im Code):** Rezeptroute nimmt `intolerances` (feste Liste) und `excludeIngredients` (höchstens 200 Zeichen) an; Fastfood-Anfrage prüft `preferences`, `country` (feste Liste) und `exclude`, Steuerzeichen werden entfernt.

### Annahmen (ohne Rückfrage entschieden)
- Land steht direkt im Fastfood-Helfer und wird in den App-Einstellungen gemerkt, kein Standortzugriff.
- Vorschläge leicht über dem Budget (bis 5 %) bleiben ohne Kennzeichnung, darüber steht "über Budget"; sie werden nicht verworfen.
- Zutaten je Schritt und Utensilien sind Wortvergleiche (Heuristik). Fehlt ein Treffer, fehlt die Zeile; falsche Zuordnungen sind möglich.
- Unverträglichkeiten werden zusätzlich in der App gefiltert (Zutatennamen), weil der ausgerollte Worker den Parameter noch verwirft. Hinweis im Profil: Spuren und versteckte Zutaten werden nicht erkannt.
- Abneigungen werden für die Suche ins Englische übersetzt. Nebenwirkung: Begriffe, die in beiden Sprachen gleich lauten (z. B. "Avocado"), lösen den Hinweis "konnten nicht übersetzt werden" aus. Zur Entscheidung.

### Geprüft
- `tsc` 0 Fehler, Lint sauber, 1488 Unit-Tests grün, Build ok, Worker-Tests 87/87.
- E2E gegen den Produktions-Build: 274/276 im Gesamtlauf; die zwei roten Tests waren Testfehler (Filter-Chip sucht beim Umschalten selbst neu; Chip-Zustand wurde zu früh gelesen), korrigiert und danach `w3`-Specs zweimal 17/17. Kein zweiter Gesamtlauf nach dieser Korrektur.
- Screenshots Kochmodus und Fastfood-Helfer bei 375 und 320 px angesehen.
- Code-Review durch eigenen Agenten: 1 hoch (Unverträglichkeiten wirkten nur über den neuen Worker), 5 mittel, 2 niedrig, alle behoben.

### Nicht geprüft
- Echtes Gemini und echtes Spoonacular: alle Tests laufen gegen Mocks. Land, Ausschlussliste und `intolerances`-Parameter wirken serverseitig erst nach dem Worker-Deploy.
- Echtes iPhone (Chips, Auswahlfelder, Kochmodus mit Tastatur und Safe Area), Safari/WebKit.
- Qualität der Zutaten-Zuordnung im Kochmodus an echten Rezepten.

### Offen
- Im Fastfood-Helfer stehen "Weitere Vorschläge" und "Vorschläge holen" direkt übereinander; Design-Entscheidung offen.

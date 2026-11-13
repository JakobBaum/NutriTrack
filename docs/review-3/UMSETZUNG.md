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

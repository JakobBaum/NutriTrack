# Design-Review NutriTrack — 2026-11-04

**Werkzeuge:** `impeccable` (pbakaus/impeccable, Modus *Operate* + Craft-Floor + mechanischer Detector),
`make-interfaces-feel-better`, Playwright-Screenshots im iPhone-15-Viewport (WebKit).
Neu installiert und ab jetzt verfügbar: `impeccable`, `design-taste-frontend` (Leonxlnx/taste-skill),
`ui-ux-pro-max`.

## Umgesetzt (risikoarm, Identität bleibt)

| Prinzip | Vorher | Nachher | Datei |
|---|---|---|---|
| Native Controls | Zahlenfelder mit Desktop-Spin-Buttons | Spinner ausgeblendet, Ziffern-Tastatur reicht | `src/global.scss` |
| Tabellarische Ziffern | kcal/Makro-Zahlen springen beim Ändern | `font-variant-numeric: tabular-nums` | `src/global.scss` |
| Zeilenumbruch | Überschriften brechen unschön um | `text-wrap: balance` (Titel) / `pretty` (Text) | `src/global.scss` |
| Hierarchie | Abschnittstitel in Versalien mit Gewicht 800 („schreien“) | Gewicht 700, ruhiger | 5 Seiten-SCSS |
| Kontrast | Hinweis „kcal werden aus … berechnet“ ca. 2,6:1 | Slate-500, über 4,5:1 (WCAG AA) | `diary.page.*` |
| Browser-Oberflächen | Auswahl, Cursor und Fokus im Browser-Standard | in App-Farbe, sichtbarer `:focus-visible`-Ring | `src/global.scss` |
| Leerzustand | „Noch keine Rezepte.“ | erklärt Import und das +-Symbol | `recipes.page.html` |
| Zoom/A11y | `user-scalable=no` sperrte Pinch-Zoom (WCAG 1.4.4) | Zoom erlaubt | `src/index.html` |
| Meta | `lang="en"`, Titel „Ionic App“ | `lang="de"`, „NutriTrack“, `theme-color` | `src/index.html` |

Geprüft: impeccable-Detector 0 Funde, E2E 9/9 in WebKit/Firefox/Chromium, Lint sauber.

## Empfehlungen (deine Entscheidung)

1. **6 Tabs → 5.** iOS empfiehlt höchstens 5. „Mahlzeiten“ (gespeicherte Kombis) überschneidet sich mit
   „Rezepte“. Vorschlag: In „Rezepte“ ein Segment `Rezepte | Mahlzeiten`, dann hat die Tab-Leiste Luft
   und die Labels werden nicht gequetscht.
2. **Platzhalter-Links entfernen.** „Social Media“ zeigt auf instagram.com und „App bewerten“ führt ins
   Leere. Bis echte Ziele existieren, besser ausblenden, sonst wirkt die App unfertig.
3. **Eintrag-Dialog entschlacken.** Nach einem Suchtreffer sind die 6 Makro-Felder schon befüllt. Sie
   könnten standardmäßig zugeklappt sein („Nährwerte anpassen“), damit der Hauptweg nur
   Suchen → Menge → Speichern ist.
4. **KI-Ergebnisse kennzeichnen.** Ein kleines Badge „KI-Schätzung“ an Etikett-Scan, Fastfood-Vorschlägen
   und Einkaufsliste, im gleichen Stil wie die neue Quellenangabe.
5. **Inspiration.** refero.design (echte App-Screens, auch als Skill mit MCP nutzbar, Konto nötig) eignet
   sich für Food-Logging-Flows. godly.design und lapa.ninja sind eher Landingpage-Galerien und erst
   relevant, falls NutriTrack eine Website bekommt.

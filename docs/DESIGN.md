# Design-Briefing

Referenz: App **"Fin Fitnesstracker"** (Screenshots von Jakob, `IMG_6844`/`IMG_6845`).
Jakob: Richtung soll **dahin gehen — nicht das Layout kopieren**, aber **schlicht, modern, rund**.

## Design-Sprache (übernehmen)
- **Weiche, runde weiße Karten** auf hellem, leicht wärmlichem Hintergrund. Große Radien
  (~20–24px), dezente Schatten, viel Weißraum.
- **Kreis-Fortschrittsringe** als Kern-Visual: großer Ring für Kalorien ("0 / 2030 · übrig"),
  kleine Ringe je Makro (Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Zucker, Wasser) mit
  Icon in der Mitte + Label + "von X g" darunter.
- **Makro-Grid**: 3 Spalten, quadratische Karten mit Ring + Label + Zielangabe.
- **Bold, leicht kursive/condensed Headlines** für Section-Titel ("ESSEN", "HEUTE").
- **Datums-Navigation** oben: ‹ Heute › zum Tag wechseln.
- **Bottom-Tab-Bar** mit klaren Outline-Icons: Start · Training · Essen · Verlauf · Freunde
  (für NutriTrack-MVP eher: Dashboard · Essen/Tagebuch · Rezepte · Einkauf · Einstellungen).
- **Floating-Action-Button** (rund, Akzentfarbe) zum Hinzufügen von Mahlzeiten.
- Mahlzeiten-Zeilen (Frühstück/Mittag/…) mit Icon, Name, "0 / 610 kcal".

## Bewusst NICHT übernehmen
- Exaktes Layout / Gewinnspiel-Block / Maskottchen.
- Die rote/maroon Akzentfarbe ist optional — NutriTrack kann beim frischen Emerald bleiben
  ODER eine eigene, moderne Akzentfarbe wählen. Mit Jakob kurz abstimmen.

## Umsetzungshinweise (Ionic/Angular)
- Ringe: schlanke SVG-`circle`-Komponente (`stroke-dasharray`/`offset`) als wiederverwendbare
  `ProgressRingComponent` — kein schweres Chart-Lib.
- Tab-Shell: `ion-tabs` + `ion-tab-bar` (mobile-first), Routing auf Standalone-Pages.
- FAB: `ion-fab` unten rechts.
- Design-Tokens in `src/theme/variables.scss` (bereits angelegt: Radius, Shadow, Muted).
- Mobile-first: an Handy-Breakpoints (320–430px) gestalten, nicht am Desktop.

## Nächste Session — Reihenfolge
1. Tab-Shell + 5 Seiten-Gerüste im neuen Stil.
2. `ProgressRingComponent` + Dashboard ("Essen"-Screen nachempfinden: Kalorien-Ring + Makro-Grid).
3. Rechner wird zu Onboarding → speist das Dashboard-Ziel.
4. Dann Food-/KI-Adapter (siehe ARCHITECTURE/API-RESEARCH) anbinden.

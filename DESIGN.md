# NutriTrack Design System "S1 Sanft iOS"

iOS-nahe, helle, ruhige Oberflaeche. Quelle der Tokens: `src/theme/variables.scss`; Muster: `src/global.scss`.

## Regel Nr. 1: Nichts verschwindet
Kein Feature, keine Ansicht, Route, Schaltflaeche, Einstellung, kein Feld, Toast, Rueckgaengig, Leer-/Fehler-/Offline-Zustand,
KI-Kennzeichen, Datenquellen-Credit (ODbL) oder Test darf entfernt werden. Elemente duerfen nur verschoben, neu gestaltet oder
gruppiert werden. Vor jeder Seitenaenderung: alle interaktiven Elemente und angezeigten Daten auflisten, danach pruefen, dass
alle erreichbar sind. Naehrwerte, die S1 nicht als Ring zeigt, bleiben als kompakte Zeilen sichtbar (Heute zeigt alle sechs als Ringe).

## Tokens (primitiv -> semantisch -> Komponente)
| Rolle | Token | Wert | Kontrast |
|---|---|---|---|
| Grund | `--nt-ground` | #F7F5F1 (warm) | |
| Karte | `--nt-card` | #FFFFFF | |
| Tinte | `--nt-ink` | #1C1C1E | 16.8:1 |
| Sekundaer | `--nt-secondary` (`--nt-muted`) | #636366 | 5.5:1 auf Grund |
| Trenner | `--nt-separator` | #E7E3DA | |
| Spur (Ring/Balken) | `--nt-track`, alle `--nt-*-track` | #E6E2DA | |
| Tab inaktiv | `--nt-tab-inactive` | #48484A | 9.1:1 |
| Akzent / kcal | `--nt-accent`, `--nt-kcal` | #0F7A6B (Tint #E1F0EC; Text auf Tint #0D6B5E) | 5.2:1 auf Weiss, 4.8:1 auf Grund, 4.1:1 auf Spur |
| Eiweiss | `--nt-protein` | #5B4BC4 (Violett) | 6.5:1 auf Weiss, 5.0:1 auf Spur |
| Kohlenhydrate | `--nt-carbs` | #2563C9 | 5.7:1, 4.4:1 auf Spur |
| Fett | `--nt-fat` | #A15C07 | 5.2:1, 4.0:1 auf Spur |
| Ballaststoffe / Zucker / Wasser | `--nt-fiber` `--nt-sugar` `--nt-water` | #4C7A1E / #A3267F / #0A5F8A | >= 5:1, >= 4.0:1 auf Spur |
| Ueber Ziel / Gefahr | `--nt-over`, `--nt-danger` | #C62839 | 5.6:1, nur dafuer |

Radien: Karte 20, Sheet 28, Input 12, Kachel 16, Pille/Kapsel = Hoehe/2. Abstaende 4/8/12/16/20/24 (`--nt-space-1..6`).
Typo: Systemschrift, tabular-nums; 13 / 15 / 17 / 22 / 34, Hero 60 (kcal uebrig). Alt-Tokens (`--nt-radius`, `--nt-text-accent`, `--nt-surface`,
`--nt-bg`, `--nt-border` ...) bleiben als Aliase gueltig. Dunkelmodus ist aus (`color-scheme: light`); semantische Namen erlauben spaeter ein Dark-Set.

## Komponenten und Muster
- `.nt-grouped`: inset gruppierte Karte (Radius 20, Zeilen >= 44 px, 0.5px Trenner eingerueckt); `.nt-grouped__chevron` fuer Drill-in.
- `.nt-section-header`: 13 px, Grossbuchstaben, secondary, ueber einer Gruppe.
- `.nt-card`: freistehende weisse Karte. `.nt-large-title`, `.nt-subtitle`: Seitenkopf.
- `.nt-pill` (primaer = Akzent, `.nt-pill--secondary` = Tint), Hoehe 44. Ionic-Buttons sind Pillen; destruktiv behaelt Danger.
- `.nt-input` / `ion-searchbar.nt-searchbar`: Radius 12, Fokus mit 2px Akzent-Ring.
- `ion-modal` (nicht Vollbild): Sheet, oben Radius 28, Grabber. Vollbild-Modals (Barcode, Kochmodus) bleiben.
- `ion-segment` (iOS): Spur rgba(118,118,128,.12), Radius 9, 44 px hoch, aktiver Reiter weiss (Radius 7, kleiner Schatten), keine Grossbuchstaben.
- `<app-progress-ring [value] [max] [color] [track] [size] [stroke]>` (`src/app/shared/progress-ring`): Einzelring, Inhalt per Projektion (Heute: 68 px, Strich 6, Gramm im Ring); Ueberschreitung faerbt in `--nt-over`.
- Tab-Bar: schwebende Kapsel (16 seitlich, Safe-Area + 8 unten, Hoehe 64, weiss 85 % + Blur, 0.5px Ring, weicher Schatten), aktiver Tab = weisse Pille mit Akzent-Text, Labels 13 px.
  Tab-Inhalt bekommt unten Platz (`ion-tabs ion-content`).

## Regeln
- Touch-Ziele >= 44 px; Fokusringe sichtbar (2px Akzent); `prefers-reduced-motion` wird respektiert.
- Keine Verlaeufe, kein Glow, keine Emojis. Farbe traegt Bedeutung (Naehrwert/Status), nie Dekoration.
- Text auf Flaechen >= 4.5:1, Ringe/Balken gegen Spur >= 3:1.
- Heute: Grosstitel + "+ Eintragen"-Pille (ersetzt den FAB, gleiche Aktion); Hero ohne Karte (kcal uebrig 60 px in Akzent, rechts gegessen / Ziel; Hero oeffnet den Kalorien-Drill); weisse Karte mit 3 x 2 Ringen (Kalorien, Eiweiss, Kohlenhydrate / Fett, Ballaststoffe, Zucker; je 68 px, Strich 6, Wert im Ring, Label + "gegessen / Ziel Einheit" darunter), je Kachel ein Button zum Drill; Mahlzeiten und Helfer als gruppierte Listen mit Chevron. Kein Tag/Woche-Umschalter (es gibt keine Wochenansicht).

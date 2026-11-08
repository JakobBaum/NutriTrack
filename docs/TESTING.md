# Testing und Dev-Prozess

Reihenfolge fuer jeden Baustein. Stand: Welle 6 (2026-11-08).

## 1. Entwickeln
- Reine Logik in `src/app/core/**` (ohne UI-Abhaengigkeit, gut testbar).
- UI je Feature-Ordner unter `src/app/` (`dashboard`, `diary`, `meals`, `recipes`, `shopping`, `settings`, `tabs`, `shared`).
- Angular-Konventionen: Signals, `inject()`, OnPush, `track` in jedem `@for`.

## 2. Unit-Tests (Vitest ueber `ng test`)
Testdateien liegen neben dem Code als `*.spec.ts`. Test-Setup: `src/test-setup.ts`.
```bash
npx ng test --watch=false      # alle Tests einmal (wie in CI)
npx ng test                    # Watch-Modus waehrend der Entwicklung
```
Richtwert: mindestens 80 % Abdeckung der Kernlogik (Rechnen, Mapping, Validierung, Stores).
Beispiel: `src/app/core/nutrition/nutrition-calc.service.spec.ts`.

## 3. Worker- und Skript-Tests (Node)
```bash
node --test worker.test.mjs                 # = npm run test:worker
node --test scripts/sync-version.test.mjs   # = npm run test:scripts
```

## 4. Typecheck und Build
```bash
npx tsc -p tsconfig.app.json --noEmit   # Typfehler ohne Build
npm run build                           # Capacitor-Build nach www/
npm run build:pages                     # Pages-Build nach dist/pages/browser (base-href /NutriTrack/)
```
`www/` ist das `webDir` von Capacitor (`npx cap sync`). Der Pages-Build schreibt bewusst woanders hin.

## 5. Lokal starten
```bash
npm start      # Dev-Server, http://localhost:4200
```
Im Browser manuell pruefen (DevTools, Geraet emulieren). Visuelle Checks bei 320 / 375 / 768 / 1024 px.

## 6. E2E (Playwright-Harness in `e2e/`)
Erwartet einen laufenden Dev-Server (`E2E_BASE_URL`, Standard `http://localhost:4300`).
```bash
npm start -- --port 4300
node e2e/run.mjs            # alle Specs (app, diary, recipes, weekplan)
node e2e/run.mjs diary      # nur Tests, deren Name "diary" enthaelt
```
Screenshots und `results.json` landen in `e2e/artifacts/`. E2E laeuft nicht in CI.

## 7. Manuelle Checkliste (vor Release)
- Profil speichern, Tagesziel plausibel; Abnehmen/Zunehmen blendet Tempo ein.
- Heute: Ringe fuellen sich nach Eintraegen; Datum wechseln.
- Tagebuch: Eintrag per Suche/Barcode/Mahlzeit; Loeschen und Rueckgaengig.
- Rezepte/Wochenplan: anlegen, in Tagebuch loggen, Wochenplan erzeugen.
- Einkauf: Liste aus Plan, abhaken, ergaenzen.
- Backup exportieren und wieder importieren.
- Native: Kamera/Barcode und Etikett-Scan auf echtem Geraet (iOS und Android).

## 8. KI-Flows ohne Kosten
`MockAiProvider` liefert deterministische Antworten (kein Key, keine Netzwerkkosten) und verweigert Foto- und Link-Import ehrlich. Fuer echte KI laeuft alles ueber den Worker (`docs/KI-WORKER.md`). Keys nie committen.

## 9. CI (GitHub Actions)
`.github/workflows/deploy-pages.yml`: Job `ci` (tsc, `ng test --watch=false`, Worker-Tests, Skript-Tests, Versions-Check) laeuft bei jedem Push und Pull Request. Der Pages-Deploy folgt nur bei gruenem CI und nur auf `main`. Release und TestFlight: `docs/RELEASE.md`.

## 10. Abschluss je Baustein
```bash
npx tsc -p tsconfig.app.json --noEmit && npx ng test --watch=false && node --test worker.test.mjs && npm run build
```
Dann `docs/ROADMAP.md` abhaken und das Projekt-Memory aktualisieren.

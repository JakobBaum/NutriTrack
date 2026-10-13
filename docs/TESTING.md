# Testing & Dev-Prozess

Ein echter App-Entwicklungs-Zyklus für NutriTrack — in dieser Reihenfolge.

## 1. Entwickeln (Code)
- Neue Logik in Services unter `src/app/core/**` (pur, ohne UI-Abhängigkeit → gut testbar).
- UI in `src/app/features/**` bzw. aktuell `src/app/home/`.
- Angular-Konventionen: standalone-Components wo möglich, `inject()`, Signals, OnPush.

## 2. Unit-Tests (Vitest) — RED → GREEN → REFACTOR
Testdateien liegen neben dem Code als `*.spec.ts`.
```bash
# Alle Tests einmal ausführen
npx vitest run

# Nur einen Pfad/Ordner
npx vitest run src/app/core/nutrition

# Watch-Modus während der Entwicklung
npx vitest
```
Richtwert: ≥80 % Abdeckung der Kernlogik (Rechnen, Mapping, Validierung).
Beispiel vorhanden: `src/app/core/nutrition/nutrition-calc.service.spec.ts` (9 Tests, grün).

## 3. Build-Verifikation
```bash
npm run build          # Production-Build; muss fehlerfrei nach www/ bauen
```
Immer vor Commit/Merge grün halten.

## 4. App lokal starten (Browser)
```bash
npm start              # Dev-Server auf http://localhost:4200
```
Im Browser manuell testen (DevTools → Gerät emulieren für mobile Ansicht).
Aktuell sichtbar: **Bedarfsrechner** — Werte eingeben → „Bedarf berechnen" → kcal + Makros.

## 5. Manuelle Test-Checkliste (MVP, wächst mit)
- [x] Profil (Tab „Profil"): eingeben → „Bedarf berechnen" → plausibles Tagesziel
- [x] Ziel „Abnehmen/Zunehmen" → Tempo-Feld erscheint, Defizit/Überschuss wirkt
- [x] Dashboard: Kalorienring + Makro-Grid füllen sich nach Einträgen; Datum wechseln
- [x] Tagebuch: Eintrag per „+"/Modal erfassen → Tagessumme steigt; löschen funktioniert
- [x] Rezepte: anlegen → „Tagebuch" loggt eine Portion; bearbeiten/löschen
- [x] Einkauf: „Liste generieren" → Positionen; abhaken/ergänzen/löschen
- [ ] (später) Mahlzeit per Food-Textsuche/Barcode/Etikett-Scan eintragen
- [ ] (später) Rezept-Import (URL/TikTok/Foto) → Rezept in Liste

## 6. KI-Flows ohne Kosten testen
`MockAiProvider` liefert deterministische Antworten (kein Key, keine Netzwerkkosten).
Für End-to-End mit echter KI: Key/Endpoint in den App-Einstellungen hinterlegen
(`ClaudeAiProvider`). Niemals Keys committen.

## 7. Native Builds (später, Capacitor)
```bash
npx cap add android
npx cap add ios
npm run build && npx cap sync
npx cap run android      # bzw. ios (macOS/Xcode nötig)
```
Kamera-/Scanner-Permissions in den nativen Projekten deklarieren.

## 8. E2E / Smoke (Playwright)
Ein Browser-Smoke-Test prüft die Kern-Flows gegen den laufenden Dev-Server
(Tab-Navigation, Profil speichern, Dashboard-Ringe, Tagebuch-Eintrag, Einkaufsliste)
und erfasst Konsolen-/Laufzeitfehler + Screenshots.
```bash
npm start                      # Dev-Server starten
npx playwright install chromium
# Smoke-Skript gegen http://127.0.0.1:8100 laufen lassen (siehe Projekt-Memory)
```
Visuelle Checks an Breakpoints 320/375/768/1024.

## 9. Abschluss je Baustein
```bash
npx vitest run && npm run build      # beide grün?
git add -A && git commit -m "feat: <was>"
```
Danach `docs/ROADMAP.md` abhaken und `memory\projects\nutritrack.md` aktualisieren.

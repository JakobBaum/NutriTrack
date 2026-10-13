# Roadmap & Task-Liste

Status-Legende: [ ] offen · [~] in Arbeit · [x] fertig

## Phase 0 — Fundament
- [x] Git-Repo, Scaffold (Ionic/Angular 22, Capacitor 8), npm install
- [x] Doku: README, ARCHITECTURE, API-RESEARCH
- [~] Doku: DATA-MODEL, ROADMAP, PRD, Projekt-CLAUDE.md
- [x] Domain-Modelle (`core/models/*`)
- [x] Adapter-Interfaces + DI-Tokens (`core/ai/ai-provider.ts` + `AI_PROVIDER`, `core/food/food-provider.ts` + `FOOD_PROVIDER`)
- [x] `OpenFoodFactsProvider` (Text + Barcode); `CompositeFoodProvider` folgt bei 2. Quelle
- [x] `NutritionCalcService` (Mifflin-St Jeor, Makro-Splits, Ziel) (+ Tests)
- [x] `StorageService` (localStorage; später Preferences/SQLite) + Signal-Stores (`core/state`)
- [x] `MockAiProvider` + `ClaudeAiProvider` + `AiService`-Router (Vision, Schema-Guard, Modell-Routing)

## Phase 1 — MVP-Kern (UI)
- [x] Tab-Shell + Routing (Heute/Dashboard, Tagebuch, Rezepte, Einkauf, Profil)
- [x] Onboarding/Profil → Bedarf berechnen (in „Profil")
- [x] Dashboard: Kalorien + Makro-Fortschritt (gegessen/übrig), Mahlzeiten des Tages
- [x] Diary: Mahlzeit hinzufügen (manuell + **Food-Textsuche OpenFoodFacts**), löschen, Tagessumme
- [x] Rezepte: anlegen/bearbeiten/löschen, ins Tagebuch loggen
- [x] Einkaufsliste: Wocheneinkauf (Personen×Tage×Mahlzeiten×Budget) + Schätzpreise, abhaken/ergänzen
- [x] Hellblaues Design-System + `ProgressRingComponent`
- [x] Etikett-Scan (Foto-Upload **+ native Kamera** via `@capacitor/camera` → `AiProvider.recognizeLabel`)
- [x] Fastfood-Helfer (kcal-/Geld-Budget + Kette → proteinreiche Vorschläge → Tagebuch)
- [x] Barcode-**Scanner-UI** (`@zxing/browser` Live-Scan + manuelle Eingabe → `lookupByBarcode`)

## Phase 2 — Erweiterung
- [ ] Rezepte: Liste, erstellen/bearbeiten, Nährwert-Summe
- [ ] Rezept-Import: URL (JSON-LD), TikTok, Foto, Text (AiProvider)
- [ ] Einkaufsliste aus #Gerichte + #Personen generieren
- [ ] Fastfood-Helfer (kcal-Ziel + Kette → Empfehlungen)
- [ ] Einstellungen: KI-Key/Endpoint, Provider-Auswahl, Profil, Bedarf neu berechnen

## Phase 3 — Politur / Native
- [ ] Design-Pass (eigenständig, nicht Template-Default; Theme, Hierarchie, Motion)
- [x] Capacitor Android/iOS Projekte angelegt (`cap add`), Kamera-Permissions gesetzt
      (Android `CAMERA`, iOS `NSCameraUsageDescription` + Photo-Library); native Projekte versioniert
- [ ] Native Build/Signierung (Android Studio / Xcode auf Mac), Icons/Splash, Store-Release
- [ ] Offline-Robustheit, Cache-Invalidierung
- [ ] E2E (kritische Flows), Visual Checks

## Querschnitt (laufend)
- [ ] Unit-Tests (Vitest) ≥80% Kernlogik
- [ ] Fehlerbehandlung + Grenzvalidierung externer Antworten
- [ ] Git-Commits pro Baustein (conventional commits)
- [ ] PersonalOS-Projektmemory aktuell halten

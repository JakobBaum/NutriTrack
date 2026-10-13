# Roadmap & Task-Liste

Status-Legende: [ ] offen · [~] in Arbeit · [x] fertig

## Phase 0 — Fundament
- [x] Git-Repo, Scaffold (Ionic/Angular 22, Capacitor 8), npm install
- [x] Doku: README, ARCHITECTURE, API-RESEARCH
- [~] Doku: DATA-MODEL, ROADMAP, PRD, Projekt-CLAUDE.md
- [x] Domain-Modelle (`core/models/*`)
- [ ] Adapter-Interfaces + DI-Tokens (`core/ai/ai-provider.ts`, `core/food/food-provider.ts`)
- [ ] `OpenFoodFactsProvider` + `CompositeFoodProvider` (+ Tests)
- [x] `NutritionCalcService` (Mifflin-St Jeor, Makro-Splits, Ziel) (+ Tests)
- [x] `StorageService` (localStorage; später Preferences/SQLite) + Signal-Stores (`core/state`)
- [ ] `MockAiProvider` + `ClaudeAiProvider` (Grundgerüst + Vision + Schema-Guard)

## Phase 1 — MVP-Kern (UI)
- [x] Tab-Shell + Routing (Heute/Dashboard, Tagebuch, Rezepte, Einkauf, Profil)
- [x] Onboarding/Profil → Bedarf berechnen (in „Profil")
- [x] Dashboard: Kalorien + Makro-Fortschritt (gegessen/übrig), Mahlzeiten des Tages
- [x] Diary: Mahlzeit manuell hinzufügen, löschen, Tagessumme (Food-Textsuche folgt)
- [x] Rezepte: anlegen/bearbeiten/löschen, ins Tagebuch loggen
- [x] Einkaufsliste: aus #Gerichte + #Personen lokal generieren, abhaken/ergänzen
- [x] Hellblaues Design-System + `ProgressRingComponent`
- [ ] Barcode-Scan → OpenFoodFacts → Eintrag
- [ ] Etikett-Scan (Foto → AiProvider.recognizeLabel, per100g/perPortion)

## Phase 2 — Erweiterung
- [ ] Rezepte: Liste, erstellen/bearbeiten, Nährwert-Summe
- [ ] Rezept-Import: URL (JSON-LD), TikTok, Foto, Text (AiProvider)
- [ ] Einkaufsliste aus #Gerichte + #Personen generieren
- [ ] Fastfood-Helfer (kcal-Ziel + Kette → Empfehlungen)
- [ ] Einstellungen: KI-Key/Endpoint, Provider-Auswahl, Profil, Bedarf neu berechnen

## Phase 3 — Politur / Native
- [ ] Design-Pass (eigenständig, nicht Template-Default; Theme, Hierarchie, Motion)
- [ ] Capacitor Android/iOS Projekte, Plugin-Permissions (Kamera)
- [ ] Offline-Robustheit, Cache-Invalidierung
- [ ] E2E (kritische Flows), Visual Checks

## Querschnitt (laufend)
- [ ] Unit-Tests (Vitest) ≥80% Kernlogik
- [ ] Fehlerbehandlung + Grenzvalidierung externer Antworten
- [ ] Git-Commits pro Baustein (conventional commits)
- [ ] PersonalOS-Projektmemory aktuell halten

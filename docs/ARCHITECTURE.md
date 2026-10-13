# Architektur

## Überblick
NutriTrack ist eine Ionic-8/Angular-22-App (standalone-fähig) mit Capacitor-6/8-Nativebrücke.
Die App ist **offline-first** (lokale Persistenz) und spricht externe Dienste nur über
**austauschbare Adapter** an. Zwei Adapter-Familien sind zentral:

1. **AI-Provider** (`AiProvider`) — KI-Aufgaben: Etikett-/Foto-Erkennung, Rezept-Import-Parsing,
   Bedarfsberechnung, Einkaufslisten-Generierung, Fastfood-Empfehlungen.
2. **Food-Provider** (`FoodProvider`) — Lebensmittel-/Nährwertdaten per Barcode oder Textsuche.

Beide folgen dem **Repository-/Strategy-Pattern**: Die App-Logik hängt an einem Interface,
die konkrete Implementierung (Claude, OpenFoodFacts, …) ist gekapselt und konfigurierbar.

## Schichten
```
UI (Pages, Components)          Ionic/Angular, signals, standalone
  │
Facade / State (Signal Stores)  DiaryStore, RecipeStore, ProfileStore, ShoppingStore
  │
Domain Services                 NutritionCalcService, DiaryService, RecipeService, ...
  │
Adapter-Layer                   AiProvider (Token: AI_PROVIDER)
                                FoodProvider (Token: FOOD_PROVIDER, Chain mehrerer Quellen)
  │
Infrastruktur                   StorageService (Capacitor Preferences/SQLite),
                                HttpClient, Camera, BarcodeScanner
```

## AI-Provider-Abstraktion
Interface `AiProvider` (siehe `src/app/core/ai/ai-provider.ts`):
- `recognizeLabel(image, mode: 'per100g'|'perPortion'): Promise<NutritionFacts>`
- `importRecipe(input: { url?; imageBase64?; text? }): Promise<Recipe>`
- `calculateNeeds(profile): Promise<DailyTarget>`
- `generateShoppingList(req): Promise<ShoppingList>`
- `suggestFastFood(req): Promise<FastFoodSuggestion[]>`

Konkreter Default-Adapter: **`ClaudeAiProvider`** (Anthropic Messages API, Vision für Etiketten).
Endpoint + Key kommen aus `SettingsService` (lokal gespeichert, nie im Repo).
Austausch über Angular-DI-Token `AI_PROVIDER` — ein weiterer Anbieter ist ein neues
`AiProvider`-Objekt, App-Code bleibt unverändert.

Zum Testen kann ein **`MockAiProvider`** registriert werden (deterministische Antworten,
keine Netzwerkkosten).

## Food-Provider-Abstraktion
Interface `FoodProvider`:
- `findByBarcode(code): Promise<FoodItem | null>`
- `search(query): Promise<FoodItem[]>`

Default: **`OpenFoodFactsProvider`** (kostenlos, kein Key). Weitere Provider (USDA, Nutritionix,
Edamam, FatSecret — siehe `API-RESEARCH.md`) werden als zusätzliche `FoodProvider` registriert.
`CompositeFoodProvider` fragt die Quellen in Prioritätsreihenfolge ab (erste Trefferquelle
gewinnt; Fallback-Kette), damit "so viele Schnittstellen wie möglich" nutzbar sind.

## Persistenz
`StorageService` kapselt Capacitor **Preferences** (Settings, Keys) und **SQLite** bzw.
IndexedDB (Diary-Einträge, Rezepte, Cache von Food-Lookups). Alles lokal; keine Cloud im MVP.

## Scan-Pipeline
- **Barcode:** `@capacitor-mlkit/barcode-scanning` → `FoodProvider.findByBarcode`.
- **Etikett:** `Camera` → Foto → `AiProvider.recognizeLabel` (Vision) → `NutritionFacts`.
- **Foto-Rezept:** `Camera` → Foto → `AiProvider.importRecipe({ imageBase64 })`.

## Fehlerbehandlung & Validierung
- Alle externen Antworten werden an der Grenze validiert (Schema-Guards in `core/validation`).
- Netzwerkfehler → nutzerfreundliche Meldung + Retry-Option; Rohfehler nur geloggt.
- KI-Antworten werden gegen erwartetes JSON-Schema geprüft, bevor sie persistiert werden.

## Sicherheit
- Keine Secrets im Repo; Keys lokal via Preferences.
- Eingaben (Barcodes, URLs für Rezept-Import) werden vor Requests validiert (SSRF-Schutz
  bei URL-Import: nur http/https, keine privaten IP-Ranges).

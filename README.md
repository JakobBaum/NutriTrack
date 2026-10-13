# NutriTrack

Kalorien- & Ernährungs-Tracker für iOS und Android. Schlanke, KI-gestützte Alternative
zu "Fitness Tracker": Kalorien/Makros tracken per Barcode-, Etiketten- und Foto-Scan,
Rezepte erstellen/importieren, Einkaufslisten generieren, Fastfood-Helfer.

## Stack
- **Ionic 8 + Angular (standalone components, signals)** — ein Codebase für iOS + Android
- **Capacitor 6** — native Kamera, Barcode-Scanner, lokale Persistenz
- **OpenFoodFacts** als kostenloser Default-Food-Provider (weitere Provider über Adapter)
- **KI-Service-Layer** mit austauschbarem Anbieter; Default-Adapter: Claude (Anthropic)

## Status
Siehe `docs/ROADMAP.md`. Aktuelle Phase: Projekt-Setup + MVP-Kern.

## Setup
```bash
npm install
npm start            # Dev-Server (Browser)
npm test             # Unit-Tests (Karma/Jasmine)
npx cap sync         # Native Projekte synchronisieren
```

## Doku
- `docs/PRD.md` — Produktanforderungen & Features
- `docs/ARCHITECTURE.md` — System-Architektur, KI- & Food-API-Layer
- `docs/API-RESEARCH.md` — recherchierte Schnittstellen (Food/Barcode/Rezept)
- `docs/DATA-MODEL.md` — Domain-Modelle
- `docs/ROADMAP.md` — Phasenplan & Task-Liste

## Konfiguration
KI-Key/Endpoint und Provider-Keys werden in der App unter **Einstellungen** gepflegt
und lokal (verschlüsselt via Capacitor Preferences) gespeichert. Keine Secrets im Repo.

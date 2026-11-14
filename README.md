# NutriTrack

Kalorien- & Ernährungs-Tracker für iOS und Android. Schlanke, KI-gestützte Alternative
zu "Fitness Tracker": Kalorien/Makros tracken per Barcode-, Etiketten- und Foto-Scan,
Rezepte erstellen/importieren, Einkaufslisten generieren, Fastfood-Helfer.

## Stack
- **Ionic 8 + Angular (standalone components, signals)** — ein Codebase für iOS + Android
- **Capacitor 8** — native Kamera, Barcode-Scanner, lokale Persistenz
- **OpenFoodFacts** als kostenloser Default-Food-Provider (weitere Provider über Adapter)
- **KI über einen Cloudflare Worker** (`worker.js`) mit Google Gemini; die App enthält keine KI-Schlüssel (siehe `docs/KI-WORKER.md`)

## Status
Siehe `docs/ROADMAP.md`. Aktuelle Phase: **MVP-Gerüst steht** (Tab-Shell + Kernseiten,
lokale Persistenz, hellblaues Design). Als Nächstes: KI-/Food-Adapter + Scan-Funktionen.

### Was ist gebaut (MVP-Gerüst)
- **Tab-Shell** (`ion-tabs`) mit 5 Seiten: Heute (Dashboard), Tagebuch, Rezepte, Einkauf, Profil.
- **Dashboard**: großer Kalorien-Fortschrittsring + Makro-Grid (Eiweiß/Kohlenh./Fett/Ballast./Zucker),
  Mahlzeiten-Übersicht, Datums-Navigation.
- **Tagebuch**: Einträge je Mahlzeit erfassen (Modal) und löschen; Tagessumme.
- **Rezepte**: anlegen/bearbeiten/löschen, ins Tagebuch loggen; KI-Import als Stub vorbereitet.
- **Einkauf**: Liste aus #Gerichte + #Personen generieren (lokal aus Rezepten), abhaken/ergänzen.
- **Profil**: Bedarf berechnen (Mifflin-St Jeor) + speichern, KI-Verbindungsstatus, Daten-Reset.
- **State**: Signal-Stores (`core/state`) + schlanker `StorageService` (aktuell `localStorage`,
  später austauschbar gegen Capacitor Preferences/SQLite).
- **Wiederverwendbar**: `ProgressRingComponent` (SVG, kein Chart-Lib).

## Setup
```bash
npm install
npm start            # Dev-Server (Browser, http://localhost:8100)
npm test             # Unit-Tests (Vitest)
npm run build        # Produktions-Build
npx cap sync         # Native Projekte synchronisieren
```

## Doku
- `docs/PRD.md` — Produktanforderungen & Features
- `docs/ARCHITECTURE.md` — System-Architektur, KI- & Food-API-Layer
- `docs/API-RESEARCH.md` — recherchierte Schnittstellen (Food/Barcode/Rezept)
- `docs/DATA-MODEL.md` — Domain-Modelle
- `docs/ROADMAP.md` — Phasenplan & Task-Liste

## Konfiguration
Die App speichert keine API-Schlüssel. Gemini- und Spoonacular-Schlüssel liegen nur als Secrets im
Cloudflare Worker (`docs/KI-WORKER.md`); die Worker-Adresse steht in `src/environments/`. Keine Secrets im Repo.

## Hinweise zum Betrieb
- Repository und Web-Version (GitHub Pages) sind als öffentlich zu behandeln. Der Worker ist ohne Anmeldung erreichbar und kann damit von jedem genutzt werden; Schutz bieten Rate-Limit und Tagesdeckel.
- Gemini: Laut Google-Bedingungen im EWR nur mit bezahltem Tarif. Welcher Tarif läuft, muss der Betreiber prüfen.
- Spoonacular-Antworten werden im Worker höchstens 1 Stunde zwischengespeichert.
- Rechtliche Einordnung und Store-Angaben: `docs/STORE-PRIVACY.md` (keine Rechtsberatung).

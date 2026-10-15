# API-Recherche — Schnittstellen

Ziel: so viele nutzbare Schnittstellen wie möglich über Adapter einbinden. Default ist immer
die kostenlose, keyfreie Quelle; weitere werden als zusätzliche Provider in die Fallback-Kette
(`CompositeFoodProvider`) eingehängt.

## Lebensmittel / Barcode

| Provider | Kosten | Key | Barcode | Textsuche | Hinweise |
|----------|--------|-----|---------|-----------|----------|
| **OpenFoodFacts** | frei | nein | ja | ja | Default. Weltweite, offene DB. `https://world.openfoodfacts.org/api/v2/product/{barcode}.json` und `/api/v2/search`. Nährwerte pro 100g + Portion. |
| USDA FoodData Central | frei | ja (gratis) | nein | ja | Sehr präzise Composition-Daten (v.a. US/Rohware). `api.nal.usda.gov/fdc/v1`. |
| Nutritionix | freemium | ja | ja | ja (NLP) | "Natural language" ("2 eggs and toast") + UPC-Lookup. Gut für Fastfood-Ketten. |
| Edamam Food DB + Nutrition | freemium | ja | ja | ja | Food Database API + Nutrition Analysis API (Rezept-Nährwerte). |
| FatSecret Platform | freemium | ja (OAuth) | ja | ja | Große Marken-/Restaurant-DB. OAuth 1.0a/2.0. |

**Strategie:** OpenFoodFacts zuerst (frei). Kein Treffer → USDA/Nutritionix/Edamam/FatSecret
sofern Key hinterlegt. Ergebnisse werden auf das interne `FoodItem`/`NutritionFacts`-Schema
gemappt und lokal gecacht.

**Barcode kommt IMMER aus der API, nie aus der KI.** `lookupByBarcode` → OpenFoodFacts
`/api/v2/product/{code}.json` (bzw. USDA UPC-Suche als Fallback). Die KI (`recognizeLabel`)
wird ausschließlich für das Foto-Etikett genutzt, wenn kein Barcode vorhanden ist.

### Bundeslebensmittelschlüssel (BLS) 4.0 — Max Rubner-Institut
- Deutschlands offizielle Nährwert-DB für **unverpackte** Lebensmittel (Rohware, Gerichte),
  ~7.140 Einträge, bis zu 138 Nährwerte je Lebensmittel. **Seit Ende 2025 kostenlos** (CC BY 4.0).
- Offizielle DB/Download: `https://www.blsdb.de/` (Datensatz-Extrakt, kein offizieller Live-API).
- Dritt-REST-API: `https://www.naehrwerte.io/` (JSON) — **Registrierung/Key erforderlich**.
- **Integration:** als key-konfigurierbarer Provider in die Food-Kette (aktiv, sobald Key gesetzt);
  alternativ offiziellen Datensatz-Auszug bündeln (wie die Referenz-App). Status: vorbereitet.

## Preise (echte Supermarktpreise)

| Provider | Kosten | Key | Keyed by | Hinweise |
|----------|--------|-----|----------|----------|
| **Open Prices** (OpenFoodFacts) | frei | nein (nur Lesen) | Barcode / Kategorie | `https://prices.openfoodfacts.org/api/v1/prices?product_code={barcode}&order_by=-date`. Von der Community erfasste reale Preise inkl. Markt/Datum/Währung. Schreiben braucht Auth. |

- **Integration:** `OpenPricesProvider` liefert zu einem Barcode den letzten/durchschnittlichen
  realen Preis (EUR), wird im Barcode-/Zutaten-Ergebnis angezeigt. Für generische
  Einkaufslisten-Posten (ohne Barcode) bleibt die KI-/Heuristik-Schätzung, bis ein Produkt
  verknüpft ist. Ersetzt schrittweise die reinen Schätzpreise (`docs/FEATURE-REQUESTS.md` §2).
- Antwort (relevante Felder): `items[] = { price, currency, product_code, price_per, date, location_id }`.

## Rezept-Import (URL / TikTok / Webseite / Foto)

| Quelle | Methode |
|--------|---------|
| Webseiten mit **schema.org/Recipe** (JSON-LD) | Direktes Parsen von `application/ld+json` → Zutaten/Mengen/Schritte. Deckt die meisten Foodblogs ab. |
| Beliebige Webseite ohne Markup | HTML holen → **AiProvider.importRecipe({ url, text })** parst Freitext. |
| **TikTok** | oEmbed/og-Metadaten + Caption-Text → AiProvider parst; optional Transkript falls verfügbar. |
| **Foto** eines Rezepts | Kamera → Base64 → **AiProvider.importRecipe({ imageBase64 })** (Vision). |
| Spoonacular (optional) | `extract recipe from URL`, Zutaten-Parsing. Freemium, Key. |

**SSRF-Schutz:** Nur `http(s)`-URLs, keine privaten/Loopback-IP-Ranges; Timeout + Größenlimit.

## Nährwert-Etikett-Erkennung
- Kamera-Foto → **AiProvider.recognizeLabel(image, mode)** (Vision).
- `mode`: `per100g` oder `perPortion` (Nutzerauswahl), damit die Werte korrekt skaliert werden.
- Fallback/Alternative OCR: ML Kit Text Recognition (on-device) + Heuristik-Parser, falls
  kein KI-Key gesetzt ist.

## KI-Anbieter (AI_PROVIDER)
- **Default: Anthropic Claude Messages API** (Vision-fähig für Etikett/Foto).
  Modell-ID aktuell z.B. `claude-opus-4-8` / `claude-sonnet-4-6` (kostengünstiger für Routine).
- Key/Endpoint in App-Einstellungen (lokal). Austauschbar durch weiteren `AiProvider`.
- Test ohne Kosten: `MockAiProvider`.

## Fastfood-Daten
- Primär Nutritionix (gute Restaurant-/Branded-Abdeckung) oder FatSecret.
- Fallback: `AiProvider.suggestFastFood` mit bekanntem Menü-Wissen + Kalorien-/Protein-Ziel.

## Capacitor-Plugins (nativ)
`@capacitor/camera`, `@capacitor-mlkit/barcode-scanning`, `@capacitor/preferences`,
`@capacitor-community/sqlite` (optional), `@capacitor/filesystem` (Foto-Cache).

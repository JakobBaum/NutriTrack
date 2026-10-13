# Feature-Wünsche (Jakob, 2026-10-13) + Machbarkeit

Erfasst aus Jakobs Zuruf. Reihenfolge = grobe Priorität. Status: Wunsch, noch nicht gebaut.

## 1. Intelligente Einkaufslisten-Generierung
**Wunsch:** Eingabe = wie viele **Personen**, für wie viele **Tage**, welche **Mahlzeiten**
(nur Abendessen ODER Mittag+Abend …) und ein **Budget** (wie viel Geld). Daraus eine
Einkaufsliste — aus **gespeicherten Rezepten** oder **Vorschlägen aus einer Datenbank**.
Mengen zusammenfassen (z.B. „2× Knoblauch" → eine Position).

**Machbar:** Ja. Erweiterung von `shopping-generator.ts` (Personen → Personen×Tage×Mahlzeiten)
+ KI-Pfad (`AiProvider.generateShoppingList`) für Vorschläge, wenn Rezepte fehlen oder Budget
Umplanung erzwingt. Mengen-Merge gibt es im Kern schon.

## 2. Supermarkt-Auswahl + Preise (Spar / Lidl / Hofer / Billa)
**Wunsch:** Laden wählen (Spar/Lidl/Hofer/Billa) → Optionen, die in die **Preiskategorie**
passen, echte Preise, Liste automatisch zusammenstellen, Gesamtkosten.

**⚠ Hindernis (ehrlich):** Es gibt **keine offiziellen, öffentlichen Preis-APIs** dieser
(österreichischen) Supermärkte. Realistische Optionen:
- **(a) KI-Schätzpreise:** Claude schätzt typische Preise je Artikel/Kette grob
  → „passt ins Budget"-Logik, aber **keine echten Live-Preise**.
- **(b) Nutzergepflegte Preisliste:** App lernt Preise, die du einträgst/scannst (Kassenbon).
- **(c) Community-/Dritt-Datensätze:** inoffizielle Scraper existieren (fragil, rechtlich grau,
  keine Garantie) — nur falls wir eine verlässliche Quelle finden.
**Empfehlung:** MVP mit (a) KI-Schätzpreisen + optional (b); echte Store-APIs nur, wenn sich
eine belastbare Quelle auftut. → **Entscheidung von Jakob nötig.**

## 3. Etiketten-/Lebensmittel-Erfassung
**Wunsch:** Verpacktes Lebensmittel per **Etiketten-Scan (KI-Vision)** ODER aus einer
**Datenbank** erfassen; Menge in Gramm angeben → Nährwerte automatisch eintragen.

**Machbar:** Ja.
- Datenbank-Weg: **OpenFoodFacts** (frei, echte DB, Barcode-Lookup) → `FoodProvider`.
- Scan-Weg: Foto → `AiProvider.recognizeLabel` (Vision) → Nährwerte je 100 g / Portion.
- Gramm-Eingabe skaliert die Werte (Skalierungslogik im `NutritionCalcService` vorhanden).

## 4. Fastfood-Helfer
**Wunsch:** „Ich geh zu McDonald's, muss nicht gesund sein — was ist am proteinreichsten,
wie viel will ich ausgeben?" → KI-Vorschläge.

**Machbar:** Ja, über `AiProvider.suggestFastfood` (kcal-/Budget-/Protein-Ziel + Kette).
Qualität steigt, wenn wir Ketten-Nährwerte als Kontext mitgeben (teils öffentlich verfügbar).

## 5. KI-Zugang & Modell-Strategie
**Wunsch:** Jakobs **Claude-Zugang** zum Testen; „so klein wie möglich, aber gute Qualität"
= kleines Modell mit wenig Tokenverbrauch, aber gutem Ergebnis.

**Umsetzung (Modell-Routing im `ClaudeAiProvider`):**
- **Standard = Haiku 4.5** (`claude-haiku-4-5-20251001`) für strukturierte, einfache Tasks
  (Listen-Merge, Parsing, einfache Vorschläge) — günstig, schnell.
- **Eskalation = Sonnet 4.6 / Opus 4.8** nur für schwere Tasks (Etikett-Vision,
  komplexe Budget-Optimierung), wenn Qualität es rechtfertigt.
- Key/Endpoint/Modell werden in **Einstellungen** gepflegt (ist schon da), nur lokal gespeichert.
- Entwicklung/Tests laufen gegen **`MockAiProvider`** → **keine Kosten**; Live-Test, sobald
  Jakob seinen Key in den Einstellungen hinterlegt.

## Vorgeschlagene Build-Reihenfolge
1. `AiProvider`-Interface + DI-Token + `MockAiProvider` (deterministisch) + `ClaudeAiProvider`
   (Messages API + Vision + JSON-Schema-Guard + Modell-Routing).
2. `FoodProvider` + `OpenFoodFactsProvider` (Barcode/Textsuche) → Tagebuch-Erfassung.
3. Einkaufsliste erweitern: Personen×Tage×Mahlzeiten×Budget, KI-Vorschläge, Preis-Schätzung (a).
4. Etikett-Scan (Kamera + Vision). Fastfood-Helfer.
5. (Optional/später) echte Supermarkt-Preisquelle, falls verfügbar.

# Performance-Welle (Review T12, Branch perf-welle)

Messung: `npx ng build` (production), Raw-Größen laut Build-Ausgabe, `www/` per `du -sb`.

## Vorher / Nachher

| Messwert | Vorher | Nachher |
|----------|-------:|--------:|
| Initial total (raw) | 805,76 kB | 806,65 kB |
| Initial total (transfer) | 184,28 kB | 184,49 kB |
| main (raw) | 677,22 kB | 678,11 kB |
| Gemeinsamer Lazy-Chunk der Tab-Module (raw / transfer) | 574,51 kB / 119,17 kB | 92,72 kB / 27,42 kB |
| zxing-Chunk (erst beim Öffnen des Scanners) | in Tab-Chunk enthalten | 483,39 kB / 92,54 kB |
| `www/` gesamt | 19,72 MB | 15,82 MB |
| tesseract-core in `www/assets/tesseract/core` | 11,7 MB (3 Varianten) | 7,8 MB (simd-lstm + lstm) |
| Etikett-OCR, 2. Scan (Browser, gleiche Sitzung) | ca. 0,8 s inkl. Worker-/Sprachdaten-Laden | ca. 0,4 s, keine Netzwerk-Requests |
| Initial-Budget (angular.json) | Warnung 900 kB / Fehler 1200 kB | Warnung 900 kB / Fehler 1000 kB |

Der Initial-Bundle bleibt praktisch gleich (+0,9 kB durch gebündeltes Schreiben). Der Gewinn liegt in den Lazy-Chunks: Diary/Dashboard/Shopping luden bisher den 574-kB-Chunk mit zxing, jetzt nur 93 kB.

## Umgesetzt

- PRF-01: Tesseract-Worker als lazy Singleton (`IdleResource`, 60 s Leerlauf, danach `terminate`; fehlerhafter Worker wird verworfen).
- PRF-02: Nur `tesseract-core-simd-lstm` und `tesseract-core-lstm` (Fallback ohne WASM-SIMD, iOS-Target 15) werden ausgeliefert; die Auswahl erfolgt per SIMD-Erkennung (`ocr-core.ts`). Die relaxedsimd-Varianten entfallen.
- PRF-03: `@zxing/browser` per dynamischem Import beim ersten Scanner-Start.
- PRF-07: KI-Pfade (Rezeptfoto-Import, Etikett-KI) skalieren das Foto vor dem Upload auf max. 1600 px (`shrinkPhotoForUpload`); die OCR tat das bereits.
- PRF-08: Rezeptbilder (Spoonacular) mit `loading="lazy"`, `width`/`height` und `aspect-ratio` gegen Layout-Sprünge.
- PRF-09: `StorageService.set` bündelt Schreibzugriffe (max. 250 ms); Lesen sieht sofort den neuesten Wert, Flush bei `pagehide`, `beforeunload`, `visibilitychange` und beim Zerstören des Dienstes.
- PRF-10: Tagebuch-Liste nutzt die Pure-Pipe `ntAmount` statt `formatAmount()` pro Zeile. Dashboard (`mealSubLabel`) und Einkaufsliste (`categoryLabel`) sind OnPush-Seiten mit billigen Pure-Funktionen und blieben unverändert (nicht messbar).
- Budget: Fehlergrenze initial 1200 kB auf 1000 kB gesenkt (Initial 807 kB).

## Nicht umgesetzt

- PRF-04, PRF-06: laut Auftrag ausgeschlossen.
- PRF-05: Warnung bleibt bei 900 kB, da Initial bei 807 kB liegt (800 kB würde dauerhaft warnen).

## Hinweis

Die automatisch erzeugte CSP (`autoCsp`) enthält kein `wasm-unsafe-eval`; mit ihr scheitert das Kompilieren des Tesseract-WASM schon vor dieser Welle (Verifikation daher mit entfernter CSP). Im Produktionsbetrieb ist die KI aktiv, die Offline-OCR nur Rückfall bei fehlender KI-URL.

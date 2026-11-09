# Diskussion Rolle 18 (Code, Architektur, Tests)

Gelesen: Findings-Titel und Fragen aller 19 Berichte; Details nur dort, wo unten zitiert.

## (a) Zustimmung
- R13 F1/F2/F5 und R20 F1: Ursache liegt in storage.service.ts (stille `catch`, Pending wird verworfen, kaputtes JSON wird ueberschrieben). Deckt sich mit meinem F4 (Schema-Version, `lastError`-Signal). Gemeinsame Loesung: eine Aenderung im StorageService, kein Fix pro Seite.
- R13 F4 (defekte Daten legen Heute lahm) und R13 F12/R12 F3/F6 (Import/Reset ohne Auto-Sicherung): brauchen denselben Unterbau, `migrate()` plus Validierung beim Lesen, Auto-Sicherung vor `restore`.
- R16 F1-F3 (Monatsshards, Tagesindex): stuetzt mein F11, `dailyTotals(entries, range)` als einzige Aggregation. Ein Tagesindex gehoert dahinter, nicht in die Komponenten.
- R14 F4/F10 und R19 F10 (`reconcileKcal` ueberschreibt still): Eingabe-Normalisierung und Rechenregeln sind reine Funktionen und brauchen Tests vor der Aenderung (mein F5).
- R02 F11 (toter Code Dashboard), R05 F3 (zwei Generatoren, ein Plan-Zustand): bestaetigen F3/F6, Aufraeumen vor Umbau, sonst wachsen die ungetesteten Seitenklassen weiter.
- R10 F1/F7 (Segment-Zustand nicht in URL, kein Back-Handler): E2E-Pfade und Deep-Link-Tests werden einfacher, wenn Zustand in der URL liegt; ich stuetze es.
- R17 F1 (Deckel nicht aktiv, Konfiguration): Worker-Test sollte den Zustand "kein Limiter" als roten Test abbilden (WRK-02).

## (b) Widerspruch und Konflikte
- R14 F4 (UI-Validierung) gegen R13/R19: Nicht nur UI. Kompromiss: Validierung als reine Funktion in `core/` (`parseAmount`, `clampFacts`), UI zeigt Fehler, Store lehnt zusaetzlich NaN/negativ ab (Defense in Depth, S).
- R20 F8 (Tabs neu schneiden) und R10 F2/F3 gegen "5 Tabs behalten" (E1): Ein Tab-Umbau vor Welle 1 und vor F3 (Seitenklassen zerlegen) vervielfacht Aufwand und bricht E2E-Selektoren. Kompromiss: erst Tests/Zerlegung, dann IA-Umbau; Segmente in URL (R10 F1) als Zwischenschritt.
- R15 F7 (Widget/App-Group) und R20 F4 (adaptives Ziel/Health nach hinten) gegen Wartbarkeit: Ein Widget braucht eine zweite Datenquelle (App-Group-Spiegel) neben localStorage. Das ist erst sinnvoll nach Storage-Migration (F4). Nicht vor Welle 3.
- R20 F2 (Ein-Tipp-Pfad) und R03 F1 (Sheet bleibt offen) gegen die 666-Zeilen-Klasse add-entry-sheet: Neue Pfade dort ohne Zerlegung zu bauen erhoeht das Risiko; Kompromiss: Favoriten/Zuletzt als eigene Komponente mit eigenem Store-Aufruf, nicht ins Sheet gepackt.
- R09 F5/F10 (Animationen/Tokens): ok, aber keine neuen Animationspfade in Seiten, die ungetestet sind; zuerst in geteilte Komponenten (Ring, Toast).

## (c) Antworten auf Fragen an mich/QA
- R14 Q2: Beides. Store lehnt ungueltige Mengen/Nahrwerte ab (liefert Fehlerergebnis statt Wurf), UI nutzt dieselbe Funktion fuer Inline-Text. Eine Stelle, ein Test.
- R14 Q3: Direktive statt Wrapper `nt-input`. Direktive (Enter-Weiter, Select-All, autocapitalize, inputmode) ist klein, rueckwaertskompatibel und testbar; Wrapper mit Label/Einheit/Fehlerzeile spaeter, wenn FRM-02 umgesetzt wird. Bis dahin keine Massenmigration der Templates.
- R07 Q3: Ja, aber gestuft. Sofort: Touch-Ziel-Scan (<44 px) und `reducedMotion` als Smoke im Playwright-Lauf; 200 % Schrift erst nach A11-01 (vorher ist es zwecklos). VoiceOver bleibt manuell auf Geraet.
- R16 Q1: Export bleibt ein einzelnes JSON (Backup-Version erhoehen, Shards nur intern). Import-Validierung kennt eine Form, intern neu in Shards zu schreiben ist Sache des StorageService.
- R16 Q2: Vor Welle 6 entscheiden; bis zur Entscheidung E8 reicht Schema-Version plus Auto-Sicherung. SQLite/Datei erst bei App-Store-Ziel.
- R20 Q2: Zustimmung zur These: Tageslimit und Kostendeckel reichen, Install-ID und Durable Objects erst bei Weitergabe. Aus Testsicht aber Pflicht: Worker-Test fuer "Limiter fehlt" und "Deckel erreicht".

## (d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Storage-Unterbau: Schema-Version, `lastError`-Signal, Lesen mit Validierung, Auto-Sicherung vor Import/Reset (R13 F1/F4/F5/F12, R12 F3/F6, R20 F1; mein F4). M, hoch.
2. Lint gruen und `ng lint` plus E2E-Smoke in CI (mein F1/F2); danach jeder Welle-1-Fix mit rotem Test zuerst (F5). S bis M, hoch.
3. Heute-Hero mit "noch Z g Eiweiss" (R02, R06 F4/F5, R19) auf Basis von `dashboard`-`computed`-Selektoren mit Spec. M, hoch.
4. Eintragen schneller: Sheet bleibt offen/Ein-Tipp-Favoriten (R03 F1, R20 F2) als eigene Komponente. M, hoch.
5. Einkauf-Fluss: Plan-Liste-Link, Fallback ohne KI, Altlasten (R05 F1/F2/F3/F5, R08 F1) plus einheitliche Einheiten (mein F6). M, mittel-hoch.

## (e) Streichen oder verschieben
- Verschieben: Monatsshards (R16 F1), Widget/Health (R15 F7/F8), adaptives Ziel (CMP-02) bis nach Storage-Migration und Welle 3.
- Verschieben: Tab-Neuschnitt (R20 F8) bis Tests und F3-Zerlegung stehen.
- Streichen: Dashboard-Altcode (R02 F11), Debug-Log-Block im Profil aus dem Standard-UI (R20 F7), `PreloadAllModules` nur mit Messung (R16/R10 F11).
- Streichen als eigene Aufgabe: Skeletons (R09 F7), solange kein echter Ladeweg messbar langsam ist; Coverage-Schwelle (mein F12) nur fuer `core/`.

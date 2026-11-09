# Diskussion Runde 2: Rolle 16 (Performance)

Gelesen: Berichte 01-20 (gezielt nach Speicher, Persistenz, Aggregation, CSP, Start durchsucht; nicht jede Zeile geprueft). Eigene Messung bleibt Chromium, 4x CPU-Drosselung, kein Geraet.

## (a) Zustimmung
- Rolle 13 F1/F2/F5 und Rolle 18 F4: Schreibfehler, fehlendes Schema, `pending` wird vor dem Schreiben geleert. Das ist die Folge meines F1: ab ca. 10.400 Eintraegen (5 Mio Zeichen) scheitert jedes Schreiben. Quota-Fehler ist also kein Randfall, sondern ein Zeitpunkt.
- Rolle 12 F5, Rolle 20 F1, Rolle 12 Frage 2: Backup-Erinnerung plus `navigator.storage.persist()` sind guenstig und sichern F2 (WKWebView-localStorage kann geleert werden) ab.
- Rolle 18 F11: eine reine Aggregation `dailyTotals(entries, range)` ist genau mein F3 (Tagesindex). Ohne sie rechnen Wochen-, Monatsansicht (Rolle 11 F2), Serie und adaptives Ziel jeweils eigene Voll-Filter.
- Rolle 11 F2/F3 (Monats-/90-Tage-Sicht, Umschalter 30/90/Alles): sinnvoll, aber erst nach dem Tagesindex, sonst skaliert die Rechenlast mit jedem Monat.
- Rolle 13 F4 (`sanitizeEntries` beim Laden): kostet einen Durchlauf (ca. 1 ms je 1.000 Eintraege), bei Monatsshards je Monat, unkritisch.
- Rolle 15 F3 (appStateChange/Tageswechsel): kostet nichts, hoher Nutzen.

## (b) Widerspruch / Konflikte
1. Rolle 13 F1 (fehlgeschlagene Keys behalten und bei jedem `visibilitychange` erneut schreiben): bei einem 3-5-MB-Eintrag blockiert jeder Retry den Main-Thread 50-130 ms (gedrosselt) und scheitert bei voller Quota erneut. Kompromiss: Retry mit Backoff (Flush + 5 s + 60 s), danach Banner "Speicher voll, Backup anlegen"; erst mit Monatsshards (F1) lohnen sich Retries wirklich, weil nur der kleine Monat neu geschrieben wird.
2. Rolle 17 F4 (strikte CSP): `docs/PERFORMANCE.md` hielt fest, dass die Auto-CSP ohne `wasm-unsafe-eval` das Tesseract-WASM schon blockiert. Kompromiss siehe (c) 1.
3. Rolle 15 F7 (Widget ueber App-Group-UserDefaults) und Rolle 15 F11 (Filesystem): zwei neue native Speicherwege neben localStorage. Besser gleich ein Weg: Persistenz-Backend einmal nativ umstellen (F2), Widget bekommt dann nur eine kleine Tageszusammenfassung als Spiegel. Kein Widget vor dieser Entscheidung.
4. Rolle 9 (Listen- und Zahlenanimationen): mit Datenmenge unkritisch (Tageslisten <= 20 Zeilen), aber nur transform/opacity animieren; Zaehler-Animationen der Ringe nicht ueber Layout laufen lassen. Nicht gemessen.

## (c) Fragen an mich
- Rolle 17 Frage 3 (Tesseract unter strikter CSP): Nein, nicht ohne Lockerung. Noetig sind `script-src 'self' 'wasm-unsafe-eval'` und `worker-src 'self' blob:` (nicht `unsafe-eval`). Mit entfernter CSP habe ich in der Perf-Welle verifiziert; die gelockerte CSP ist nicht getestet und vor Einbau per `e2e` zu pruefen. Im Produktivbetrieb ist die OCR nur Rueckfall ohne KI-URL.
- Rolle 13 Frage 1 und Rolle 12 Frage 2 (Preferences/SQLite): Preferences (UserDefaults) nicht fuer Megabytes. Bei Zielplattform nur privat (E8): Auto-Backup-Erinnerung plus Monatsshards reichen. Bei App Store: Dateispeicher (Filesystem, JSON je Monat) oder SQLite.
- Rolle 18 Frage 1 (Chromium genuegt fuer CI?): fuer Logik ja; Performance-Aussagen gelten nur fuer WebKit nach Gerätetest, Chromium-Zahlen sind ein Grobmass.
- Rolle 18 Frage 3 (Schema-Version): ja, dringend vor Monatsshards, weil die Migration eine Version braucht (`diary:v2`).

## (d) Top-5 ueber alle Rollen (Nutzen/Aufwand)
1. Rolle 12 F3 + Rolle 12 F5 + Rolle 20 F1: Backup-Erinnerung, Reset mit "Backup zuerst", `storage.persist()` (S, schuetzt alle Daten).
2. Rolle 15 F3: Tageswechsel per appStateChange (S).
3. Rolle 13 F1 mit Backoff-Ausbau + Rolle 13 F4: Schreibfehler nicht still, Eintraege beim Laden bereinigen (S bis M).
4. Rolle 15 F1: Tastatur-Accessory/"Fertig" fuer Zahlenfelder (S, taeglicher Eintragsfluss).
5. Mein F1 + F3 + Rolle 18 F11: Monatsshards mit Schema-Version und Tagesindex als gemeinsame Aggregation (M), Grundlage fuer Monatsansicht und Gewichts-/Verlaufserweiterungen.

## (e) Streichen / verschieben
- Verschieben: Widget (Rolle 15 F7), Apple Health (F8), adaptives Ziel (CMP-02) bis Persistenz-Entscheidung F2 und Tagesindex stehen; Rolle 20 F4 stuetzt das.
- Streichen aus meiner Sicht: eigene PRF-05 (Budget 800 kB), PRF-06 (Service Worker), Virtualisierung der Listen, weitere Bundle-Optimierung am Framework (Gewinn gering, Kosten gegen Wirkung zu hoch).
- Spaeter: PreloadAllModules (mein F6) und Backup-Streaming (F7), erst nach Messung auf dem Geraet.

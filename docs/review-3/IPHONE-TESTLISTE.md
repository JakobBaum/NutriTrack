# iPhone-Testliste (Stand 2026-11-14)

Alles hier ist bisher nur in Chromium (375 und 320 px) geprüft, mit nachgebauten Antworten statt echter Dienste. Reihenfolge nach Risiko.

## Zuerst
1. **Backup exportieren:** Profil, "Backup exportieren". Kommt das Teilen-Menü, lässt sich die Datei in "Dateien" sichern und wieder importieren? (In der iOS-WebView fraglich.)
2. **Zustimmungsdialog:** Ohne Zustimmung Fastfood-Helfer oder Online-Rezeptsuche starten. Dialog erscheint, "Zustimmen" erst mit Häkchen bei 18+ aktiv, "Nicht jetzt" lässt nichts hängen. "Datenschutzerklärung lesen" zeigt den Text. Widerruf unter Profil sperrt wieder.
3. **Etikett-Scan:** ohne Zustimmung (nur Texterkennung auf dem Gerät) und mit Zustimmung (KI). Kamera-Abfrage zeigt den neuen Text.
4. **Barcode-Scan:** Tippen bis Formular, Quelle "Daten: Open Food Facts (ODbL)" sichtbar.

## Welle 2 (Layout)
5. Jeder Tab: Kopfzeile, runder Hinzufügen-Knopf unten rechts frei von der Tab-Leiste und der Home-Leiste (Safe Area).
6. Sheets: Fuß mit der Hauptaktion bleibt bei offener Tastatur sichtbar und überdeckt keine Felder.
7. Wischen: Tagebuch-Zeilen (Löschen, Bearbeiten), Sheets nach unten schließen.
8. Toast "Rückgängig" verdeckt den runden Knopf nicht dauerhaft.

## Welle 3 (Funktionen)
9. Profil, Abschnitt "Ernährung": Ernährungsform, Unverträglichkeiten, Abneigungen eintragen. Auswahlfelder gut tippbar.
10. Online-Rezeptsuche: Chip "Profil-Filter aktiv" an und aus, Treffer ändern sich. Hinweis "keine Allergiesicherung" sichtbar.
11. Wochenplan mit Profil erzeugen: keine Rezepte mit ausgeschlossenen Zutaten.
12. Kochmodus: "Du brauchst" auf Seite 1, "Dafür brauchst du" je Schritt. Stimmen die Zuordnungen bei drei echten Rezepten?
13. Fastfood-Helfer: 1 bis 4 Kriterien, Land, "Weitere Vorschläge" ohne Wiederholungen. Hinweis "KI-Schätzung" sichtbar. Wirken die Werte plausibel? (Echtes Gemini wurde nicht getestet.)

## Rechtliches in der App
14. Profil, "Quellen und Lizenzen", Datenschutzerklärung, Nutzungsbedingungen: lesbar, Links öffnen im Browser.
15. Gespeichertes Online-Rezept: "Quelle" mit Link und "Rezeptdaten von spoonacular.com".
16. Rezept per Link importieren: bei TikTok oder Instagram kommt nach dem Worker-Deploy die Meldung, den Text einzufügen.

## Erst nach Worker-Deploy prüfbar
- Unverträglichkeiten und ausgeschlossene Zutaten werden schon bei Spoonacular gefiltert.
- Fastfood: Land und Ausschlussliste kommen bei der KI an.
- Link-Import: Sperrliste und robots.txt.

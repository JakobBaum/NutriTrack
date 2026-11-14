# Offene Fragen an Jakob

Stand 2026-11-14. Gesammelt, während ohne Rückfrage weitergearbeitet wurde. Annahmen stehen jeweils dabei.

1. **Merge Welle 2 in main?** Geht damit live (GitHub Pages).
2. **Merge Welle 3 in main?** Ebenso.
3. **Fastfood: Land.** Aus dem Profil (Einstellung) oder automatisch? Annahme bis zur Antwort: feste Auswahl direkt im Fastfood-Helfer (in den App-Einstellungen gespeichert), Vorgabe Österreich, nichts Automatisches (kein Standortzugriff).
4. **Welle 4 A (Essen beschreiben):** Go für die Variante mit Diktier-Taste, ohne natives Sprach-Plugin? Siehe `WELLE-4-ENTWURF.md`.
5. **Welle 4 B (TikTok):** Stufe 1 (Beschreibung plus mehrere Screenshots), Stufe 1 und 2 (eigenes Video hochladen) oder nichts?
6. **Worker-Deploy:** nötig für Welle 3 (Ernährungs-Filter, Fastfood-Kriterien) und Welle 4. Erst nach deinem Ja.

## Recht (aus `RECHT-BESTANDSAUFNAHME.md`, keine Rechtsberatung)

Fakt: Repo `JakobBaum/NutriTrack` und die Web-Version unter https://jakobbaum.github.io/NutriTrack/ sind öffentlich. Jeder kann die App samt deinem Worker (Gemini-Key, Spoonacular-Kontingent) nutzen. "Nur ich" gilt damit derzeit nicht.

7. **Öffentlich lassen?** Repo und GitHub Pages öffentlich lassen, Pages abschalten oder Repo privat stellen? Das ist die wirksamste Einzelmaßnahme; solange die Seite öffentlich ist, gelten Impressum- und Datenschutzpflichten.
8. **Ziel:** nur dein Gerät, TestFlight für Freunde (auch unter 18?) oder App Store?
9. **Tarife:** Läuft der Gemini-Key im Paid Tier (Billing aktiv)? Im EWR ist laut Google-Bedingungen nur der bezahlte Dienst zulässig. Welcher Spoonacular-Plan?
10. **Gespeicherte Online-Rezepte:** Spoonacular erlaubt laut Terms dauerhaft nur ID, Titel und Bild-URL. Die App speichert ganze Rezepte. Umbauen (beim Öffnen neu laden), schriftliche Erlaubnis einholen oder für rein private Nutzung so lassen?
11. **Impressum:** Welche Adresse darf drinstehen (Wohnadresse, Postfach, Impressumsservice)? Ohne Antwort baue ich keines ein.
12. **Link-Import und TikTok:** Der Worker ruft fremde Seiten automatisiert ab. TikTok verbietet das Auslesen. Import auf Seiten mit Rezept-Daten (JSON-LD) beschränken und TikTok sperren? Annahme bis zur Antwort: TikTok-Abruf durch den Worker wird nicht gebaut (betrifft Welle 4 B).
13. **Worker absichern:** Anfragen ohne Origin ablehnen? Schützt nicht vollständig, hält aber einfache Fremdnutzung ab. Braucht ein Deploy.
14. **Einwilligung:** Ich baue ein, dass KI- und Online-Funktionen erst nach einmaliger Zustimmung (mit Bestätigung 18+) laufen. Du siehst den Dialog einmal. Einverstanden, oder für dich allein wieder ausbauen?

## Gesamtprüfung (Welle 5)

15. **Mittlere Befunde beheben?** `GESAMTPRUEFUNG.md` listet 15 mittlere und 8 niedrige Befunde (0 kritisch, der eine hohe ist behoben). Vorschlag: zuerst Nr. 2 und 3 (Erfolgsmeldung trotz Fehler bei Zurücksetzen und Import), Nr. 4 (ältere App überschreibt neuere Daten), Nr. 5 (KI-Antworten für Einkaufsliste und Etikett ungeprüft), Nr. 9 (Online-Suche mischt Filtersätze). Alle oder nur diese?
16. **Abneigungen mit gleichem Wort in beiden Sprachen** (z. B. "Avocado") lösen den Hinweis "konnten nicht übersetzt werden" aus. Hinweis für solche Fälle unterdrücken?
17. **Fastfood-Helfer:** "Weitere Vorschläge" und "Vorschläge holen" stehen direkt übereinander. So lassen oder nach der ersten Runde nur noch eine Schaltfläche zeigen?

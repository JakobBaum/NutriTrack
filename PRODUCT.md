# Product

<!-- impeccable:product-schema 1 -->

> Abgeleitet aus README.md, PROMPT.md, docs/FEATURE-REQUESTS.md, docs/ROADMAP.md und dem Code
> (2026-11-05). Jakob hat das Schreiben delegiert; Punkte mit *(abgeleitet)* sind Schlüsse aus dem
> Repo, nicht ausdrücklich bestätigt.

## Platform

web

Mobile-first Web-App (Ionic/Angular), ausgeliefert über GitHub Pages und als Home-Bildschirm-App am
iPhone genutzt. Capacitor-Projekte für iOS und Android existieren, Store-Veröffentlichung ist nicht
entschieden. Ionic-Komponenten folgen dem Betriebssystem (iOS-Modus am iPhone); die Gestaltung
selbst ist eigenständig, nicht native HIG.

## Users

- **Primär: Jakob selbst.** Trackt Kalorien und Makros im Alltag, um abzunehmen, zu halten oder
  zuzunehmen. Nutzt das Handy unterwegs, beim Kochen, im Supermarkt und direkt nach dem Essen,
  oft einhändig und in wenigen Sekunden.
- *(abgeleitet)* Später möglich: Freunde und Familie im DACH-Raum, deutschsprachig.

## Product Purpose

Eine schlankere, bessere Alternative zur App-Store-App „Fitness Tracker": nur die Funktionen, die
wirklich gebraucht werden, dafür gut. Erfolg heißt: Eine Mahlzeit ist in Sekunden erfasst, und
der Blick auf „Heute" zeigt sofort, was vom Tagesbedarf noch übrig ist.

## Positioning

- Daten bleiben lokal auf dem Gerät; kein Konto, kein Tracking, keine Werbung.
- KI ist Helfer, nicht Kern: Rezept-Import per Link/Text/Foto, Etikett-Scan, Einkaufsliste,
  Fastfood-Vorschläge. Ohne KI bleibt alles Wesentliche nutzbar.
- Auf Österreich/DACH zugeschnitten: deutsche Oberfläche, Treffer aus AT/DE/CH zuerst,
  Supermärkte Spar, Billa, Hofer, Lidl als Bezugsrahmen für Einkauf und Preise.
- Kostenlos, offene Datenquellen (Open Food Facts, Open Prices).

## Operating Context

- Tagesablauf: morgens/abends „Heute" prüfen, nach jeder Mahlzeit eintragen
  (Suche, Barcode, Etikett, Rezept oder gespeicherte Mahlzeit).
- Kochen: Rezepte anlegen oder importieren, Portionen ins Tagebuch loggen.
- Einkaufen: Liste aus Rezepten, Personen, Tagen und Budget erzeugen, im Laden abhaken.
- Tabs (5): Heute, Tagebuch, Rezepte (Segment „Rezepte | Mahlzeiten“), Einkauf (Segment „Wochenplan | Liste“), Profil.

## Capabilities and Constraints

- Bedarf: Mifflin-St Jeor + Aktivität + Ziel, lokal berechnet (Gesundheitsdaten verlassen das
  Gerät nicht).
- Lebensmittel: Open Food Facts (Suche über Cloudflare-Worker-Proxy, Barcode direkt), Nährwerte
  je 100 g oder je Portion.
- KI über Cloudflare-Worker zu Google Gemini (oder eigener Key „Gemini direkt"); rate-limitiert.
- Speicherung: localStorage über `StorageService`; Backup-Export und -Import liegen im Profil.
- Kein Medizinprodukt: keine Therapie- oder Diagnose-Aussagen.
- Offen: App-Store-Veröffentlichung, Konten/Cloud-Sync (würde Art. 9 DSGVO auslösen),
  Gemini-Billing vor Fremdnutzung.

## Glossar (Sprache der Oberfläche)

| Begriff | Bedeutung | Nicht verwenden für |
|---|---|---|
| Essenszeit | Frühstück, Mittag, Abend, Snack (Gruppe im Tagebuch) | gespeicherte Vorlagen |
| Mahlzeit | gespeicherte Vorlage aus Lebensmitteln und Rezepten (Segment „Mahlzeiten“ unter Rezepte) | Frühstück, Mittag usw. |
| Eintrag | eine Zeile im Tagebuch | |
| Eiweiß | immer so, nie „Protein“ (Abkürzung „E“ nur in Tagebuchzeilen, mit Legende) | |
| eintragen | einziges Verb für das Tagebuch („In Frühstück eintragen“, „Noch nichts eingetragen“) | erfassen, hinzufügen (hinzufügen bleibt für Einkaufsliste, Zutaten und Schritte) |
| Wochenplan | Rezeptvorschläge für mehrere Tage im Einkauf-Tab | „Rezepte“ als Segmentname im Einkauf |

## Brand Commitments

- Name **NutriTrack**.
- Jakobs Vorgabe aus docs/DESIGN.md: „schlicht, modern, rund", angelehnt an „Fin Fitnesstracker",
  ohne dessen Layout zu kopieren. Kalorien- und Makro-Ringe sind das Kern-Visual.
- Sprache: Deutsch, direkt, Du-Form.

## Evidence on Hand

- Referenz-Screenshots: `BeispielFotos/`.
- Keine Nutzerzahlen, Bewertungen oder Testimonials; nichts davon erfinden.
- Daten-Attribution Pflicht: „Daten: Open Food Facts (ODbL)".

## Product Principles

1. **Erfassen in Sekunden.** Der Hauptweg (Suchen → Menge → Speichern) braucht keine Extras.
2. **Ehrliche Zahlen.** Schätzungen (KI, Preise) sind als solche gekennzeichnet; Messwerte nicht.
3. **Lokal zuerst.** Nichts verlässt das Gerät ohne Grund, und der Grund steht im Datenschutz.
4. **Weniger, aber gut.** Eine Funktion kommt nur dazu, wenn sie den Alltag wirklich verkürzt.

## Accessibility & Inclusion

WCAG 2.2 AA als Ziel: Kontrast ≥ 4,5:1 für Text, Pinch-Zoom erlaubt, Trefferflächen ≥ 44 px,
sichtbarer Fokus. Einhändige Bedienung am Handy hat Vorrang.

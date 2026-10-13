# Build-Prompt: Kalorien- & Ernährungs-Tracker App (Ionic, iOS + Android)

> Kopiere den folgenden Prompt und nutze ihn, um die App bauen zu lassen.
> Vorbild/Benchmark: die App-Store-App **"Fitness Tracker"** (Kalorien tracken, Barcode-Scan) —
> wir bauen eine schlankere, bessere Variante ohne überflüssige Features.

---

## PROMPT

Ich möchte eine **Kalorien- und Ernährungs-Tracker-App** für **iOS und Android** bauen.
Entwickle sie mit **Ionic + Capacitor** (ein Codebase für beide Plattformen), da ich damit
viel Erfahrung habe. Wähle **Angular ODER React** als Ionic-Framework — schlage mir vor, was
du für dieses Projekt besser findest, und begründe es kurz.

Als Vorbild dient die iOS-App **"Fitness Tracker"** (Kalorien-Tracking per Barcode-Scan),
aber ich will eine **schlankere, bessere Version**: nur die Features, die ich wirklich brauche,
dafür diese richtig gut.

### Ziel der ersten Version (MVP)
Eine App, die mir hilft, meine **Kalorien zu tracken** und auszurechnen, was mein
**Tagesbedarf** ist — z. B. wenn ich abnehmen (oder zunehmen/halten) möchte.

### Kernfunktionen (MVP — bitte zuerst bauen)

1. **Profil & Tagesbedarf (KI-berechnet)**
   - Eingabe: Gewicht, Größe, Alter, Geschlecht, Aktivitätslevel, Ziel (abnehmen / halten / zunehmen).
   - Eine **KI-Schnittstelle** berechnet daraus den täglichen **Kalorienbedarf** und die
     empfohlenen **Makros**: Eiweiß, Kohlenhydrate, Fett, Ballaststoffe.
   - Basis-Formel (Mifflin-St Jeor + Aktivitätsfaktor + Ziel-Anpassung) als Fallback,
     aber die Berechnung/Empfehlung läuft über die KI-Schnittstelle.

2. **Tages-Dashboard ("Aktueller Tagesbedarf")**
   - Zeigt für den heutigen Tag: Ziel, bereits gegessen, **noch übrig**.
   - Fortschrittsanzeige für Kalorien UND jede Makro (Eiweiß, Kohlenhydrate, Fett, Ballaststoffe):
     wie viel schon gegessen, wie viel noch fehlt.

3. **Mahlzeiten erfassen**
   - Pro Mahlzeit des Tages (Frühstück, Mittag, Abend, Snacks) kann ich eintragen:
     - ein **Lebensmittel** (Suche),
     - ein **Rezept** (eigenes oder importiertes),
     - etwas aus meiner **Einkaufsliste**.
   - Schnelles Erfassen per **Barcode-Scan** oder **Etiketten-Scan**.

4. **Barcode-Scan**
   - Barcode scannen → Lebensmittel + Nährwerte automatisch finden
     (z. B. über **OpenFoodFacts**-API).

5. **Etiketten-Scan (KI-Vision)**
   - Nicht nur Barcode, sondern das **Nährwert-Etikett abfotografieren**.
   - Die **KI liest per Bilderkennung**, was auf dem Etikett steht.
   - Ich kann auswählen, ob die Werte **pro Portion** oder **pro 100 g** gelten.

6. **Rezepte verwalten (eigene Unterseite "Rezepte")**
   - Rezepte **erstellen und bearbeiten** (Zutaten → automatische Nährwert-Summe).
   - Rezepte von **TikTok oder Webseiten importieren**: Link einfügen → KI parst
     Zutaten/Mengen/Schritte und legt ein Rezept an.
   - Eigene Unterseite mit allen Rezepten (selbst erstellt + importiert).

7. **Einkaufsliste generieren**
   - Ich gebe an: wie viele **Gerichte** ich haben will und für wie viele **Personen**.
   - Die KI erstellt mir daraus eine **Einkaufsliste** (Mengen zusammengefasst).

8. **Fastfood-Helfer**
   - Wenn ich Lust auf Fastfood habe: Ich sage z. B. "Ich will ~X Kalorien essen und fahre
     zu McDonald's".
   - Die KI schlägt vor, was ich dort essen kann, das ins Kalorienbudget passt und ein
     **gutes Verhältnis** hat (z. B. viel Protein für die Kalorien).

9. **Einstellungen (KI-gestützt)**
   - Alle Einstellungen (Profil, Ziel, Bedarf) können per **KI** generiert/aktualisiert werden,
     basierend auf meinen Angaben (Gewicht, Ziel, zunehmen/abnehmen usw.).

### KI-Integration (wichtig)
- **Alles KI-Gestützte läuft über eine austauschbare Schnittstelle** (ein Service/Interface
  im Code, nicht hart verdrahtet).
- **Zum Testen** soll die App direkt gegen **dich (Claude)** laufen — baue einen konkreten
  Adapter, der die KI-Calls an dich schickt (API-Key / Endpoint konfigurierbar).
- Später soll der KI-Anbieter leicht austauschbar sein, ohne die App-Logik zu ändern.
- KI-Aufgaben: Etikett-Erkennung (Vision), Rezept-Import-Parsing, Bedarfsberechnung,
  Einkaufslisten-Generierung, Fastfood-Empfehlungen.

### Seitenstruktur (Vorschlag)
- **Dashboard** (Tagesbedarf: Kalorien + Makros, gegessen/übrig, Mahlzeiten des Tages)
- **Rezepte** (Liste eigener + importierter Rezepte, erstellen/bearbeiten/importieren)
- **Einkaufsliste** (generieren aus Gerichte-/Personenanzahl)
- **Einstellungen** (Profil, Ziel, KI-Key/Endpoint, Bedarf neu berechnen)
- Scan-Funktion (Barcode + Etikett) erreichbar aus der Mahlzeiten-Erfassung.

### Technische Hinweise
- **Ionic + Capacitor**, ein Codebase für iOS + Android.
- Capacitor-Plugins für **Kamera** (Barcode + Etikett-Foto) und Barcode-Scanner.
- Lebensmitteldaten: **OpenFoodFacts** (kostenlos, offen) für Barcode-Lookups.
- Lokale Speicherung (SQLite / Capacitor Preferences / IndexedDB) für Rezepte, Tageseinträge,
  Profil — offline-fähig wo sinnvoll.
- Sauberer, austauschbarer **KI-Service-Layer** (Interface + konkreter Claude-Adapter).
- Klare Trennung: UI-Komponenten / State / Services / KI-Adapter.

### Vorgehen
1. Schlage mir zuerst **Framework (Angular vs. React)** und eine **Projektstruktur** vor.
2. Dann bauen wir **iterativ**, beginnend mit dem **MVP-Kern**:
   Profil/Bedarf → Dashboard → Mahlzeiten erfassen → Barcode-Scan → Etiketten-Scan.
3. Danach: Rezepte (erstellen + importieren), Einkaufsliste, Fastfood-Helfer.
4. Frag mich bei offenen Entscheidungen **eine Frage nach der anderen**.

Fang bitte mit Vorschlag zu Framework + Projektstruktur + einem konkreten Plan für den
MVP-Kern an. Noch keinen Code schreiben, bis ich den Plan freigegeben habe.

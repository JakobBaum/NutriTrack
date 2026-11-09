# Diskussion Rolle 07 (Barrierefreiheit), Runde 2

Basis: Berichte der Rollen 01-06, 08-20 gelesen; weiterhin keine Geraetepruefung.

## (a) Zustimmung und Ergaenzung
- Rolle 15 F5 (Long-Press-ActionSheet, Leading-Swipe) und Rolle 03 F8 (drei Aktionen je Zeile): decken F1 ab. Ein ActionSheet ist fuer VoiceOver sogar besser als ein Sheet-Button, solange der Long-Press nicht die einzige Tuer ist. Beides zusammen: Zeile oeffnet Bearbeiten, dort Doppeln/Loeschen sichtbar, Long-Press als Abkuerzung.
- Rolle 06 F13 und Rolle 08 F7/Frage 3: Ausschreiben statt "E/KH/F" (meine F5). Die Legende am Listenende hilft VoiceOver nicht; ausschreiben oder visually-hidden je Zeile.
- Rolle 06 F1/F12 und Rolle 02 F3: 320 px und 70 Typo-Literale hiengen mit meinem F2/F3 zusammen. Nach rem-Umstellung brechen Ringe-Labels bei grosser Schrift erst recht.
- Rolle 11 F7: Werte nur im aria-label, Sehende ohne Zahl; Farbe als einziges Signal ist auch ein WCAG-1.4.1-Thema. Zustimmung (Haekchen/Zahl am Balken).
- Rolle 13 F11 (Undo zu kurz) und Rolle 09 F6: bestaetigen mein F7; Rolle 13 F3 (Toast-Stau) verschaerft es fuer Screenreader.
- Rolle 14 F5 (Button deaktiviert ohne Begruendung) und Rolle 01 F6: Disabled-Button ist fuer VoiceOver ("ausgegraut") ohne Grund eine Sackgasse; Inline-Fehler mit role="alert"/aria-describedby statt nur disabled.
- Rolle 14 F1/Rolle 15 F1 (Zahlenfelder ohne Return): auch Bedienbarkeit fuer Switch-/Tastaturnutzer; Zustimmung.
- Rolle 04 F11 (Trefferanzahl ansagen): ergaenzt, ich stufe es mittel ein, weil Suche der Haupt-Eintragsweg ist.
- Rolle 01 F1: unstyled h1; Ueberschriften-Hierarchie ist auch VoiceOver-Rotor-Navigation.

## (b) Konflikte
- Rolle 09 F3/F5 (Ziel-Moment, Ring-Aufbau-Animation, Puls) gegen Reduced Motion: erlauben, wenn an `prefers-reduced-motion` gekoppelt (zur Laufzeit, siehe F10) und Erfolg zusaetzlich als Text/Haptik; nie nur Animation oder Farbe.
- Rolle 09 Frage 3 (aggregierter Toast statt Live-Region): ok, wenn der Toast selbst die Live-Region ist und Undo mind. 8-10 s bleibt; kein Verzicht auf Undo-Zugriff.
- Rolle 11 F5/Rolle 06 F11 (Farbe fuer Ueberschreitung): Rot allein genuegt nicht; Text "ueber Ziel" beibehalten (existiert im Hero), bei Ringen ebenso.
- Rolle 02 F4 (Leerer Tag auf 45 % abdunkeln, dashboard.page.scss:267) widerspricht Kontrast; Vorschlag: Zahlen in --nt-secondary statt Opazitaet.
- Rolle 20 F3 (Streichen, schlanker Hero) vs. A11y: Streichen hilft Dynamic Type (weniger Platzbedarf); kein Konflikt, solange Eiweiss und kcal gross bleiben.
- Rolle 15 F10 (Querformat sperren): ok fuer iPhone, aber Zoom/Textgroesse nicht einschraenken; nur Rotation sperren, keine Skalierung.
- Rolle 06 F10/F6 (Tokens vereinheitlichen): reihenfolgemaessig erst rem-Skala (F2), dann optisch aufraeumen, sonst doppelte Arbeit.

## (c) Antworten an meine Rolle
- Rolle 06 Frage 2: Nein, 11/12 px ohne Dynamic Type sind nicht vertretbar; Typo-Skala zuerst auf rem/Dynamic Type, Mindest 12 px.
- Rolle 08 Frage 3: Legende reicht nicht; jede Zeile braucht ausgeschriebenen Text (visually-hidden), kein aria-label auf p.
- Rolle 09 Frage 3: siehe (b), ja unter den genannten Bedingungen.

## (d) Top 5 ueber alle Rollen (Nutzen/Aufwand)
1. Datenverlust zuerst: Rolle 13 F1/F5, Rolle 20 F1, Rolle 12 F3/F6 (Auto-Sicherung vor Import, Schreibfehler melden). Hoher Nutzen, S-M.
2. Eiweiss gleichwertig zu kcal: Hero (vorhanden), Tagebuch-Kopf (Rolle 06 F5), Zeile ausgeschrieben (mit meinem F5). S.
3. Aktionen erreichbar: Doppeln/Loeschen im Bearbeiten-Sheet plus Long-Press (mein F1, Rolle 15 F5). S-M.
4. Eintragen schneller: Rolle 03 F1/F2, Rolle 20 F2 (Sheet bleibt offen, Zuletzt je Essenszeit). M.
5. Eingabe-Basics: Return-Taste/Enterkeyhint und Fehler am Feld (Rolle 14 F1/F4/F5, Rolle 15 F1). S.
Danach mein F2 (Dynamic Type) als eigene Welle, vor dem Design-Aufraeumen.

## (e) Streichen oder verschieben
- Verschieben: F8 (Opazitaet), F9 (Zoom-Sperre, nur Release-Check), F10 (Reduced-Motion-Listener).
- Verschieben: Widget/Health (Rolle 15 F7/F8) und adaptives Ziel (Rolle 20 F4); A11y-Nutzen gering gegen Basis.
- Streichen aus meiner Sicht: Animations-Ausbau (Rolle 09 F5/F7/F8) bis Dynamic Type und Undo-Zeit stehen.

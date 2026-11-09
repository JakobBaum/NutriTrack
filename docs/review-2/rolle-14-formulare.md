# Rolle 14: Formulare und Eingabefelder

Methode: Code-Lektuere (src/app, alle ion-input/Amount-Row/Stepper). Keine Live-Pruefung. Nicht doppelt gemeldet: FRM-01..06, QAE-06/07, QAD-04 aus REVIEW-ERGEBNIS.md.
Positiv: Dezimalkomma-Parser zentral (core/util/number-input.ts), inputmode="decimal" fast uberall, Select-All beim Fokus in Menge/Nahrwerten, Feldfehler im Profil mit role="alert".

F1. enterkeyhint="next" ohne Enter-Handler
Befund: meals-list.component.html:164-172 und recipes.page.html:133,145,193-198,256 setzen "next"/"done", aber kein (keyup.enter) und kein Fokus-Weiterschalten. Nur shopping.page.html:340-369, food-search und barcode-scanner haben Handler.
Auswirkung: iOS zeigt "Weiter", Tippen darauf tut nichts. Gerade beim manuellen Eintrag (Name, kcal, Eiweiss, KH, Fett) muss Jakob jedes Feld antippen. "Fertig" schliesst nur die Tastatur, speichert nichts.
Vorschlag: Kleine Direktive ntEnterNext (keyup.enter: nachstes ion-input im Container setFocus; letztes: Aktion oder blur). In Name-Feldern des Add-Sheets (add-entry-sheet.component.html:188) Enter springt zur Menge.
Aufwand: S bis M. Prioritat: hoch.

F2. Add-Sheet: Nahrwertfelder ohne enterkeyhint, Name-Feld hat "done" statt "next"
Befund: add-entry-sheet.component.html:188 (Name "done"), 216-239 (sieben Felder ohne enterkeyhint, kein Enter-Handler). kcal nutzt inputmode="numeric" (216), alle anderen "decimal"; meals-list nutzt fur kcal "decimal" (166).
Auswirkung: Uneinheitliche Tastatur (kcal-Pad ohne Komma, anderes Layout als bei Eiweiss), Wechsel zwischen Feldern nur per Tippen.
Vorschlag: Eine Konstante/Direktive fur Nahrwertfelder: inputmode="decimal", enterkeyhint="next", letztes "done". kcal ruhig auch "decimal" (Etiketten haben 52,5 kcal), oder uberall "numeric" fur kcal.
Aufwand: S. Prioritat: mittel.

F3. Keine Gross-/Kleinschreibung-Steuerung bei Namen
Befund: Grep nach autocapitalize/autocorrect/spellcheck: kein Treffer in src/app (nur autocomplete="off" im Settings-Key-Feld). Betrifft Name (add-entry-sheet:188, meals-list:164, diary:146, recipes:133), Zutat (recipes:143), Artikel (shopping.page.html:334), Restaurant (fastfood-form:20).
Auswirkung: iOS-Standard fur ion-input ist ohne Grossschreibung am Satzanfang; deutsche Substantive ("Haferflocken", "Linsen-Dal") werden klein gespeichert und so in Liste/Einkauf angezeigt. Autokorrektur verstummelt Markennamen.
Vorschlag: autocapitalize="words" (Lebensmittel, Rezepte, Artikel, Restaurant), autocorrect="off" bei Lebensmittelnamen. Zentral in einer .nt-field-Variante oder per Direktive.
Aufwand: S. Prioritat: hoch (sichtbar in jedem Eintrag).

F4. Stilles Umwandeln ungultiger Zahlen in 0 oder Loschen
Befund: meals-list.component.ts:207-210 (`parseDecimal(...) ?? 0`: "12a" oder "1,2,3" wird 0 g Eiweiss, speichert trotzdem); shopping.page.ts:487 (Tippfehler im Preis wird null = Preis geloscht ohne Hinweis); shopping.page.ts:535 (ungultige Menge = "ohne Menge"); negative Werte werden nicht abgelehnt ("-5" in kcal).
Auswirkung: Protein/Kalorien sind Kern; ein Tippfehler verfalscht Tageswerte unbemerkt.
Vorschlag: Gemeinsame Funktion validateNutrient(text) -> {value, error}; Feldfehler "Zahl eingeben, z. B. 12,5" unter dem Feld (wie Profil, visibleError), Speichern-Button bei Fehler gesperrt oder mit Fokus auf erstes Fehlerfeld.
Aufwand: M. Prioritat: hoch.

F5. Deaktivierter Button ohne Begrundung
Befund: meals-list.component.html:174 `[disabled]="!manualValid()"`; manualValid (ts:200) verlangt Name und kcal > 0, nichts erklart es. Auch Fixwert "0" kcal (reines Eiweisspulver mit Makros) ist unmoglich, kcal wird nicht aus Makros abgeleitet (anders als im Add-Sheet, add-entry-sheet.component.ts:364).
Auswirkung: Nutzer sieht grauen Button, weiss nicht warum; Mahlzeit nur mit Makros nicht speicherbar.
Vorschlag: Button aktiv lassen, bei Klick Fehler am Feld zeigen (Name/kcal); kcal aus 4/4/9 ableiten wenn leer, mit Hinweis "berechnet".
Aufwand: S bis M. Prioritat: mittel.

F6. Einheitliches Verhalten Select-All und Fokus
Befund: (ionFocus)="selectAllOnFocus" nur im Add-Sheet, Amount-Row und Einkauf-Menge. Fehlt in meals-list.component.html:166-172 und recipes.page.html:193-198,256 (Nahrwerte je 100 g, "Fertig gekocht"). Auf Rezept-Zutaten ist `updateOn: 'blur'` gesetzt (recipes:193), Wert wird erst beim Verlassen ubernommen.
Auswirkung: Beim Korrigieren eines vorhandenen Werts muss erst gelost werden; bei updateOn blur kann ein direkt folgender Tipp auf "Speichern" den zuletzt getippten Wert verlieren (iOS: Blur vs. Click-Reihenfolge, Vermutung).
Vorschlag: Select-All uberall (Direktive), und Speichern-Handler vorher activeElement.blur() aufrufen oder Update auf Input umstellen.
Aufwand: S. Prioritat: mittel.

F7. Einheiten und Beschriftung der Nahrwertfelder
Befund: recipes.page.html:193-198 Labels "Kohlenh.", "Ballast." abgekurzt, Einheit g/100g nur im aria-label; Platzhalter "0" ist Einheit-los. Add-Sheet-Labels mit "(g)" korrekt, aber "kcal/100g" im Rezept nicht mit Leerzeichen/Komma.
Auswirkung: Mehrdeutig (je 100 g oder je Portion?), in Eile falsch befullt. A11-03 meldet nur aria vs. Sichtlabel.
Vorschlag: Sichtbare Einheit als Suffix im Feld ("g", "kcal") und Gruppenuberschrift "Nahrwerte pro 100 g"; Labels ausschreiben (volle Breite 2-spaltig).
Aufwand: S. Prioritat: mittel.

F8. Profil: Mehrfeld-Eintrag nur uber Stepper, keine Tastatur
Befund: settings.page.html:173-189 nt-stepper mit Textanzeige (stepper.component.html:9), kein Eingabefeld; Schritt 0,5 kg (Bereich 30-300). Hinweis zu FRM-01, aber Konkretes: 75 -> 82,5 kg sind 15 Taps; Langdruck/Auto-Repeat nicht erkennbar.
Auswirkung: Erstes Onboarding-Erlebnis ist das langsamste Formular der App.
Vorschlag: Zahl im Stepper antippbar -> Inline ion-input inputmode="decimal" mit min/max-Fehler am Feld; Stepper bleibt als Feinjustierung.
Aufwand: M. Prioritat: hoch (Duplikat zu FRM-01, hier als Tastaturdetail priorisiert).

F9. Einkaufs-Preis per Alert
Befund: shopping.page.ts:462-488 nutzt AlertController mit inputmode via attributes; Enter im Alert bestatigt auf iOS nicht zuverlassig, Fehlerruckmeldung nicht moglich, "Euro (€)" doppelt.
Auswirkung: Nur Alert-Dialog, kein Feldfehler, kein Select-All.
Vorschlag: Gleiches Sheet-Muster wie "Artikel hinzufugen" (shopping.page.html:334) mit Preisfeld, Feldfehler, Suffix "€".
Aufwand: S bis M. Prioritat: niedrig.

F10. Tausenderpunkt-Heuristik und Dezimalpunkt
Befund: number-input.ts:5,17: "1.234,5" ergibt null (kein Fehlertext), "12.5" ist 12,5 aber "1.500" ist 1500 (QAE-06). iOS-Dezimalpad in de_DE liefert Komma, aber bei en-US-Tastatur Punkt.
Auswirkung: Gelegentlich wird gultige deutsche Eingabe stumm verworfen.
Vorschlag: Zusammen mit F4 Fehlertext; "1.234,5" als Tausender+Komma zulassen.
Aufwand: S. Prioritat: niedrig.

## Fragen an andere Rollen
1. Texte/UX-Writer: Welche einheitlichen Feldfehler-Texte ("Zahl eingeben, z. B. 12,5"; "Name fehlt") sollen gelten, damit F4/F5 nicht pro Seite neu formuliert werden?
2. QA/Daten: Soll der Store (add) ungultige/negative Nahrwerte ablehnen, oder reicht UI-Validierung (siehe QAE-03), damit F4 an einer Stelle gelost wird?
3. iOS/Mobile-UX: Ist eine gemeinsame Direktive (Enter-Weiter, Select-All, autocapitalize) akzeptabel, oder bevorzugt ihr eine Wrapper-Komponente `nt-input` fur alle Felder, inkl. Label, Einheit und Fehlerzeile?

# Rolle 01: Onboarding und First-Run (Runde 2)

Basis: Code-Lektüre (dashboard.page.*, settings.page.*, profile-form.ts, profile-plausibility.ts, profile.store.ts). App nicht gestartet, alles ungetestet auf Gerät. Nicht doppelt gemeldet: ONB-01..05 aus REVIEW-ERGEBNIS.md.

F1. Willkommens-Überschrift ist unstyled
- Befund: dashboard.page.html:11 nutzt `<h1>`, dashboard.page.scss:30 stylt nur `.empty h2` (Gewicht 700, Abstand). Die h1 fällt auf Browser-/Ionic-Default zurück.
- Auswirkung: Der erste Bildschirm überhaupt hat eine Überschrift ohne Designsystem-Größe (`nt-large-title` fehlt), passt nicht zu "Sanft iOS".
- Vorschlag: `class="nt-large-title"` setzen und SCSS-Selektor auf `h1` ändern.
- Aufwand: S. Priorität: mittel.

F2. Datumsleiste ohne Profil sinnlos
- Befund: dashboard.page.html:2-4 zeigt `nt-date-nav` (voll) auch im Leerzustand (`!hasProfile()`), ebenso die Tab-Bar.
- Auswirkung: Der Nutzer sieht Datum und Tages-Navigation vor jeder Funktion; lenkt vom einzigen Schritt ab, der zählt. Einträge in anderen Tabs ohne Ziel sind möglich und führen zu Heute ohne Ziel-Bezug (ungeprüft).
- Vorschlag: Datumsleiste im Leerzustand ausblenden; optional Tabs bis Profil ausgrauen oder Heute-Hinweis dort belassen.
- Aufwand: S. Priorität: niedrig.

F3. "Profil einrichten" öffnet das Formular möglicherweise nicht (Vermutung)
- Befund: dashboard.page.ts:222-224 navigiert auf `/settings?setup=1`; das Modal öffnet nur in `ngOnInit` (settings.page.ts:152-156). Ionic hält Tab-Seiten am Leben, ngOnInit läuft dann nicht erneut. Typischer Fall: Nutzer hat in Einstellungen "Daten zurücksetzen" gewählt, kehrt zu Heute zurück, tippt "Profil einrichten", landet auf Einstellungen ohne Modal.
- Auswirkung: Der einzige Button im Leerzustand wirkt kaputt; Wiederholter Erststart (Reset, Import eines leeren Backups) betroffen.
- Vorschlag: `route.queryParamMap` abonnieren (oder `ionViewWillEnter`) statt `ngOnInit`; Parameter nach dem Öffnen per `replaceUrl` entfernen (sonst öffnet Reload/Zurück das Modal erneut).
- Aufwand: S. Priorität: hoch.

F4. Profilformular zeigt nach Reset/Import veraltete Werte
- Befund: Formularfelder werden einmalig aus `profileStore.profile()` initialisiert (settings.page.ts:105-119, Kommentar Zeile 106 verspricht leere Felder). `clear()` (profile.store.ts:42) setzt nur das Signal; die Seitenfelder bleiben.
- Auswirkung: Nach "Daten zurücksetzen" oder Import ohne Profil ist das Formular vorbelegt mit dem alten Profil. Erststart-Zustand ist nicht reproduzierbar, Nutzer speichert unbewusst Altwerte. Betrifft auch Tester (Jakob).
- Vorschlag: Formularzustand beim Öffnen des Modals aus dem Store neu laden (eine `resetFormFromProfile()`-Methode, beim Öffnen und nach Reset/Import).
- Aufwand: S. Priorität: mittel.

F5. Kein Vorschau-Ergebnis im Formular, Speichern "blind"
- Befund: Das Formular (settings.page.html:164-270) zeigt nur Hinweise; das Ergebnis (kcal, Eiweiß in g) erscheint erst nach dem Speichern auf Heute. `formProfile()` (settings.page.ts:165) existiert schon. Ergänzt ONB-04 mit konkreter Umsetzung.
- Auswirkung: Gerade bei Abnehmen/Tempo kann der Nutzer die Wirkung seiner Wahl nicht prüfen; falsches Ziel merkt er erst nach Speichern, Schließen, Tab-Wechsel.
- Vorschlag: Klebende Zusammenfassung über dem Speichern-Button: "Dein Ziel: 2.340 kcal, 150 g Eiweiß" (live aus `calc.dailyTarget(formProfile())`), sobald Gewicht/Größe/Alter gesetzt sind.
- Aufwand: S. Priorität: hoch.

F6. Fehlermeldungen erscheinen nie, Button nur deaktiviert
- Befund: Speichern ist `[disabled]="!isFormValid"` (settings.page.html:266). `saveProfile()` setzt `touched` für alle Felder (settings.page.ts:302), wird aber bei deaktiviertem Button nie aufgerufen. Fehler an Zeilen erscheinen nur bei bereits angefassten Feldern; sonst nur generisch "Bitte Gewicht, Größe und Alter angeben." (Zeile 263).
- Auswirkung: Wer Alter überspringt, sieht nicht, welches Feld fehlt; der Fokus-auf-erstes-Fehlerfeld-Code (`focusFirstInvalid`) ist toter Pfad.
- Vorschlag: Button aktiv lassen und beim Tippen Fehler zeigen und fokussieren, oder die fehlenden Felder im Hinweis benennen ("Es fehlen: Alter").
- Aufwand: S. Priorität: mittel.

F7. Zehn Eingaben auf einmal, ohne Gliederung nach Pflicht und Optional
- Befund: Ein Modal mit Gewicht, Größe, Alter, Geschlecht, Aktivität, Ziel, Zielgewicht, Tempo, Hinweise (settings.page.html:166-261). Aktivität ohne Erklärung der Wirkung (nur Beispiele in settings.page.ts:134-140), Zielgewicht erscheint gleichrangig im Erststart.
- Auswirkung: Erster Eindruck "Formular" statt "Los geht's"; Aktivitätswahl ist der größte Hebel auf das Kalorienziel und wird geraten.
- Vorschlag: Im Erststart nur die ersten sechs Felder; Zielgewicht erst unter "Mehr Optionen". Aktivität: Unterzeile pro Option mit Faktor-Folge ("eher zu hoch gegriffen? dann niedriger wählen").
- Aufwand: M. Priorität: mittel.

F8. Willkommenstext liefert keinen Nutzen-Versprecher und keine Erwartung
- Befund: dashboard.page.html:12-13: "Mifflin-St Jeor" als Fachbegriff, kein Hinweis auf Dauer/Umfang ("5 Angaben, etwa 1 Minute"), kein Ergebnisbild, Protein als Kern fehlt.
- Auswirkung: Der Kernnutzen (Eiweiß-Ziel) bleibt unsichtbar; Fachwort schreckt ab, bevor Nutzen klar ist.
- Vorschlag: Zeile "Dein Tagesziel für Kalorien und Eiweiß, in einer Minute"; Formelname in Fußzeile "So rechnen wir" oder Info-Sheet.
- Aufwand: S. Priorität: mittel.

F9. Kein Erst-Eintrag-Führung nach dem Setup
- Befund: Leerer Tag zeigt nur das kleine "Noch nichts eingetragen" (dashboard.page.html:75-77); keine Handlungsaufforderung am Ring, der Eintragen-Pill (Zeile 23) ist der einzige Hinweis.
- Auswirkung: Nach dem Profil (siehe ONB-03: Nutzer bleibt auf Einstellungen) fehlt der nächste Schritt; Tracking beginnt nicht von selbst.
- Vorschlag: Leerzustand-Karte "Trage deine erste Mahlzeit ein" mit Primär-Button und Verweis auf Barcode/Suche; nach Speichern des Erstprofils automatisch auf Heute springen (ONB-03).
- Aufwand: M. Priorität: hoch.

F10. Ziel "Divers" nutzt gelbes Inline-Style statt Tokens
- Befund: settings.page.html:201 Inline `style="font-size:12px;color:var(--nt-warning)"`, Icon `color="warning"` (laut THM-01 Token undefiniert).
- Auswirkung: Uneinheitlich zu `.hint--warn`, Warnton kaum lesbar, 12 px ohne Skala.
- Vorschlag: `class="hint hint--warn"` wie bei plausibilityNotes verwenden.
- Aufwand: S. Priorität: niedrig.

Fragen/Thesen an andere Rollen
1. Ernährung/Coach: Reicht ein Aktivitäts-Dropdown mit "moderate" als Vorgabe, oder überschätzt das bei Büro-Alltag systematisch das Kalorienziel (beeinflusst NUT-03/E4)?
2. Copy/Text: Soll der Willkommenstext Eiweiß explizit als Hauptversprechen nennen, und gehört der Formelname in ein Info-Sheet (Glossar E2)?
3. QA/Release: Lässt sich der Erststart (Reset, Setup-Link, Reload mit `?setup=1`) als e2e-Test absichern, damit F3/F4 nicht zurückkehren?

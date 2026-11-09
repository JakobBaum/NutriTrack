# Rolle 07: Barrierefreiheit (Review Runde 2)

Basis: Code-Lektuere, kein Geraet, kein VoiceOver-Lauf, keine Messung. Nicht wiederholt: A11-01, IXD-03, MUX-03, IXD-05 (Runde 1). Positiv: lang="de", Kontrastwerte als Tokens, --nt-touch 44 px, Stepper-Tippflaeche, Fokusringe, role=alert bei Fehlern, Charts als role=img.

F1. Loeschen/Doppeln fuer VoiceOver unerreichbar
- Befund: diary.page.html:79-102 und shopping.page.html:184,214: Aktionen nur in ion-item-sliding. Der Ersatz .nt-hover-delete ist unter `@media (hover: none)` auf display:none (global.scss:757-760); das iPhone meldet hover:none, die Alternative fehlt also auf dem Zielgeraet.
- Auswirkung: Mit VoiceOver sind Loeschen und Doppeln nicht auffindbar; Wischen ist auch motorisch schwer.
- Vorschlag: Im Bearbeiten-Sheet (diary.page.html:126ff) sichtbare Buttons "Doppelt eintragen" und "Loeschen"; Einkauf: Loeschen im Preis-Dialog. Wischen bleibt Abkuerzung.
- Aufwand: S-M. Prioritaet: hoch.

F2. Dynamic Type wirkungslos (Konkretisierung zu A11-01)
- Befund: variables.scss:82-87 feste px (13/15/17/22/34/40), 78 weitere px-Schriftgroessen in SCSS, kein `--ion-dynamic-font`, kein `font: -apple-system-body`.
- Auswirkung: Systemschriftgroesse hat keinen Effekt; Caption 13 px ist schon bei Standard klein.
- Vorschlag: `html { font: -apple-system-body; }`, Ionic `--ion-dynamic-font` aktivieren, Tokens auf rem mit Obergrenze, Hero und Ringe per clamp(). Danach bei 200 % Tab-Bar, Hero, Segment, Chips pruefen.
- Aufwand: M-L. Prioritaet: hoch.

F3. Texte unter 12 px
- Befund: 11 px in tabs.page.scss:57, amount-chips.component.scss:19, recipes.page.scss:153/155, settings.page.scss:254, shopping.page.scss:150 (est-badge, Padding 1 px); Nutriscore-Badge 20x20 px/12 px (food-row.component.scss:68-77), s-d (#ee8100 mit dunklem Text) knapp.
- Auswirkung: Schwer lesbar, nicht skalierend.
- Vorschlag: Token `--nt-fs-micro: 12px` als Untergrenze (besser 13); est-badge als normaler Text; Badge-Kontrast messen.
- Aufwand: S. Prioritaet: mittel.

F4. Touch-Ziele unter 44 pt
- Befund: `ion-button size="small"` an 9 Stellen (u. a. shopping.page.html:6, 211; Hoehe ca. 30 px); date-nav-Buttons (date-nav.component.scss:25ff) pruefen.
- Auswirkung: Fehltreffer bei schneller Nutzung (Einkauf unterwegs).
- Vorschlag: Globale Regel `ion-button { --min-height: var(--nt-touch) }` oder die ::before-Tippflaeche des Steppers wiederverwenden; Playwright-Scan aller button/ion-button/[role=button] mit Hoehe/Breite < 44.
- Aufwand: S. Prioritaet: mittel.

F5. Abkuerzungen E/KH/F werden als Buchstaben vorgelesen
- Befund: diary.page.html:82-86 "E 12 g · KH 30 g · F 5 g"; Meal-Chips haben aria-label zu `short` (add-entry-sheet.component.html:28), die Eintragszeile nicht.
- Auswirkung: Ansage unverstaendlich; Eiweiss, die Kerninfo, geht im Tagebuch fuer VoiceOver verloren.
- Vorschlag: `<span aria-hidden="true">E 12 g</span><span class="visually-hidden">Eiweiss 12 g</span>` (Klasse existiert, global.scss:380), analog KH und Fett.
- Aufwand: S. Prioritaet: hoch.

F6. Einkauf: radio ohne radiogroup, kein Fortschritts-Feedback
- Befund: shopping.page.html:110-112 role="radio" ohne role="radiogroup" und Label (add-entry-sheet:26 macht es richtig); Zeile 76 tabindex="0" Zweck unklar; Abhaken ohne Rueckmeldung (IXD-08).
- Auswirkung: Budget-Auswahl ohne Kontext; Listenstand nicht ansagbar.
- Vorschlag: `role="radiogroup" aria-label="Wochenbudget"`; Zaehler "3 von 12 erledigt" als aria-live="polite".
- Aufwand: S. Prioritaet: mittel.

F7. Rueckgaengig-Toast zu kurz fuer Screenreader
- Befund: entry-toast.ts:3-4: 2,5 s, mit Undo 5 s, Position oben.
- Auswirkung: Zeitlimit (WCAG 2.2.1): ein VoiceOver-Nutzer erreicht "Rueckgaengig" kaum rechtzeitig; Undo ist der Schutz bei QAD-06/07.
- Vorschlag: Mit Undo 8-10 s; bei aktivem VoiceOver (Capacitor ScreenReader-Plugin) ohne Auto-Ablauf mit Schliessen-Button.
- Aufwand: S. Prioritaet: mittel.

F8. Opazitaet auf Text und Icons
- Befund: opacity 0.35-0.55 in date-nav.component.scss:31, stepper.component.scss:36, dashboard.page.scss:268/316, settings.page.scss:177, weight-card.component.scss:66 (Punkte).
- Auswirkung: Bei Info (nicht disabled) faellt der Kontrast unter 4,5:1; Disabled ist ausgenommen.
- Vorschlag: Je Stelle klaeren, Info-Text ueber --nt-secondary statt Opazitaet.
- Aufwand: S. Prioritaet: niedrig.

F9. Zoom-Sperre in iOS-Kopie
- Befund: ios/App/App/public/index.html:11 hat `maximum-scale=1.0, user-scalable=no`; src/index.html:13 nicht. Vermutlich veralteter cap-sync-Stand.
- Auswirkung: Verstoss gegen WCAG 1.4.4, falls so ausgeliefert.
- Vorschlag: Vor dem Build `npx cap sync`, im Release-Check auf `user-scalable` greppen.
- Aufwand: S. Prioritaet: niedrig.

F10. Reduzierte Bewegung nur teilweise
- Befund: global.scss:395 deckt Light DOM; app.module.ts:15 liest die Einstellung nur beim Start; Ring-Animation und Seitenuebergaenge nicht geprueft.
- Vorschlag: matchMedia-change-Listener, Ionic `animated` dynamisch; e2e mit `reducedMotion: 'reduce'`.
- Aufwand: S. Prioritaet: niedrig.

## Fragen an andere Rollen
1. UX/Interaktion: Soll Loeschen/Doppeln ins Bearbeiten-Sheet (F1)? Dann ist Wischen nur Abkuerzung und IXD-03 erledigt.
2. Visual Design: Passt ein Minimum von 12-13 px und skalierbare Schrift zum dichten Hero/Tab-Layout bei 320 px, und welche Obergrenze fuer den 40-px-Hero?
3. QA/E2E: Koennt ihr Lauf bei 200 % Schrift, `reducedMotion` und Touch-Ziel-Scan (< 44 px) in die Suite aufnehmen? F5/F7 bleiben ohne echten VoiceOver-Test These.

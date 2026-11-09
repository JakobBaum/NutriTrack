# Rolle 09: Motion, Haptik, Rückmeldung (Runde 2)

Stand 2026-11-09, nur Code-Lektüre. Nicht doppelt gemeldet: IOS-02 (Haptik nativ ist in `diary/haptics.ts` umgesetzt), IXD-04..08, A11-03..06.
Grundlagen solide (reduced-motion global plus Ionic `animated`, Ring-Transition, Undo-Toast). Lücken: Press-States, Haptik-Abdeckung, Erfolgs-Moment.

F1. Chips und Tab-Buttons ohne Press-State
- Befund: `.meal-chip` (`diary/_diary-sheet-flows.scss:34`, `shopping/shopping.page.scss:52`) nur `:focus-visible`, kein `:active`; `ion-tab-button` (`tabs/tabs.page.scss:33`) ohne Pressed-Zustand. `.nt-pill` hat ihn (global.scss:525).
- Auswirkung: Wichtigste Eingaben (Essenszeit, Budget, Tabs) wirken auf iPhone träge, Touch kennt kein Hover.
- Vorschlag: Mixin `nt-pressable` (`:active { transform: scale(.97); opacity: .85 }`, 120 ms) auf Chips, Tabs, Segmente.
- Aufwand S, Priorität hoch

F2. Einkaufsliste: Abhaken ohne Haptik und Übergang
- Befund: `shopping.page.ts:349` `setChecked` ohne `lightHaptic()`; `.checked` (`shopping.page.scss:144`) springt hart auf Durchstreichen.
- Auswirkung: Häufigste Wiederholungs-Geste im Supermarkt ohne taktile Bestätigung (IXD-08 nennt nur das Problem).
- Vorschlag: Haptik in `setChecked`; Farbe/Decoration 150 ms transitionieren; abgehakte Zeile erst nach 200 ms nach unten sortieren.
- Aufwand S, Priorität hoch

F3. Kein Erfolgs-Moment beim Erreichen des Eiweiß-/Kalorienziels
- Befund: `dashboard.page.ts:98` nutzt `proteinReached()` nur für aria-Text; kein visueller oder haptischer Übergang bei 100 %.
- Auswirkung: Kernziel der App bleibt ohne Rückmeldung; nach dem Eintragen gibt es nur den Text-Toast "Eingetragen · X kcal".
- Vorschlag: Beim Wechsel `reached false -> true` einmal pro Tag Success-Haptik plus kurzer Ring-Puls (scale 1.04 -> 1, 300 ms).
- Aufwand M, Priorität hoch

F4. Haptik nur eine Stärke
- Befund: `haptics.ts` bietet nur `lightHaptic()`; Löschen (`diary.page.ts:385`), Speichern, Favorit, Abhaken identisch.
- Auswirkung: Haptik trägt keine Information.
- Vorschlag: `selectionHaptic()` (Chips, Checkbox), `successHaptic()` (Eintragen, Ziel), `warningHaptic()` (Löschen), gemeinsamer Web-Fallback.
- Aufwand S, Priorität mittel

F5. Ring baut sich beim Eintritt nicht auf
- Befund: `progress-ring.component.scss:16` transitioniert `stroke-dashoffset`, aber `ratio()` ist beim ersten Render schon final.
- Auswirkung: Dashboard wirkt statisch; der Zuwachs nach dem Eintragen ist nach Tab-Wechsel evtl. nicht sichtbar, weil der Wert schon vor dem Sichtbarwerden springt.
- Vorschlag: In `ionViewDidEnter` Ringe vom Vorwert zum Zielwert laufen lassen, Zahl per Count-up (300 ms, tabular-nums).
- Aufwand M, Priorität mittel

F6. Toast ersetzt Meldungen hart, uneinheitlich
- Befund: `entry-toast.ts:8` dismisst offenen Toast und erzeugt neu (Flackern); schnelles Mehrfach-Eintragen lässt frühere Undos stumm verfallen. 19 Toast-Stellen, nicht alle über `showEntryToast`. `position: 'top'` (Zeile 13) kollidiert mit dem Tab-Bar-Offset in `global.scss:647`.
- Auswirkung: Undo-Fenster nicht vorhersehbar, Position uneinheitlich.
- Vorschlag: Alle Toasts über `showEntryToast`; bei Folgeaktion aggregieren ("3 Einträge", ein Undo für alle); Positionsregel vereinheitlichen.
- Aufwand M, Priorität mittel

F7. Ladezustände nur Spinner, keine Skeletons
- Befund: Online-Suche, Fastfood (`fastfood-sheet.component.html:25` "bis zu 30 s"), Barcode, Import: nur `ion-spinner`; kein `ion-skeleton-text` im Projekt.
- Auswirkung: Ergebnisliste springt beim Eintreffen (Layout-Shift); 30 s ohne Fortschritt wirken wie ein Hänger, Abbrechen nicht erkennbar.
- Vorschlag: 4 Skeleton-Zeilen fester Höhe (64-px-Bild plus 2 Textzeilen); nach 8 s Text "Dauert länger als üblich" plus Abbrechen.
- Aufwand M, Priorität mittel

F8. Listenänderungen ohne Animation
- Befund: Tagebuch-Zeilen (`diary.page.html:79`) erscheinen und verschwinden ohne Übergang, neue Zeile wird nicht hervorgehoben; Summenzahlen springen, Balken nur 200 ms (`dashboard.page.scss:398`).
- Auswirkung: Nutzer sucht nach dem Speichern die neue Zeile; Löschen wirkt abrupt.
- Vorschlag: Neue Zeile 600 ms Akzent-Tint-Highlight plus Scroll in Sicht; Löschen mit 180 ms Höhen-/Opacity-Collapse. Global reduced-motion greift schon.
- Aufwand M, Priorität mittel

F9. Primärbutton ohne sichtbaren Busy-Zustand
- Befund: `add-entry-sheet.component.ts:570` `isSaving` wirkt nur intern; Rezept-Import (`recipes.page.html:453`) tauscht nur Inhalt.
- Auswirkung: Auf langsamen Geräten wirkt der Tap folgenlos, Doppeltipp wird ohne Hinweis geschluckt.
- Vorschlag: `[disabled]` plus Spinner `slot="start"` bei `isSaving`/Laden.
- Aufwand S, Priorität niedrig

F10. Easing und Dauern ohne Tokens
- Befund: 120 ms ease (global.scss:523), 150 ms (tabs, food-search), 200 ms ease-out (dashboard), 350 ms ease (global.scss:184), 500 ms cubic-bezier (Ring).
- Auswirkung: Unruhiges Gesamtgefühl; "Sanft" aus DESIGN.md nicht in Motion übersetzt.
- Vorschlag: `--nt-dur-fast/base/slow` (120/200/400 ms) und `--nt-ease-out` in global.scss, überall ersetzen.
- Aufwand S, Priorität niedrig

F11. Swipe-Aktionen ohne Haptik beim Öffnen
- Befund: `diary.page.html:91` Optionen sind Tap-Buttons; Haptik nur in `duplicate()`, "Bearbeiten" und das Aufziehen der Leiste geben nichts.
- Auswirkung: Gering, Swipe ist aber die Hauptgeste für Korrekturen.
- Vorschlag: `selectionHaptic()` bei `ionDrag` über Schwelle, einmal pro Geste.
- Aufwand S, Priorität niedrig

Fragen an andere Rollen
1. Design/Theming: Verträgt "Sanft iOS" einen Ziel-Moment (Puls, ggf. Violett aus E6), oder widerspricht das dem Produktversprechen ohne Gamification?
2. iOS/Capacitor: Ist die Zielplattform (E8) nativ gesetzt, sodass Success-/Warning-Haptik sicher verfügbar ist, oder reicht stiller Web-Fallback?
3. A11y: Darf ein aggregierter Toast ("3 Einträge", ein Undo) die Live-Region ersetzen, ohne dass Screenreader-Nutzer Meldungen verlieren?

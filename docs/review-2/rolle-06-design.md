# Rolle 06: Visuelles Design und Konsistenz (Sanft iOS)

Basis: Code (src/theme/variables.scss, src/global.scss, Seiten-SCSS) und Screenshots der gebauten App (www/, 375 und 320 px, Seed "Tag ueber Ziel"). Nicht doppelt gemeldet: was DESIGN.md schon als erledigt fuehrt (Eiweiss-Violett, --ion-color-warning, Sheet-Header, Dark Mode bewusst aus). Die Token-Basis ist gut; offen sind Drift und Luecken. Pfade unter src/.

F1. Typo-Skala wird unterlaufen. Tokens 13/15/17/22/34 (theme/variables.scss:82-87), aber ca. 70 Literale: 12px 16x, 14px 8x, 11px 6x, 20px 8x, 18px 5x (app/recipes/recipes.page.scss:3,85,133,140; app/shopping/shopping.page.scss:150). `--nt-fs-hero` ist 40, DESIGN.md nennt 48; dashboard.page.scss:123 und :26 nutzen 48/56 hart. Auswirkung: Hinweise, Badges, Legenden mit 11-12 px auf dem iPhone schwer lesbar. Vorschlag: Stufe `--nt-fs-small` einfuehren oder auf 13 heben, Hero/Display als Tokens, Literale ersetzen. Aufwand M, Prio mittel.

F2. Abstaende/Radien ausserhalb der Skala 4/8/12/16/20/24: 10px 14x (recipes.page.scss:143,155-157,191,208; dashboard.page.scss:22; meals-list.component.scss:10), 14px (recipes:203,225; settings:238), 18px (global.scss:514); Radien 3/4/6/8/14. Auswirkung: uneinheitlicher Rhythmus, am staerksten im Rezepte-Tab. Vorschlag: auf --nt-space-*/--nt-radius-* runden, Stylelint-Regel fuer font-size/margin/radius. Aufwand M, Prio niedrig.

F3. Seitenkoepfe und Gutter ungleich. Screenshots: Titelkante "Tagebuch" y=30, "Profil" 40, "Rezepte" 40, "Einkaufsliste" 50 (@1x); "Heute" sitzt unter einer Datumszeile. Segment auf Rezepte beginnt bei x=8 (app/recipes/recipes.page.html:22, `ion-toolbar.view-bar`), auf Tagebuch/Einkauf bei x=16; Diary nutzt noch leere `ion-toolbar` (app/diary/diary.page.html:1-3). Auswirkung: Titel und Segment springen beim Tab-Wechsel. Vorschlag: alle Tabs ueber `.nt-page-header` plus gemeinsames `.nt-view-switch` (16-px-Gutter, gleiche Oberkante). Aufwand S, Prio mittel.

F4. Eiweiss-Farbe nur auf Heute/Woche. `--nt-protein` kommt nur in dashboard, week-view, week-recipe-sheet und global.scss:1098 vor. Tagebuchzeile "E 13 g" grau (app/diary/diary.page.html:85), Profil-Ziele "125 g Eiweiss" schwarz, food-row neutral. Auswirkung: die Kernmetrik verliert ausserhalb von Heute ihren Farbanker. Vorschlag: Eiweisszahl in Tagebuchzeile, Profil-Zielkarte, Mahlzeitenzeilen und food-row in --nt-protein (6,5:1) und halbfett. Aufwand S, Prio hoch.

F5. Tagebuch-Kopfkarte zeigt nur kcal ("3 254 kcal gegessen"), kein Eiweiss (Screenshot), waehrend Heute zwei Hero-Zahlen hat. Auswirkung: widerspricht Produktfokus und der Heute-Gestaltung. Vorschlag: Karte zweispaltig wie Heute-Hero (kcal Tinte, Eiweiss violett, "noch X g"). Aufwand S, Prio hoch.

F6. "Hinzufuegen" bleibt vierfach: Pille "Eintragen" (Heute, Tagebuch), "+ Neu" (Rezepte), runder FAB (Einkauf, app/shopping/shopping.page.html:304), Kreis-Plus je Mahlzeitengruppe. FAB mit --nt-shadow-float ist der einzige schwere Schatten der App. Vorschlag: Einkauf auf `.nt-add-btn`-Pille im `.nt-page-header`, FAB und `.nt-fab-offset` entfernen. Aufwand S, Prio mittel.

F7. Rezepte-Kopf ueberladen: Titel "Rezepte" und Reiter "Rezepte" doppelt; Globus- und Import-Icon ohne sichtbare Flaeche, ca. 12 px, neben 44-px-Pille "+ Neu" (Screenshot 375-recipes). Vorschlag: Globus/Import in ein ActionSheet "Mehr" oder in die Leerzustands-/Listenaktion; Titel fest "Rezepte". Aufwand S, Prio mittel.

F8. Einkaufsliste unruhig: "geschaetzt" dreifach (shopping.page.html:160,169,205), "Neu generieren"-Pille eingerueckt (x=36 statt 16), Zeilentrenner deutlich dicker als in `.nt-grouped` (0.5 px, eingerueckt), `.est-badge` 11 px mit rgba-Fallback (shopping.page.scss:150). Vorschlag: Hinweis einmal als Fussnote, Zeilenbadge nur bei "eigener Preis", Liste in `.nt-grouped`, Pille buendig. Aufwand S, Prio mittel.

F9. Literale statt Tokens trotz Regel "Farben als Tokens": Nutri-Score A-E (app/shared/food-row/food-row.component.scss:79-83); dunkles Debug-Log (app/settings/settings.page.scss:226-265: #111/#333/#9ca3af) als Fremdkoerper in heller Profilseite; rgba(118,118,128,.12) und rgba(60,60,67,.3) (global.scss:576,924); `--ion-*` (variables.scss:121-163) dupliziert Hexwerte statt var(--p-*). Vorschlag: `--nt-nutri-a..e`, Ionic-Mapping per var(), Debug-Log hinter Entwicklerschalter/Token-Set. Aufwand S, Prio niedrig.

F10. Elevation nicht ablesbar: Tab-Bar-Schatten (app/tabs/tabs.page.scss:51), Segment-Schatten (global.scss:589), Scrim hart; `--nt-shadow`/`--nt-shadow-sm` praktisch ungenutzt (Karten `box-shadow: none`, variables.scss:193). Vorschlag: drei benannte Stufen (flach, Float-klein, Float), Rest loeschen. Aufwand S, Prio niedrig.

F11. Ueberschreitungs-Semantik inkonsistent (Screenshot Heute): kcal- und Zucker-Ring komplett rot plus rote Pille; Kohlenhydrate/Fett zeigen "+24 g"/"+45 g" in Tinte, Ring bleibt Naehrwertfarbe. Hero "526 kcal" mit Pille "ueber Ziel" statt Vorzeichen, sofort nicht klar, ob uebrig oder zuviel. Vorschlag: alle Deltas "+X g" in --nt-over, Hero "+526 kcal ueber Ziel" mit Vorzeichen. Aufwand S, Prio mittel.

F12. 320 px: Ring-Labels brechen ("Ballast-/stoffe", "Kohlen-/hydrate"), Delta-Zeile ragt unter die Tab-Bar (Screenshot 320-dashboard). Vorschlag: Kurzlabels unter 340 px oder 2x2-Raster fuer die vier kleinen Ringe. Aufwand S, Prio niedrig.

F13. Kuerzel E/KH/F in Tagebuchzeilen (diary.page.html:85) mit Legende am Seitenende (:113); "E" fuer Eiweiss ist unueblich. Vorschlag: "13 g Eiweiss" ausschreiben und violett, KH/F nur grau; Legende entfaellt. Aufwand S, Prio mittel.

F14. Leerzustands-Icons 48 px mit wechselnder Farbe (recipes:57 und online-search:26 `--ion-color-step-400`, shopping:204 `--nt-secondary`). Vorschlag: eine Klasse `.nt-empty__icon`. Aufwand S, Prio niedrig.

Was gut ist: dreischichtiges Tokensystem (p- > nt- > ion-), dokumentierte Kontrastwerte, Kapsel-Tab-Bar, Hero mit zwei Zahlen, einheitliche Feld- und Sheet-Bausteine.

Fragen/Thesen an andere Rollen:
1. UX/IA: Soll "Hinzufuegen" ueber alle Tabs EIN Muster sein (Pille im Kopf), damit F6/F7 ohne Sonderfaelle loesbar sind?
2. Accessibility: Sind feste 11/12-px-Texte ohne Dynamic Type vertretbar, oder muss die Typo-Skala (F1) auf rem, bevor optisch aufgeraeumt wird?
3. Produkt/Ernaehrung: Darf das Tagebuch Eiweiss gleichrangig zu kcal zeigen (F5), auch wenn die kcal-Karte dafuer kleiner wird?

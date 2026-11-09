# Diskussion Runde 2: Rolle 01 (Onboarding / First-Run)

Gelesen: rolle-02 bis rolle-20. Keine Code-Änderung.

## (a) Zustimmung und Ergänzung
- Rolle 12 F2 (Formular behält Altzustand): bestätigt mein F4 unabhängig. Zusatz von mir: gleiche Ursache lässt F3 (Setup-Link öffnet Modal nur in ngOnInit) nach Reset wirkungslos. Beide in einem Fix lösen: `openProfile()` lädt Formular neu und wird von `queryParamMap`/`ionViewWillEnter` aufgerufen. Priorität hoch.
- Rolle 14 F8 (Stepper ohne Tastatur, "erstes Onboarding-Erlebnis ist das langsamste Formular") ergänzt meine F5/F7: 75 auf 82,5 kg = 15 Taps. Antippbare Zahl mit Inline-Eingabe ist der schnellste Gewinn im Erststart.
- Rolle 20 F6 (zweistufiger Einstieg, 5 Felder, danach sofort "Tagesbedarf X kcal, Y g Eiweiß" und Sprung ins Eintragen-Sheet): deckt sich mit F5, F7, F9. Ich stütze es, Reihenfolge siehe (d).
- Rolle 12 F7 und Rolle 19 F4 (Aktivitätslabels, Büro plus Krafttraining überschätzt Verbrauch): bestätigen meinen Frage 1. Ergänzend gehört der Satz "Schätzung, nach 2-3 Wochen Gewichtstrend prüfen" (Rolle 19 F2/F4) direkt unter die Zielvorschau aus F5, nicht ins Modal.
- Rolle 08 F2 (Fehlertext verweist auf nicht existierende KI-Einstellung) und Rolle 10 F9: Der Willkommenstext sagt "KI-Funktionen sind optional" (dashboard.page.html:13); im ersten Fehlerfall führt ein toter Verweis. Beides gemeinsam prüfen.
- Rolle 11 F1 / Rolle 10 F5 (Gewicht im Profil versteckt): für den Erststart relevant, weil das Startgewicht aus dem Profil nie als erster Gewichtseintrag landet. Vorschlag: Beim Erstspeichern Startgewicht als ersten Verlaufseintrag übernehmen.

## (b) Widerspruch und Konflikte
- Rolle 20 F6 setzt Priorität "mittel, Jakob ist einziger Nutzer". Widerspruch nur teilweise: F3/F4 sind Bugs, keine Onboarding-Politur, und treffen Jakob bei jedem Reset/Test. Kompromiss: Bugs (F3/F4) sofort, Dramaturgie (Mehrschritt-Assistent) erst nach E8.
- Rolle 12 F1 (freier Eiweiß-/kcal-Override) gegen meinen Wunsch nach wenig Eingaben im Erststart: Override gehört nicht in den Erststart, nur in Einstellungen, mit Grenzen (Rolle 19: Obergrenze g/kg). Einig, wenn Override nach dem ersten Ziel sichtbar wird ("Ziel anpassen" neben der Vorschau).
- Rolle 20 F8 (4 statt 5 Tabs) und Rolle 10 F5 / 11 F1 (Gewichtskachel auf Heute): Mehr Elemente auf Heute verschlechtern den Leerzustand. Kompromiss: Gewichtskachel erst nach erstem Gewichtseintrag zeigen, im Leerzustand nur Willkommen plus ein Button.
- Rolle 02 F2 (Hero streichen, Restzahl in den Ring): neutral; der Leerzustand darf dabei nicht "0 g noch 160" als Fehlschlag lesen lassen. Vorschlag: im leeren Tag Text "Tagesziel 160 g Eiweiß" statt "noch 160".
- Rolle 09 (Ziel-Moment/Puls): im Onboarding gestrichen; einziges Feedback nach Profilspeichern ist die Zielvorschau, keine Animation.

## (c) Fragen an meine Rolle (soweit gestellt)
- Rolle 12 Frage 3 (Profil und Einstellungen trennen): Ja für den Erststart: Profil als eigener Einstieg aus Heute (Karte oder Kopfsymbol), Einstellungen separat. Dann hat "Profil einrichten" ein klares Ziel und die Setup-Query entfällt.
- Rolle 14 Frage 3 / 1 (Eingabe-Direktive, Fehlertexte): Ein Fehlertext "Zahl eingeben, z. B. 75" im Profil nutzt dieselbe Funktion wie Nährwerte; Button nicht sperren (siehe F6).
- Rolle 19 Frage 2 (Hinweise ohne Disclaimer-Müdigkeit): Ein Satz unter der Zielvorschau im Onboarding, nirgends Modal. Ich übernehme die These.
- Rolle 18 Frage 3 (versioniertes Storage-Schema vor E3/E4): Ja; sonst rechnet ein neues Eiweißziel stille um. Beim Erststart und Import Version setzen, damit eine Migration Nutzer einmalig informieren kann.

## (d) Top-5 über alle Rollen (Nutzen/Aufwand)
1. Profil-Formular beim Öffnen frisch laden und Setup-Link zuverlässig öffnen (Rolle 12 F2, mein F3/F4), S.
2. Zielvorschau live im Profilformular und Sprung zu Heute nach dem Erstspeichern (F5, F9, Rolle 20 F6), S bis M.
3. Eiweiß-Ziel gleichrangig sichtbar und Wochenkontext (Rolle 02 F1, Rolle 19 F1), M.
4. Eintragen in zwei Taps (Favoriten/Zuletzt, Rolle 03 F1/F2/F10, Rolle 20 Frage 3), M.
5. Backup-Hinweis und Persistenzrisiko (Rolle 12, Rolle 13, Rolle 16: localStorage kann in WKWebView geleert werden), S für Hinweis, L für Speicherwechsel.

## (e) Streichen oder verschieben (aus Sicht Onboarding)
- Erststart-Assistent mit mehreren Schritten, Animationen, Willkommens-Karussell: verschieben bis E8 (App Store) entschieden ist.
- Zielgewicht und Tempo aus dem Erststart herausnehmen (unter "Mehr Optionen"); Pflicht nur Größe, Gewicht, Alter, Geschlecht, Ziel, Aktivität.
- Widget, Apple Health, Erinnerungen (Rolle 15 F7/F8, Rolle 11 F6): nicht im Erststart; frühestens nach erstem Gewichts- und Mahlzeiteneintrag anbieten.
- Fastfood-Helfer auf Heute (Rolle 20 F3) im Leerzustand ausblenden.
- Debug-Log und Rechtliches im Profil-Hub einklappen (Rolle 20 F7), spielt für Erstkontakt keine Rolle.

# Diskussion Runde 2: Rolle 15 (iOS-native Anmutung)

Gelesen: alle 19 Berichte. Alles weiterhin Code-Lektüre, nichts auf Gerät geprüft.

## (a) Zustimmung und Ergänzungen
- Rolle 14 F1/F2/F8 und Rolle 03 F5: bestätigen mein F1. Beide beschreiben "Weiter ohne Wirkung" und Footer unter der Tastatur. Ergänzung von mir: `enterkeyhint` ist beim iOS-Zahlenblock (`decimal`/`numeric`) grundsätzlich wirkungslos, Enter-Handler allein reichen also nicht, es braucht die Accessory-Bar (`Keyboard.setAccessoryBarVisible`) oder Textfelder mit Return-Taste.
- Rolle 13 F1/F2 und Rolle 16 F2: verstärken die Datenhaltung unter iOS. WKWebView darf localStorage bei Speicherdruck räumen, Auto-Backup fehlt. Für Jakob als Einzelnutzer ist das mein höchster Nicht-UI-Punkt (Rolle 20 F1 teilt das).
- Rolle 10 F12: Tab-Wiederholtippen scrollt nach oben/zur Wurzel. Das ist iOS-Standard und gehört zu meinem F5 (native Gesten); sehr kleiner Aufwand.
- Rolle 10 F7/F8: `@capacitor/app` ist installiert, aber ungenutzt. Das stützt mein F3 (`appStateChange`) und liefert den Einhängepunkt für `appUrlOpen` (Deep Links aus Widget/Shortcut).
- Rolle 07 F1 (Löschen/Doppeln für VoiceOver) und F9 (Zoom-Sperre in `ios/App/App/public/index.html`): beides iOS-relevant. Zu F9: Vor jedem Build `cap sync`, `user-scalable` im Release-Check prüfen.
- Rolle 09 F3/F4 und Rolle 11 F8: Erfolgs-Haptik beim Erreichen des Eiweißziels passt zu meinem F6. Ich würde Success nur einmal pro Tag auslösen.
- Rolle 13 (Kamera-Berechtigung, `App.openSettings`): richtig und iOS-typisch, nach Ablehnung zeigt iOS den Dialog nie wieder.

## (b) Widerspruch und Konflikte
- Rolle 20 F3/F4 (Apple Health streichen, Widget nicht erwähnt) gegen mein F7/F8. Ich stimme bei Health zu (verschieben bis E8 und Gewichtsverlauf). Beim Widget widerspreche ich teilweise: Es ist die einzige Funktion, die "noch Z g Eiweiß" ohne App-Start zeigt. Kompromiss: erst Rolle-20-Aufgaben (Backup, Ein-Tipp-Eintragen), dann ein einziges kleines Widget; kein Lockscreen, keine Intents im ersten Schritt.
- Rolle 10 F7 (Hardware-Back/History für Sheets): Auf iPhone gibt es keinen Hardware-Back, Ionic regelt Swipe-Back. Ich würde das nicht bauen. Kompromiss: nur Android/Web berücksichtigen, falls E8 das verlangt; der iOS-Ersatz für das Schließen ist Wisch-nach-unten (mein F2).
- Rolle 03 F1/Rolle 20 F2 (Sheet bleibt offen, Ein-Tipp-Pfad) gegen mein F2 (Sheet per Wisch schließbar). Kein echter Konflikt, aber Reihenfolge: Erst Breakpoint/Card-Stil, sonst fehlt der Wisch zum Beenden eines Dauer-Sheets. Bei Dauer-Sheet `canDismiss`-Abfrage nur bei ungespeicherter Eingabe.
- Rolle 03 F6/Rolle 03 Vorschlag "Keyboard.resize 'body'": Ich rate ab. Standard `native` lässt die WebView schrumpfen, `body` verändert Layout aller Seiten und Tab-Bar. Lieber Footer sticky mit `--keyboard-offset` testen.
- Rolle 03 (Fokus auf Suchfeld bei `didPresent` entfernen) gegen "Suche zuerst": Tastatur nur öffnen, wenn keine Favoriten/Zuletzt vorhanden sind, sonst nicht fokussieren.
- Rolle 09 F7/F8 (Skeletons, Listenanimationen) gegen "Sanft iOS" und `prefers-reduced-motion`: nur dort, wo Ladezeit real ist (Suche, Wochenplan); sonst Ionic-Standardübergänge belassen.

## (c) Fragen an mich
- Rolle 03: Verdeckt die Tastatur Footer/Favoriten? Antwort: bei Standard-`native`-Resize schrumpft die WebView, der Footer bleibt sichtbar, aber auf iPhone SE bleibt wenig Inhaltshöhe. Ungeprüft, im Simulator (SE und 15) verifizieren.
- Rolle 09: Ist die Zielplattform nativ? Ja, iOS (`ios/App`, Capacitor); Success/Warning-Haptik ist sicher verfügbar. Web-Fallback bleibt still, E8 betrifft nur den Store, nicht die Plattform.
- Rolle 10: Wird Android/Web ausgeliefert? Web per Pages ja (Zusatz), Android-Projekt liegt im Repo. Für Jakob zählt iPhone; F7 daher streichen.
- Rolle 11: Gewicht als Tab oder Kachel? Kachel auf Heute (Link zum Verlauf im Profil-Sheet); ein sechster Tab bricht E1 und die 320-px-Breite der Tab-Bar.
- Rolle 14: Direktive oder `nt-input`-Wrapper? Wrapper-Komponente (Label, Einheit, Fehler, Accessory-Bar, Select-all, Enter-Weiter), sonst driftet es erneut.
- Rolle 18: Reicht Chromium als E2E? Nein, Ziel ist WebKit; mindestens Playwright-WebKit mit iPhone-Viewport einplanen (Tastatur/Sheets bleiben trotzdem nur auf Gerät prüfbar).
- Rolle 20: Wie viele Taps kostet ein Frühstück? Nicht gemessen, aber Heute, Eintragen, Favorit, Menge, Eintragen sind rund 4 bis 5.

## (d) Top 5 über alle Rollen (Nutzen/Aufwand)
1. Tastaturbedienung: Accessory-Bar, Enter-Weiter, Select-all in einer Form-Komponente (Rolle 14 F1/F2/F8, mein F1). S bis M.
2. Fehlgeschlagenes Schreiben melden und Auto-Backup-Erinnerung (Rolle 13 F1, Rolle 16 F2, Rolle 20 F1). S.
3. Tageswechsel bei App-Resume plus Tab-Wiederholtippen (mein F3, Rolle 10 F12). S.
4. Sheets mit Breakpoints/Card-Stil, Wisch-zum-Schließen, Erfassen als Dauer-Sheet (mein F2, Rolle 03 F1). M.
5. Eiweiß im Hero und je Mahlzeit (Rolle 02 F2/F6/F8, Rolle 06 F5, Rolle 04 F1): Kernversprechen, M.

## (e) Streichen oder verschieben
- Streichen: Hardware-Back-Handling (Rolle 10 F7) für iPhone; globaler Pull-to-Refresh (mein F9); Lockscreen-Widget und App-Intents (mein F7/F8 erweitert).
- Verschieben: Apple Health bis E8 und Gewichtsverlauf stehen; Skeletons/Listenanimationen (Rolle 09 F7/F8); Spoonacular-/Preis-Ausbau (Rolle 20 F3); nativer Datei-Share (mein F11) nach dem Backup-Konzept.
- Vorziehen: Statusleiste/Light fest (mein F4), da billig und beeinflusst Tastatur und Systemsheets.

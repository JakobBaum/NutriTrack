# Rolle 12: Profil, Ziele, Einstellungen (Runde 2)

Basis: Code-Lektuere (settings.page.html/.ts, backup.ts, backup.service.ts, storage.service.ts). Laufende App nicht geprueft. Nicht doppelt gemeldet: QAE-08..10, DSG-05, SEC-01, NUT-*, IOS-06..08, UXL-07 (Runde 1).
Hinweis: Import ist inzwischen gut (Schema-Pruefung, Rollback in `replaceAll`, Endpunkte verworfen) - nicht kaputt aendern.

F1. Ziele sind nicht anpassbar (settings.page.html:8-26, kein Override in core/). Kcal und Eiweiss kommen nur aus der Formel; die Karte ist reine Anzeige. Fuer einen Protein-Tracker ist das die groesste Luecke: wer 2,0 g/kg oder ein Coach-Ziel will, kann es nicht setzen.
  Auswirkung: Kernnutzer weicht auf Schaetzwerte aus oder verliert Vertrauen. Vorschlag: Zeile "Ziele anpassen" mit Eiweiss in g (oder g/kg) und kcal als Override, "Auf Formel zuruecksetzen" daneben; Override im Profil speichern. Aufwand M. Prioritaet hoch.

F2. Profil-Formular behaelt Altzustand (settings.page.ts:105-119, 298-322). Felder werden einmal bei Seitenerzeugung aus dem Profil gelesen. Schliessen ohne Speichern behaelt die Aenderungen, nach "Alle Daten zuruecksetzen" (ts:345-359) zeigt das Formular weiter die alten Werte, und "Speichern" schreibt sie wieder.
  Auswirkung: Daten erscheinen nach Loeschen zurueck, Vorschau ("Ziel: Abnehmen") und Formular widersprechen sich. Vorschlag: Formular bei jedem Oeffnen aus `profileStore.profile()` neu befuellen (Methode `openProfile()`), nach Reset ebenso. Aufwand S. Prioritaet hoch.

F3. Reset-Dialog ohne Sicherungsangebot, Reset-Zeile direkt unter Import (html:94-101, ts:332-343). Nur "Abbrechen/Loeschen". Kein Hinweis auf letztes Backup, keine Moeglichkeit "Erst Backup exportieren". Zusaetzlich zeigt `lastBackupLabel` nach Reset noch das alte Datum (Signal im BackupService wird nicht geleert, storage.clearAll loescht nur den Schluessel).
  Auswirkung: irreversibler Datenverlust mit einem Tap-Paar. Vorschlag: Meldung um "Letztes Backup: ..." bzw. "Du hast noch kein Backup" ergaenzen, dritter Button "Backup zuerst", Zeile mit Abstand in eigene Gruppe "Gefahrenbereich"; Backup-Signal beim Reset leeren. Aufwand S. Prioritaet hoch.

F4. Einheitensystem wirkt nur teilweise (html:50-59, grep unitSystem: nur Einkauf, Kochmodus, Rezepte). Profil, Gewicht, Zielgewicht, Tempo bleiben kg/cm (html:173,181,230,241). Der Hinweis nennt den Umfang korrekt, steht aber unter dem Segment und ist leicht zu uebersehen; "Imperial" suggeriert lb im Profil.
  Auswirkung: iPhone-Nutzer in Imperial erwartet lb/ft, bekommt Mischbetrieb ohne Warnung. Vorschlag: Segment-Label "Rezepte & Einkauf: Metrisch/Imperial" bzw. Abschnitt "Einheiten fuer Rezepte" nennen; langfristig Koerperwerte mitziehen. Aufwand S (Text) / M (Koerperwerte). Prioritaet mittel.

F5. Datensicherung ist nicht sichtbar genug (html:85-112). "Backup exportieren" ist ein Zeilenlink ohne Erklaerung, was exportiert wird und wohin (iOS-Teilen-Menue: "In Dateien sichern"/iCloud). Der Hinweis (html:112) steht unter der Liste in kleiner Schrift, erinnert nie aktiv. Datenschutz-Text erwaehnt die Backup-Datei (unverschluesselt, enthaelt Gewicht, Tagebuch) nicht.
  Auswirkung: Gerätewechsel/Neuinstallation = Totalverlust fuer Nutzer, die nie exportiert haben. Vorschlag: Untertitel "JSON-Datei, z. B. in Dateien/iCloud speichern"; Hinweis auf Heute-Tab oder in der Profil-Zeile, wenn Backup aelter als 14 Tage oder fehlt und Tagebuch > 7 Tage; Satz zur Unverschluesselung im Export-Toast/Datenschutz. Aufwand S-M. Prioritaet hoch.

F6. Import: Erfolg nicht bestaetigt, Warnung vor Ersetzen ohne Auto-Sicherung (ts:394-414). `location.reload()` ohne Meldung; Nutzer sieht plotzlich Heute-Tab. Dialog sagt "ersetzt", bietet aber kein "Aktuelle Daten vorher sichern".
  Vorschlag: Vor Ersetzen automatisch Export der aktuellen Daten anbieten (Button "Erst sichern") und nach Reload kurzen Toast "Backup vom 06.11. wiederhergestellt" (sessionStorage-Flag). Aufwand M. Prioritaet mittel.

F7. Begriffe und Verstaendlichkeit im Profil (html:206-218, 237-248). a) "Aktivitaet: Leicht aktiv (1-3x/Woche)" ist unklar (Training? Schritte?) und der haeufigste Fehler bei Kalorienrechnern; kein Hinweis, dass Sport extra ist. b) Tempo-Chips zeigen nur "0,25 / 0,50 / 0,75" ohne Einheit im Chip und ohne Bezeichnung. c) "Mifflin-St Jeor" (html:17) und "Mindestzufuhr" sind Fachbegriffe. d) Zielgewicht-Abschnitt ohne Erklaerung, was es bewirkt.
  Vorschlag: Aktivitaetstext "Training 1-3x/Woche, sonst Buerojob"; Chips "0,25 kg · langsam", "0,5 kg · mittel", "0,75 kg · zuegig"; Zeile "Schaetzung nach Mifflin-St Jeor" als Info-Zeile statt Fliesstext; Zielgewicht: "Nur zur Orientierung, aendert Kalorien nicht" (falls zutreffend, sonst Wirkung nennen). Aufwand S. Prioritaet mittel.

F8. Speichern-Feedback und Zielwirkung (ts:319-321). Nach Speichern schliesst das Sheet, Toast "Tagesbedarf aktualisiert" liegt unten (durch Tab-Bar verdeckt moeglich, IXD-04 bekannt) und nennt keine Werte. Nutzer sieht das neue Ziel nur, wenn er die Karte oben ansieht; Vorher/Nachher fehlt.
  Vorschlag: Toast "Neues Ziel: 2.350 kcal, 160 g Eiweiss (vorher 2.600 / 150)". Aufwand S. Prioritaet mittel.

F9. Formular-Details. (a) Inline-Style fuer "Divers"-Hinweis (html:201, `font-size:12px;color:var(--nt-warning)`): px-Schrift, Warnfarbe auf Info, Kontrast (THM-05). (b) Kein "Abbrechen"/Aenderungsschutz im Sheet, Swipe-Down verwirft still. (c) Fehlermeldung "Bitte Gewicht, Groesse und Alter angeben." (html:263) steht unter dem Rate-Block statt am Button; Speichern ist nur ausgegraut, ohne Grund am Button.
  Vorschlag: Hinweis ueber Klasse `.hint`, Sheet mit `canDismiss`-Pruefung bei Aenderungen, Grund direkt ueber dem Button. Aufwand S. Prioritaet niedrig.

F10. KI-Verbindung als Einstellung ist ein Leerlauf (html:41-45, 276-299). Zeile "KI-Verbindung / Globaler Dienst" fuehrt in ein Sheet "Es gibt nichts einzustellen" und startet bei jedem Oeffnen eine Netzanfrage (ts:228-231). Wirkt wie Konfiguration, ist Statusanzeige.
  Vorschlag: Umbenennen in "KI-Status" mit Live-Badge (verbunden/nicht erreichbar) in der Zeile statt "Globaler Dienst"; Test nur bei Tap auf "Pruefen". Aufwand S. Prioritaet niedrig.

F11. Datenschutz-Hinweise nur im Menue "Rechtliches" und in Modals (html:329-339). Beim ersten KI-Einsatz (Foto an Gemini) erscheint kein Hinweis am Ort der Datenweitergabe; Text 336 nennt nur Gemini-Freigabe, Einwilligung wird nicht eingeholt. Datenschutz-Text ist ein langer Block ohne Gliederung/Anker, Einstellungen/Datenschutz fehlt Backup/Teilen und Spoonacular-Eigenkey-Speicherung im localStorage (SEC-06).
  Vorschlag: einmaliger Hinweis (Toast/Sheet) bei erster Foto-/Link-KI-Nutzung mit Link zur Erklaerung; Datenschutztext in Abschnitte mit Zwischenueberschriften und Kurzfassung (3 Saetze) oben. Aufwand M. Prioritaet mittel (hoch bei App-Store, E8).

F12. Seitenstruktur (html:31-83). Reihenfolge Ziel-Karte, Gewicht, "Ziele & KI", Rezeptsuche, Einheiten, App, Rechtliches, Daten. "Daten" (wichtigste Sicherheitsfunktion) steht ganz unten hinter Rechtlichem; "Ziele & KI" mischt Persoenliches und Technik. Titel "Profil" aber enthaelt App-Einstellungen.
  Vorschlag: Reihenfolge Ziel/Profil, Einheiten, Daten & Backup, KI/Rezeptsuche, Hilfe, Rechtliches; Titel "Profil & Einstellungen" oder zwei Gruppen mit klarem Kopf. Aufwand S. Prioritaet niedrig.

Fragen/Thesen an andere Rollen:
1. Ernaehrungs-/Coach-Rolle: Ist ein freier Eiweiss-Override (F1) fachlich vertretbar, oder braucht er Grenzen/Warnung (z. B. >2,5 g/kg), und gilt dasselbe fuer ein kcal-Override?
2. Datenschutz-/Release-Rolle: Reicht ein Backup-Hinweis in der App, oder muss vor TestFlight/App Store Backup verschluesselbar (Passphrase) und per iCloud automatisch sein, weil localStorage in WKWebView bei Speicherdruck geleert werden kann?
3. UX-/Design-Rolle: Sollen Einstellungen und Profil zwei Tabs/Bereiche werden (Profil im Heute-Kopf, Einstellungen als Zahnrad), damit "Profil" nicht Rechtliches und KI-Status enthaelt?

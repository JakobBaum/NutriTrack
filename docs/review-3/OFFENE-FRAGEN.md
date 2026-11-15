# Fragen an Jakob und Antworten

Stand 2026-11-14. Antworten vom 2026-11-14 stehen jeweils dabei.

## Beantwortet

1. **Merge Wellen 2, 3, 5 und Absicherung in main?** Ja. Erledigt (`92b919d`).
2. **Worker-Deploy?** Ja, zusammen mit dem Merge. Erledigt (Version `5951af28`), `/health`, TikTok-Sperre und Rezeptroute nach dem Deploy geprüft.
3. **Ziel:** derzeit nur Jakob, eine Veröffentlichung ist später möglich.
4. **Öffentlich lassen?** Vorerst GitHub Pages abschalten und Repo privat stellen. Noch nicht umgesetzt, siehe "Offen".
5. **Tarife:** kostenloser Gemini-Key, Spoonacular-Gratisplan. Hinweis: Der kostenlose Gemini-Dienst ist laut Google-Bedingungen im EWR nicht vorgesehen. Vor einer Veröffentlichung auf den bezahlten Tarif wechseln.
6. **Impressum:** entfällt, solange die Seite nicht öffentlich ist.
7. **Gespeicherte Online-Rezepte:** umbauen. Dauerhaft nur ID, Titel und Bild-URL, beim Öffnen neu laden.
8. **Einwilligung:** bleibt drin.
9. **Worker absichern (Origin-Pflicht):** ja, vorher prüfen, ob die iOS-App durchkommt.
10. **Welle 4 A (Essen beschreiben):** Go.
11. **Welle 4 B (TikTok):** wird nicht gebaut.
12. **Fastfood: Land** kommt ins Profil.
13. **Fastfood-Schaltflächen:** nach der ersten Runde nur "Weitere Vorschläge"; "Vorschläge holen" erst wieder bei geänderten Angaben.
14. **Mittlere Befunde:** alle 15 beheben.
15. **Kleinigkeiten:** alle ja. Hinweis bei gleichlautenden Wörtern (z. B. "Avocado") unterdrücken, Meldung bei Serverabbruch auf "Dienst gerade nicht erreichbar", `.nt-pill` und `.nt-add-btn` auf `.nt-btn` umstellen und tote Stilregeln entfernen.

## Offen

- **Pages abschalten und Repo privat stellen:** Ein privates Repo im Gratis-Plan hat kein GitHub Pages. Wenn du die App am iPhone über die Web-Adresse nutzt, ist sie danach weg. Wie startest du die App am iPhone (Web-Adresse oder installierte App)?
- **Offline in der Web-Version:** Ohne Service Worker lädt ein Tab, der offline zum ersten Mal geöffnet wird, möglicherweise nicht. Am iPhone im Flugmodus prüfen.

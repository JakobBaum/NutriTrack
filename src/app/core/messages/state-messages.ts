/**
 * Fehler- und Zustandskatalog (Deutsch). Regel: Satz 1 nennt, was los ist; Satz 2 sagt im Du-Imperativ,
 * was jetzt zu tun ist. Nur Punkte, keine Gedankenstriche. Keine Schlüssel- oder Einstellungshinweise,
 * die es in der App nicht gibt (die KI hat keine Einstellung, nur eine Statusanzeige).
 */
export const STATE_MESSAGES = {
  offline: 'Keine Internetverbindung. Prüfe WLAN oder Mobilnetz und versuche es erneut.',
  aiUnavailable: 'Die KI ist gerade nicht verfügbar. Versuche es später erneut.',
  aiOverloaded: 'Die KI ist gerade überlastet. Versuche es in einer Minute erneut.',
  aiLinkBlocked: 'Von dieser Seite können wir keine Rezepte abrufen. Kopiere den Rezepttext und füge ihn ein.',
  aiUnreadable: 'Die Antwort der KI war nicht lesbar. Versuche es noch einmal.',
  aiTimeout: 'Die KI antwortet gerade nicht. Versuche es erneut.',
  aiGeneric: 'Die KI-Anfrage ist fehlgeschlagen. Versuche es erneut.',
  rateLimited: 'Zu viele Anfragen. Warte kurz und versuche es erneut.',
  needsAi: 'Dafür ist die KI nötig, sie ist gerade nicht verbunden. Du kannst den Rezepttext stattdessen einfügen.',
  foodRateLimited: 'Zu viele Anfragen an die Lebensmittel-Datenbank. Warte kurz und versuche es erneut.',
  foodTimeout: 'Die Lebensmittel-Datenbank antwortet gerade nicht. Versuche es erneut.',
  foodServer: 'Die Lebensmittel-Datenbank ist gerade nicht erreichbar. Versuche es später erneut.',
  foodImplausible: 'Die Daten zu diesem Produkt sind offensichtlich fehlerhaft. Scanne das Etikett oder trage die Werte von Hand ein.',
  foodGeneric: 'Die Abfrage ist fehlgeschlagen. Versuche es erneut.',
  consentRequired: 'Dafür brauchst du die Zustimmung zu den Online-Funktionen. Du findest sie unter Profil.',
  importFailed: 'Der Import ist fehlgeschlagen, der Grund ist unbekannt. Prüfe Text oder Link und versuche es erneut.',
} as const;

export type StateMessageKey = keyof typeof STATE_MESSAGES;

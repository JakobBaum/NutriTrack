import { UrlTree } from '@angular/router';

/** Rechtliche Infos, die per Link direkt geöffnet werden können (z. B. aus dem Zustimmungsdialog). */
export type InfoSectionId = 'anleitung' | 'datenschutz' | 'quellen' | 'agb' | 'hilfe';

const INFO_SECTIONS: readonly InfoSectionId[] = ['anleitung', 'datenschutz', 'quellen', 'agb', 'hilfe'];

/** Name des Abfrageparameters, der den Abschnitt nennt. */
export const INFO_PARAM = 'info';

/** Link zur Datenschutzerklärung in den Einstellungen. */
export const PRIVACY_INFO_URL = `/settings?${INFO_PARAM}=datenschutz`;

/** Liest den Abschnitt aus dem Parameterwert; `null` bei fehlendem oder unbekanntem Wert. */
export function parseInfoSection(value: unknown): InfoSectionId | null {
  return typeof value === 'string' && (INFO_SECTIONS as readonly string[]).includes(value) ? (value as InfoSectionId) : null;
}

/** Abschnitt aus einem Link auf die Einstellungen (`/settings?info=...`); `null` bei anderer Seite oder unbekanntem Wert. */
export function infoLinkSection(tree: UrlTree): InfoSectionId | null {
  const segments = tree.root.children['primary']?.segments ?? [];
  if (!segments.some((seg) => seg.path === 'settings')) return null;
  return parseInfoSection(tree.queryParams[INFO_PARAM]);
}

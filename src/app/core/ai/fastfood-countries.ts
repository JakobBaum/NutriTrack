/** Länder, deren Fastfood-Sortiment der Helfer kennt (feste Liste, kein Standortzugriff). */
export const FASTFOOD_COUNTRIES: readonly string[] = [
  'Österreich', 'Deutschland', 'Schweiz', 'Italien', 'Spanien', 'Frankreich', 'Niederlande', 'Vereinigtes Königreich', 'USA',
];

export const DEFAULT_FASTFOOD_COUNTRY = 'Österreich';

/** Gültiges Land aus einem unbekannten (z. B. gespeicherten) Wert; sonst die Vorgabe. */
export function parseFastfoodCountry(raw: unknown): string {
  return typeof raw === 'string' && FASTFOOD_COUNTRIES.includes(raw) ? raw : DEFAULT_FASTFOOD_COUNTRY;
}

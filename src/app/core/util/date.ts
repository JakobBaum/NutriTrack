/** Datums-Helfer. Kalendertage werden als ISO "YYYY-MM-DD" (lokal) geführt. */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1000;

/** True für einen echten Kalendertag "YYYY-MM-DD" (Round-Trip: "2026-02-31" ist ungültig). */
export function isIsoDay(v: unknown): v is string {
  const m = typeof v === 'string' ? ISO_DATE_RE.exec(v) : null;
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= MIN_YEAR && dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Lokales Datum (nicht UTC) als "YYYY-MM-DD". */
export function toDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Verschiebt einen ISO-Tag um `days` (±) und gibt den neuen ISO-Tag zurück. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateISO(dt);
}

/** Nutzerfreundliches Label: "Heute", "Gestern", "Morgen" oder "Mo., 13.10.". */
export function dayLabel(dateISO: string, today: string = toDateISO()): string {
  if (dateISO === today) return 'Heute';
  if (dateISO === addDaysISO(today, -1)) return 'Gestern';
  if (dateISO === addDaysISO(today, 1)) return 'Morgen';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][dt.getDay()];
  return `${wd}, ${`${d}`.padStart(2, '0')}.${`${m}`.padStart(2, '0')}.`;
}

/**
 * Tageswechsel (z. B. nach Mitternacht): Stand der Nutzer auf "Heute" (`shownToday`),
 * springt die Auswahl auf den neuen Tag mit; ein bewusst gewählter anderer Tag bleibt.
 */
export function rollDate(
  selected: string,
  shownToday: string,
  nowToday: string,
): { selected: string; today: string } {
  return { selected: selected === shownToday ? nowToday : selected, today: nowToday };
}

/** Datums-Helfer. Kalendertage werden als ISO "YYYY-MM-DD" (lokal) geführt. */

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
export function dayLabel(dateISO: string): string {
  const today = toDateISO();
  if (dateISO === today) return 'Heute';
  if (dateISO === addDaysISO(today, -1)) return 'Gestern';
  if (dateISO === addDaysISO(today, 1)) return 'Morgen';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][dt.getDay()];
  return `${wd}, ${`${d}`.padStart(2, '0')}.${`${m}`.padStart(2, '0')}.`;
}

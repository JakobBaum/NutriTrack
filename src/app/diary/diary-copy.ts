import { DiaryEntry } from '../core/models';
import { CopySource } from '../core/state/diary.store';
import { formatNum } from '../shared/num.pipe';
import { dayLabel } from '../core/util/date';

/** Relative Tagesnamen, die im Satz kleingeschrieben werden ("wie gestern"). */
const RELATIVE_DAYS = new Set(['Heute', 'Gestern', 'Morgen']);

/** "wie gestern" bzw. "wie am Mo., 03.11." für einen Quelltag. */
export function copyFromText(dateISO: string): string {
  const label = dayLabel(dateISO);
  return RELATIVE_DAYS.has(label) ? `wie ${label.toLowerCase()}` : `wie am ${label}`;
}

/** Wie copyFromText, aber großgeschrieben für Schaltflächen ("Wie gestern"). */
export function copyFromButtonText(dateISO: string): string {
  const text = copyFromText(dateISO);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Summe der kcal einer Eintragsliste (gerundet). */
export function entriesKcal(entries: readonly DiaryEntry[]): number {
  return Math.round(entries.reduce((sum, e) => sum + (e.facts.kcal || 0), 0));
}

/** "1 Eintrag" / "3 Einträge". */
export function entryCountText(count: number): string {
  return count === 1 ? '1 Eintrag' : `${count} Einträge`;
}

/** Zeile für die Tagesauswahl im Kopieren-Dialog: "Gestern · 5 Einträge · 1.850 kcal". */
export function copySourceOptionText(source: CopySource): string {
  const kcal = formatNum(entriesKcal(source.entries), 0);
  return `${dayLabel(source.dateISO)} · ${entryCountText(source.entries.length)} · ${kcal} kcal`;
}

import { formatNum } from '../shared/num.pipe';

/** Kurzdatum "08.11." für die Liste. */
export function shortDate(dateISO: string): string {
  const [, m, d] = dateISO.split('-');
  return `${d}.${m}.`;
}

/** Trend als Text, z. B. "−0,4 kg pro Woche"; das Vorzeichen richtet sich nach dem gerundeten Wert. */
export function trendText(trend: number | null): string | null {
  if (trend === null) return null;
  const rounded = Math.round(trend * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return `${sign}${formatNum(Math.abs(rounded), 1)} kg pro Woche`;
}

/** Datumstexte der Diagrammachse; mit Jahr, sobald der Verlauf zwei Jahre berührt. */
export function axisDateLabels(firstISO: string, lastISO: string): [string, string] {
  if (!firstISO || !lastISO) return ['', ''];
  const sameYear = firstISO.slice(0, 4) === lastISO.slice(0, 4);
  const label = (iso: string): string => (sameYear ? shortDate(iso) : `${shortDate(iso)}${iso.slice(0, 4)}`);
  return [label(firstISO), label(lastISO)];
}

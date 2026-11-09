/** Reine Rechenlogik für den Gewichtsverlauf (keine Angular-Abhängigkeit). */

export interface WeightEntry {
  /** Kalendertag "YYYY-MM-DD"; höchstens ein Eintrag je Tag. */
  readonly dateISO: string;
  readonly kg: number;
}

export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;
/** Fenster der Glättung in Tagen (der Tag selbst plus die 6 Tage davor). */
export const SMOOTHING_DAYS = 7;
/** Der Trend betrachtet nur diese letzten Tage. */
export const TREND_WINDOW_DAYS = 28;
/** Ein Trend braucht mindestens diese Zeitspanne zwischen erstem und letztem Eintrag. */
export const MIN_TREND_SPAN_DAYS = 7;
/** Ab dieser Abweichung zum Profilgewicht wird das Neuberechnen vorgeschlagen. */
export const RECALC_DRIFT_KG = 2;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Tage seit dem Ursprung (über UTC), für Abstände zwischen Kalendertagen. */
export function dayNumber(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function isValidWeight(kg: unknown): kg is number {
  return typeof kg === 'number' && Number.isFinite(kg) && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Legt den Eintrag an oder ersetzt den des gleichen Tags; Ergebnis nach Datum sortiert. Ungültiges lässt die Liste unverändert. */
export function upsertWeight(list: readonly WeightEntry[], entry: WeightEntry): readonly WeightEntry[] {
  if (!ISO_DAY.test(entry.dateISO) || !isValidWeight(entry.kg)) return list;
  const next: WeightEntry = { dateISO: entry.dateISO, kg: round1(entry.kg) };
  return [...list.filter((x) => x.dateISO !== next.dateISO), next].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export function removeWeight(list: readonly WeightEntry[], dateISO: string): readonly WeightEntry[] {
  return list.filter((x) => x.dateISO !== dateISO);
}

/** Gleitender 7-Tage-Mittelwert je Eintrag (Einträge der letzten 7 Tage inklusive des Tages selbst). */
export function smoothWeights(list: readonly WeightEntry[]): readonly WeightEntry[] {
  return list.map((point) => {
    const end = dayNumber(point.dateISO);
    const window = list.filter((x) => {
      const n = dayNumber(x.dateISO);
      return n <= end && n > end - SMOOTHING_DAYS;
    });
    const mean = window.reduce((sum, x) => sum + x.kg, 0) / window.length;
    return { dateISO: point.dateISO, kg: round2(mean) };
  });
}

/**
 * Trend in kg pro Woche: Steigung einer Ausgleichsgeraden durch die geglätteten Punkte der
 * letzten 28 Tage. null, wenn weniger als zwei Punkte oder weniger als 7 Tage Spanne vorliegen.
 */
export function trendKgPerWeek(list: readonly WeightEntry[]): number | null {
  if (list.length === 0) return null;
  const smoothed = smoothWeights(list);
  const last = dayNumber(smoothed[smoothed.length - 1].dateISO);
  const points = smoothed
    .map((x) => ({ x: dayNumber(x.dateISO), y: x.kg }))
    .filter((p) => p.x > last - TREND_WINDOW_DAYS);
  if (points.length < 2) return null;
  const span = points[points.length - 1].x - points[0].x;
  if (span < MIN_TREND_SPAN_DAYS) return null;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
  const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  return den === 0 ? null : round2((num / den) * 7);
}

/** Abweichung (neu minus Profil) in kg, sobald sie mindestens 2 kg beträgt; sonst null. */
export function driftSinceProfile(profileKg: number | null, latestKg: number | null): number | null {
  if (profileKg === null || latestKg === null) return null;
  const drift = Math.round((latestKg - profileKg) * 10) / 10;
  return Math.abs(drift) >= RECALC_DRIFT_KG ? drift : null;
}

/**
 * Soll der Hinweis „Ziel neu berechnen“ erscheinen? Nur bei Abweichung zum Profil und einmalig:
 * Nach dem Ausblenden (gemerktes Gewicht) kommt er erst bei weiteren 2 kg Änderung wieder.
 */
export function shouldShowDriftHint(profileKg: number | null, latestKg: number | null, dismissedAtKg: number | null): boolean {
  if (driftSinceProfile(profileKg, latestKg) === null || latestKg === null) return false;
  return dismissedAtKg === null || Math.abs(latestKg - dismissedAtKg) >= RECALC_DRIFT_KG;
}

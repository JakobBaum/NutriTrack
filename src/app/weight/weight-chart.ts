import { WeightEntry, dayNumber, smoothWeights } from '../core/weight/weight-math';

export interface ChartSize {
  readonly width: number;
  readonly height: number;
  readonly padX: number;
  readonly padY: number;
}

export interface ChartDot {
  readonly x: number;
  readonly y: number;
  readonly dateISO: string;
  readonly kg: number;
}

export interface WeightChart {
  /** Rohwerte als Punkte. */
  readonly dots: readonly ChartDot[];
  /** Geglättete Werte (7 Tage) als Punkte. */
  readonly smoothDots: readonly ChartDot[];
  /** SVG-Pfad der geglätteten Linie; leer bei nur einem Punkt. */
  readonly linePath: string;
  /** Obere und untere Achsengrenze (gerundet, kg). */
  readonly maxLabelKg: number;
  readonly minLabelKg: number;
}

/** Mindesthöhe der Achse in kg, damit kleine Schwankungen nicht dramatisch wirken. */
const MIN_RANGE_KG = 2;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Rechnet Gewichtseinträge in Koordinaten eines schlanken SVG-Liniendiagramms um. */
export function buildWeightChart(entries: readonly WeightEntry[], size: ChartSize): WeightChart | null {
  if (entries.length === 0) return null;
  const smooth = smoothWeights(entries);
  const values = [...entries, ...smooth].map((e) => e.kg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const mid = (lo + hi) / 2;
  const half = Math.max(hi - lo, MIN_RANGE_KG) / 2;
  const minKg = mid - half;
  const maxKg = mid + half;

  const first = dayNumber(entries[0].dateISO);
  const span = dayNumber(entries[entries.length - 1].dateISO) - first;
  const innerW = size.width - size.padX * 2;
  const innerH = size.height - size.padY * 2;
  const xOf = (dateISO: string): number =>
    span === 0 ? size.width / 2 : size.padX + ((dayNumber(dateISO) - first) / span) * innerW;
  const yOf = (kg: number): number => round1(size.padY + ((maxKg - kg) / (maxKg - minKg)) * innerH);
  const toDot = (e: WeightEntry): ChartDot => ({ x: round1(xOf(e.dateISO)), y: yOf(e.kg), dateISO: e.dateISO, kg: e.kg });

  const smoothDots = smooth.map(toDot);
  const linePath = smoothDots.length < 2 ? '' : smoothDots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x} ${d.y}`).join(' ');
  return {
    dots: entries.map(toDot),
    smoothDots,
    linePath,
    maxLabelKg: Math.ceil(maxKg * 10) / 10,
    minLabelKg: Math.floor(minKg * 10) / 10,
  };
}

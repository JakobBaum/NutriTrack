/**
 * Parser für OCR-Text von Nährwerttabellen (DE/EN). Reine Funktion ohne Abhängigkeiten.
 * Liefert Werte pro 100 g/ml (bzw. pro Portion, wenn nur diese Spalte existiert).
 */

export type LabelField =
  | 'kcal' | 'fatG' | 'saturatedFatG' | 'carbsG' | 'sugarG' | 'fiberG' | 'proteinG' | 'saltG';

export type LabelBasis = 'per100g' | 'per100ml' | 'perPortion';

export interface ParsedNutritionLabel {
  values: Partial<Record<LabelField, number>>;
  /** Gefundene Felder in fester Reihenfolge. */
  found: LabelField[];
  basis: LabelBasis;
  /** 0..1, aus Vollständigkeit und Plausibilität. */
  confidence: number;
}

const KJ_PER_KCAL = 4.184;
const SODIUM_TO_SALT = 2.5;
const MAX_KCAL_PER_100 = 950;
const MAX_GRAMS_PER_100 = 100;
const MAX_UNITLESS_LINE = 40;
const MACRO_TOLERANCE = 0.35;
const INCONSISTENT_FACTOR = 0.7;
const ASSUMED_BASIS_FACTOR = 0.9;

const FIELD_ORDER: readonly LabelField[] = [
  'kcal', 'fatG', 'saturatedFatG', 'carbsG', 'sugarG', 'fiberG', 'proteinG', 'saltG',
];
const CONFIDENCE_WEIGHTS: Record<LabelField, number> = {
  kcal: 0.3, proteinG: 0.2, carbsG: 0.2, fatG: 0.2, sugarG: 0.05, fiberG: 0.03, saltG: 0.02, saturatedFatG: 0,
};

type KeywordKind = LabelField | 'energy' | 'sodium';

const KEYWORDS: readonly [KeywordKind, RegExp][] = [
  ['energy', /energie|brennwert|energy|kalorien|calories/],
  ['saturatedFatG', /(?<!un)ges[aä]ttigt|saturate/],
  ['sugarG', /zucker|sugar/],
  ['fatG', /\bfett|\bfat\b|lipid/],
  ['carbsG', /kohlen\s?hydrat|carbohydrate|\bcarbs?\b/],
  ['fiberG', /ballast|\bfib(?:re|er)/],
  ['proteinG', /eiwei[ßsf3l]|protein/],
  ['saltG', /\bsalz|\bsalt\b/],
  ['sodium', /natrium|sodium/],
];
const IGNORED_LINE = /unges[aä]ttigt|mono|poly|mehrfach|einfach|trans/;

const DIGITS = '[0-9OoIl|]';
const NUMBER_RE = new RegExp(
  `(?<![A-Za-zäöüß0-9.,])([<≤]?)\\s*(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*(kcal|kj|mg|g|%)?(?![A-Za-zäöüß0-9])`,
  'g',
);
const KCAL_UNIT = '(?:kc[a4][l1i]|kcal)';
const ENERGY_VALUES_RE = new RegExp(
  `(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*(${KCAL_UNIT}|kj)(?![a-z])`,
  'g',
);
const LONE_KCAL_RE = new RegExp(`^\\s*[0-9OoIl|.,]+\\s*${KCAL_UNIT}`);
const PER_100_STRIP_RE = /(?:pro|per|je|\/)\s*100\s*(?:g|ml)/g;
const BASIS_100_RE = /100\s*(g|ml)\b/;
const PORTION_RE = /portion|serving|riegel|stück|scheibe/;

interface Num { value: number; unit: string }
type Values = Partial<Record<LabelField, number>>;

/** Ersetzt typische OCR-Verwechslungen (O→0, l/I/|→1) innerhalb einer Zahl. */
function cleanDigits(raw: string): number {
  return Number(raw.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(',', '.'));
}

function normalize(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[ \t]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .toLowerCase();
}

/** Alle Zahlen einer Zeile (ohne Prozentangaben), `<`-Werte als halber Grenzwert. */
function extractNumbers(line: string): Num[] {
  const cleaned = line.replace(PER_100_STRIP_RE, ' ');
  const out: Num[] = [];
  for (const m of cleaned.matchAll(NUMBER_RE)) {
    const unit = m[3] ?? '';
    if (unit === '%' || !/[0-9]/.test(m[2])) continue;
    const base = cleanDigits(m[2]);
    if (!Number.isFinite(base)) continue;
    out.push({ value: m[1] ? base / 2 : base, unit });
  }
  return out;
}

function firstKeyword(line: string): KeywordKind | null {
  let best: { kind: KeywordKind; index: number } | null = null;
  for (const [kind, re] of KEYWORDS) {
    const index = line.search(re);
    if (index >= 0 && (best === null || index < best.index)) best = { kind, index };
  }
  return best?.kind ?? null;
}

/** Spaltenindex der 100-g-Spalte: 1, wenn die Portion im Kopf vor "100 g" steht. */
function per100Column(text: string): number {
  const i100 = text.search(BASIS_100_RE);
  const iPortion = text.search(PORTION_RE);
  return i100 >= 0 && iPortion >= 0 && iPortion < i100 ? 1 : 0;
}

function detectBasis(text: string): { basis: LabelBasis; assumed: boolean } {
  const m = text.match(BASIS_100_RE);
  if (m) {
    const isMl = m[1] === 'ml' && !/100\s*g\b/.test(text);
    return { basis: isMl ? 'per100ml' : 'per100g', assumed: false };
  }
  if (PORTION_RE.test(text)) return { basis: 'perPortion', assumed: false };
  return { basis: 'per100g', assumed: true };
}

function pickColumn<T>(items: T[], column: number): T | undefined {
  return items[column] ?? items[0];
}

/** Energie-Zeile: kcal bevorzugt, sonst kJ / 4,184. */
function readEnergy(line: string, column: number): number | undefined {
  const kcal: number[] = [];
  const kj: number[] = [];
  for (const m of line.matchAll(ENERGY_VALUES_RE)) {
    const raw = m[1];
    const value = /^\d\.\d{3}$/.test(raw) ? Number(raw.replace('.', '')) : cleanDigits(raw);
    (m[2] === 'kj' ? kj : kcal).push(value);
  }
  const k = pickColumn(kcal, column);
  if (k !== undefined) return k;
  const j = pickColumn(kj, column);
  return j === undefined ? undefined : j / KJ_PER_KCAL;
}

function toGrams(n: Num): number {
  return n.unit === 'mg' ? n.value / 1000 : n.value;
}

function readGrams(line: string, column: number): number | undefined {
  const nums = extractNumbers(line).filter((n) => n.unit !== 'kcal' && n.unit !== 'kj');
  const withUnit = nums.filter((n) => n.unit === 'g' || n.unit === 'mg');
  if (withUnit.length > 0) {
    const picked = pickColumn(withUnit, column);
    return picked === undefined ? undefined : toGrams(picked);
  }
  if (line.length > MAX_UNITLESS_LINE) return undefined;
  return pickColumn(nums, column)?.value;
}

function isPlausible(field: LabelField, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  return field === 'kcal' ? value <= MAX_KCAL_PER_100 : value <= MAX_GRAMS_PER_100;
}

function startsWithNumber(line: string): boolean {
  return /^\s*[<≤]?\s*[0-9]/.test(line);
}

function hasValues(line: string): boolean {
  ENERGY_VALUES_RE.lastIndex = 0;
  return extractNumbers(line).length > 0 || new RegExp(ENERGY_VALUES_RE.source).test(line);
}

function parseLines(lines: string[], column: number): Values {
  const values: Values = {};
  const set = (field: LabelField, v: number | undefined): void => {
    if (v !== undefined && values[field] === undefined && isPlausible(field, v)) values[field] = v;
  };
  lines.forEach((line, i) => {
    if (IGNORED_LINE.test(line)) return;
    const kind = firstKeyword(line);
    if (kind === null) {
      // Alleinstehende kcal-Zeile (Energie wurde auf zwei Zeilen umbrochen).
      if (LONE_KCAL_RE.test(line)) set('kcal', readEnergy(line, column));
      return;
    }
    // Werte stehen teils in der Folgezeile.
    const next = lines[i + 1] ?? '';
    const source = !hasValues(line) && startsWithNumber(next) ? `${line} ${next}` : line;
    // Steht nur kJ in der Zeile und kcal in der Folgezeile, gilt der echte kcal-Wert (nicht kJ / 4,184).
    const energySource = !/kcal/i.test(line) && LONE_KCAL_RE.test(next) ? `${line} ${next}` : source;
    if (kind === 'energy') set('kcal', readEnergy(energySource, column));
    else if (kind === 'sodium') {
      const g = readGrams(source, column);
      set('saltG', g === undefined ? undefined : g * SODIUM_TO_SALT);
    } else set(kind, readGrams(source, column));
  });
  return values;
}

/** Entfernt widersprüchliche Teilwerte (Zucker > Kohlenhydrate, gesättigt > Fett). */
function dropInconsistent(values: Values): Values {
  const next = { ...values };
  const over = (part?: number, total?: number): boolean =>
    part !== undefined && total !== undefined && part > total * 1.05 + 0.1;
  if (over(next.sugarG, next.carbsG)) delete next.sugarG;
  if (over(next.saturatedFatG, next.fatG)) delete next.saturatedFatG;
  return next;
}

function computeConfidence(values: Values, assumedBasis: boolean): number {
  let score = FIELD_ORDER.reduce((sum, f) => sum + (values[f] === undefined ? 0 : CONFIDENCE_WEIGHTS[f]), 0);
  const { kcal, proteinG, carbsG, fatG } = values;
  if (kcal !== undefined && proteinG !== undefined && carbsG !== undefined && fatG !== undefined) {
    const computed = 4 * proteinG + 4 * carbsG + 9 * fatG + 2 * (values.fiberG ?? 0);
    if (Math.abs(computed - kcal) > Math.max(kcal, 1) * MACRO_TOLERANCE) score *= INCONSISTENT_FACTOR;
  }
  if (assumedBasis) score *= ASSUMED_BASIS_FACTOR;
  return Math.round(Math.min(1, score) * 100) / 100;
}

/** Liest Nährwerte pro 100 g/ml aus rohem OCR-Text einer deutschen oder englischen Tabelle. */
export function parseNutritionLabel(text: string): ParsedNutritionLabel {
  const normalized = normalize(text ?? '');
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const { basis, assumed } = detectBasis(normalized);
  const values = dropInconsistent(parseLines(lines, basis === 'perPortion' ? 0 : per100Column(normalized)));
  const found = FIELD_ORDER.filter((f) => values[f] !== undefined);
  return { values, found, basis, confidence: computeConfidence(values, assumed) };
}

import { DiaryEntry, NutritionFacts } from '../core/models';
import { formatNum } from '../shared/num.pipe';

/** kcal je Gramm (Atwater). */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Bis zu diesem Rest (g Eiweiß) nennt der Fastfood-Hinweis das Restprotein. */
const SMALL_PROTEIN_REMAINDER_G = 40;

/** Nur Kalorien färben den Ring bei Überschreitung rot; Eiweiß nie, Zucker ist nur ein Richtwert. */
const WARN_MACROS: readonly string[] = ['kcal'];

const SUGAR_NOTE =
  'Der Richtwert (unter 10 % der Energie) gilt für freien Zucker. Die App zählt Gesamtzucker, auch aus Obst und Milch, deshalb ist der Wert nur eine Orientierung.';

/** Weiche Trennstellen für Namen, die in schmalen Ring-Kacheln sonst überlaufen. */
const SOFT_HYPHEN_LABELS: Readonly<Record<string, string>> = {
  Kohlenhydrate: 'Kohlen­hydrate',
  Ballaststoffe: 'Ballast­stoffe',
};

export interface MacroEnergyShares {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/** True, wenn eine Überschreitung dieses Werts als Warnung (rot) gezeigt wird. */
export function isWarnMacro(key: string): boolean {
  return WARN_MACROS.includes(key);
}

/** Erklärender Hinweis zu einem Wert (nur Zucker), sonst null. */
export function macroNote(key: string): string | null {
  return key === 'sugar' ? SUGAR_NOTE : null;
}

/** Anteil von Eiweiß, Kohlenhydraten und Fett an der Energie der drei Makros (Summe 100); null ohne Energie. */
export function macroEnergyShares(m: { proteinG: number; carbsG: number; fatG: number }): MacroEnergyShares | null {
  const p = m.proteinG * KCAL_PER_G.protein;
  const c = m.carbsG * KCAL_PER_G.carbs;
  const f = m.fatG * KCAL_PER_G.fat;
  const total = p + c + f;
  if (!Number.isFinite(total) || total <= 0) return null;
  const proteinPct = Math.round((p / total) * 100);
  const carbsPct = Math.round((c / total) * 100);
  return { proteinPct, carbsPct, fatPct: 100 - proteinPct - carbsPct };
}

/** Hinweis „noch X g Eiweiß“, wenn der Rest klein, aber noch offen ist; sonst null. */
export function proteinHint(remainingG: number): string | null {
  if (!Number.isFinite(remainingG) || remainingG <= 0 || remainingG > SMALL_PROTEIN_REMAINDER_G) return null;
  return `noch ${formatNum(remainingG, 0)} g Eiweiß`;
}

/** Eiweiß (g, gerundet) der Einträge. */
export function proteinOfEntries(entries: readonly Pick<DiaryEntry, 'facts'>[]): number {
  return Math.round(entries.reduce((sum, e) => sum + (e.facts.proteinG || 0), 0));
}

/** Label mit weichen Trennstellen (nur für die Anzeige, nicht für aria-label). */
export function softHyphenLabel(label: string): string {
  return SOFT_HYPHEN_LABELS[label] ?? label;
}

export interface DrillItem {
  label: string;
  value: number;
  percent: number;
}

export interface DrillData {
  label: string;
  unit: string;
  total: number;
  /** Tagesziel dieses Werts und Anteil der Tagessumme daran (Prozent, 0 ohne Ziel). */
  target: number;
  targetPercent: number;
  color: string;
  /** True, wenn das Ziel dieses Werts deutlich überschritten ist (Warnfarbe). */
  over: boolean;
  /** Erklärung zum Wert (z. B. Zucker: Gesamtzucker gegen Richtwert für freien Zucker). */
  note: string | null;
  items: DrillItem[];
}

/** Angaben der Nährwert-Kachel, die der Drill-Down braucht. */
export interface DrillMacro {
  label: string;
  color: string;
  warn: boolean;
  overBy: number;
  target: number;
}

const FACT_KEYS: Readonly<Record<string, keyof NutritionFacts>> = {
  kcal: 'kcal', protein: 'proteinG', carbs: 'carbsG',
  fat: 'fatG', fiber: 'fiberG', sugar: 'sugarG',
};

/** Wert eines Nährwerts (nach Schlüssel wie "protein") aus den Angaben; unbekannt oder fehlend ergibt 0. */
export function factValue(facts: NutritionFacts, key: string): number {
  const prop = FACT_KEYS[key];
  if (!prop) return 0;
  const v = facts[prop];
  return typeof v === 'number' ? v : 0;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Aufschlüsselung eines Nährwerts nach Einträgen (größte zuerst, Einträge ohne Wert entfallen). */
export function buildDrillData(
  key: string,
  entries: readonly Pick<DiaryEntry, 'label' | 'facts'>[],
  macro: DrillMacro | undefined,
): DrillData {
  const items = entries
    .map((e) => ({ label: e.label, value: factValue(e.facts, key) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);
  const target = macro?.target ?? 0;
  return {
    label: macro?.label ?? (key === 'kcal' ? 'Kalorien' : key),
    unit: key === 'kcal' ? 'kcal' : 'g',
    color: macro?.color ?? (key === 'kcal' ? 'var(--nt-kcal)' : 'var(--ion-color-primary)'),
    over: !!macro && macro.warn && macro.overBy > 0,
    target,
    note: macroNote(key),
    targetPercent: target > 0 ? Math.round((total / target) * 100) : 0,
    total: round1(total),
    items: items.map((i) => ({
      ...i,
      value: round1(i.value),
      percent: total > 0 ? Math.round((i.value / total) * 100) : 0,
    })),
  };
}

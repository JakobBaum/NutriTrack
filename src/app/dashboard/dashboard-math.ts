import { DiaryEntry } from '../core/models';
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

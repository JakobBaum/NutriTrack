/** Gemeinsame Typ-Guards für gespeicherte und importierte Daten (rein, wirft nie). */

export type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
/** Endliche Zahl. */
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Endliche Zahl >= 0. */
export const isNonNegative = (v: unknown): v is number => isNum(v) && v >= 0;
/** Endliche Zahl > 0. */
export const isPositive = (v: unknown): v is number => isNum(v) && v > 0;
/** Fehlt (`undefined`/`null`) oder endliche Zahl >= 0. */
export const isOptNonNegative = (v: unknown): boolean => v === undefined || v === null || isNonNegative(v);
/** Fehlt (`undefined`/`null`) oder endliche Zahl > 0. */
export const isOptPositive = (v: unknown): boolean => v === undefined || v === null || isPositive(v);

/** Nährwerte: kcal, Eiweiß, Kohlenhydrate, Fett endlich und >= 0; optionale Werte fehlen oder sind endlich und >= 0. */
export function isFactsRecord(v: unknown): boolean {
  if (!isRec(v)) return false;
  const required = [v['kcal'], v['proteinG'], v['carbsG'], v['fatG']].every(isNonNegative);
  return required && [v['fiberG'], v['sugarG'], v['saltG']].every(isOptNonNegative);
}

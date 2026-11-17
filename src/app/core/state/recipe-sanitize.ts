/**
 * Bereinigung gespeicherter Rezepte (Laden, Import): Ein ungültiges `onlineRef` wird entfernt;
 * bleibt dadurch ein Verweis ohne Zutaten übrig (also ohne Inhalt und ohne gültige Referenz), wird er verworfen.
 */
import { isRecipe } from '../backup/backup-records';
import { StoredRecipe, isValidOnlineRef } from '../recipes/online/online-recipe-ref';
import { Rec, isRec } from '../util/guards';
import { SanitizeResult, sanitizeList } from './record-sanitize';
import { repairRecipe } from './recipe-repair';

const hasIngredients = (rec: Rec): boolean => Array.isArray(rec['ingredients']) && rec['ingredients'].length > 0;
const hasBrokenRef = (rec: Rec): boolean => rec['onlineRef'] !== undefined && !isValidOnlineRef(rec['onlineRef']);

function withoutRef(rec: Rec): Rec {
  const { onlineRef: _dropped, ...rest } = rec;
  return rest;
}

/** Bereinigt eine Rezeptliste; Verworfenes landet unverändert in `rejected`. */
export function sanitizeRecipes(raw: unknown): SanitizeResult<StoredRecipe> {
  if (!Array.isArray(raw)) return sanitizeList<StoredRecipe>(raw, isRecipe);
  const items: StoredRecipe[] = [];
  const rejected: unknown[] = [];
  let repaired = 0;
  for (const rec of raw) {
    const fixed = repairRecipe(rec);
    const broken = isRec(fixed.value) && hasBrokenRef(fixed.value);
    const cleaned = broken ? withoutRef(fixed.value as Rec) : fixed.value;
    if (!isRecipe(cleaned) || (broken && !hasIngredients(cleaned as Rec))) {
      rejected.push(rec);
      continue;
    }
    items.push(cleaned as unknown as StoredRecipe);
    if (broken || fixed.isRepaired) repaired++;
  }
  return { items, rejected, repaired };
}

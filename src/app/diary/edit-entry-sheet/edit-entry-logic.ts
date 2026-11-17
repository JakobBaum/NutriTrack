import { AmountUnit, DiaryEntry, MealType, NutritionFacts } from '../../core/models';
import type { DiaryStore } from '../../core/state/diary.store';
import { EditMode, editModeFor, withServings } from '../diary-edit';
import { editBaseFor, fromBaseAmount, isValidAmount, toBaseAmount } from '../diary-helpers';

export const EMPTY_NAME_MESSAGE = 'Der Name fehlt — gib einen Namen ein.';
export const MISSING_AMOUNT_MESSAGE = 'Die Menge fehlt — gib eine Menge größer als 0 ein.';
export const INVALID_OPTIONAL_AMOUNT_MESSAGE = 'Die Menge muss größer als 0 sein — oder lass das Feld leer.';
export const MISSING_SERVINGS_MESSAGE = 'Die Portionen fehlen — gib eine Zahl größer als 0 ein.';

/** Änderung, die `DiaryStore.update` entgegennimmt. */
export type EntryPatch = Parameters<DiaryStore['update']>[1];

/** Felder des Bearbeiten-Dialogs (Menge in der gewählten Einheit, null = leer). */
export interface EditState {
  readonly label: string;
  readonly meal: MealType;
  readonly amount: number | null;
  readonly unit: AmountUnit;
  readonly servings: number | null;
  /** Welche Mengenzeile gezeigt wird (Menge, Portionen, optionale Menge). */
  readonly mode: EditMode;
  /** Bezugswerte pro 100 g/ml (gespeichert oder abgeleitet); null ohne Menge. */
  readonly baseFacts: NutritionFacts | null;
}

export type EditOutcome =
  | { readonly patch: EntryPatch; readonly error?: undefined }
  | { readonly patch?: undefined; readonly error: string };

/** Startwerte des Dialogs für einen Eintrag. */
export function initialEditState(entry: DiaryEntry): EditState {
  const unit = entry.unit ?? 'g';
  const baseFacts = editBaseFor(entry);
  const mode = editModeFor(entry, baseFacts);
  return {
    label: entry.label,
    meal: entry.meal,
    amount: entry.amountG == null ? null : fromBaseAmount(entry.amountG, unit),
    unit,
    servings: mode === 'portion' ? (entry.servings ?? 1) : null,
    mode,
    baseFacts,
  };
}

/** Portionen ändern: Nährwerte neu skaliert, Eintrag bleibt (id, createdAt, Reihenfolge). */
function portionPatch(entry: DiaryEntry, state: EditState): EditOutcome {
  if (!isValidAmount(state.servings)) return { error: MISSING_SERVINGS_MESSAGE };
  const next = withServings(entry, state.servings);
  return { patch: { label: state.label, meal: state.meal, servings: next.servings, facts: next.facts } };
}

/** Menge ändern; bei „optional“ ohne Bezugswerte bleiben die Nährwerte, ein leeres Feld entfernt die Menge. */
function amountPatch(entry: DiaryEntry, state: EditState): EditOutcome {
  const editBase = state.amount == null ? null : toBaseAmount(state.amount, state.unit);
  if (state.baseFacts && !isValidAmount(editBase)) return { error: MISSING_AMOUNT_MESSAGE };
  if (state.mode === 'optional' && editBase != null && !isValidAmount(editBase)) return { error: INVALID_OPTIONAL_AMOUNT_MESSAGE };

  const withAmount: EntryPatch = isValidAmount(editBase) ? { amountG: editBase, unit: state.unit } : {};
  // Abgeleitete Basis nur bei geänderter Menge übernehmen (sonst keine Rundungsdrift).
  const isDerivedChange = !!state.baseFacts && !entry.baseFacts && isValidAmount(editBase) && editBase !== entry.amountG;
  return {
    patch: {
      label: state.label,
      meal: state.meal,
      ...(state.baseFacts ? withAmount : {}),
      ...(isDerivedChange && state.baseFacts ? { baseFacts: state.baseFacts } : {}),
      ...(state.mode === 'optional' ? (isValidAmount(editBase) ? withAmount : { clearAmount: true }) : {}),
    },
  };
}

/** Prüft die Eingaben und baut die Änderung am Eintrag, oder liefert eine verständliche Fehlermeldung. */
export function buildEditPatch(entry: DiaryEntry, state: EditState): EditOutcome {
  if (!state.label.trim()) return { error: EMPTY_NAME_MESSAGE };
  return state.mode === 'portion' ? portionPatch(entry, state) : amountPatch(entry, state);
}

/** Gewürze und Kräuter werden nie nach Stück oder Gramm aufaddiert, sondern als eine Packung/ein Bund/ein Topf gekauft. */

export type SpiceUnit = 'Pck' | 'Bund' | 'Topf';

/** Gewürze (getrocknet, Packung). */
const DRY_SPICES: readonly string[] = [
  'salz', 'pfeffer', 'paprikapulver', 'zimt', 'kreuzkümmel', 'kümmel', 'kurkuma', 'muskat', 'chilipulver',
  'chiliflocken', 'cayenne', 'currypulver', 'curry', 'knoblauchpulver', 'zwiebelpulver', 'ingwerpulver', 'vanille',
  'nelke', 'piment', 'safran', 'majoran', 'lorbeer', 'gewürz', 'cinnamon', 'cumin', 'turmeric', 'nutmeg', 'cardamom',
  'kardamom', 'sternanis', 'wacholder',
];

/** Kräuter: frisch als Bund, getrocknet als Packung. */
const HERBS: readonly string[] = [
  'rosmarin', 'thymian', 'oregano', 'salbei', 'dill', 'minze', 'petersilie', 'schnittlauch', 'koriander',
  'rosemary', 'thyme', 'sage', 'mint', 'parsley', 'chives', 'cilantro',
];

const POTTED: readonly string[] = ['basilikum', 'basil'];
const ALWAYS_FRESH: readonly string[] = ['petersilie', 'schnittlauch', 'dill', 'minze', 'koriander', 'parsley', 'chives', 'cilantro', 'mint'];
/** Gemüse/Gerichte, die ein Gewürzwort enthalten, aber kein Gewürz sind. */
const NOT_SPICE: readonly string[] = [
  'pfefferoni', 'salzkartoffel', 'salzgurke', 'paprikaschote', 'rote paprika', 'gelbe paprika', 'minzsauce',
  'bell pepper', 'zimtschnecke', 'kümmelbrot', 'korianderöl',
];

/** Höchstmenge für Stückware, jenseits davon ist der Wert offensichtlich unsinnig. */
export const MAX_PIECE_COUNT = 30;
/** Knoblauchzehen je Knolle. */
export const CLOVES_PER_BULB = 10;

function includesAny(name: string, words: readonly string[]): boolean {
  return words.some((w) => name.includes(w));
}

/**
 * Kaufeinheit für Gewürze und Kräuter oder null, wenn die Zutat keins ist.
 * „Rosmarin, frisch“ ergibt Bund, „Oregano“ Packung, „Basilikum“ Topf.
 */
export function spiceUnitFor(name: string): SpiceUnit | null {
  const n = name.trim().toLowerCase();
  if (!n || includesAny(n, NOT_SPICE)) return null;
  const fresh = n.includes('frisch') || n.includes('fresh');
  if (includesAny(n, POTTED)) return fresh || !n.includes('getrocknet') ? 'Topf' : 'Pck';
  if (includesAny(n, HERBS)) return fresh || includesAny(n, ALWAYS_FRESH) ? 'Bund' : 'Pck';
  if (includesAny(n, DRY_SPICES) || /(^|[\s,])pfeffer($|[\s,])/.test(n)) return 'Pck';
  return null;
}

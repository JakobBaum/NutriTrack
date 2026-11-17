import { describe, expect, it } from 'vitest';
import { ensureItemIds, sanitizeShoppingList } from './shopping-sanitize';

const raw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Reis', amount: 1, unit: 'kg', checked: false, ...over,
});

describe('ensureItemIds', () => {
  it('behält gültige ids und ersetzt fehlende, doppelte und ungültige', () => {
    const out = ensureItemIds([{ id: 'a' }, { id: 'a' }, {}, { id: 'a,b' }, { id: 7 }]);
    expect(out[0].id).toBe('a');
    expect(new Set(out.map((i) => i.id)).size).toBe(5);
    expect(out.every((i) => /^[\w-]+$/.test(i.id))).toBe(true);
  });
});

describe('sanitizeShoppingList ids', () => {
  it('ergänzt ids für Altbestand und Import ohne id, ohne Positionen zu verwerfen', () => {
    const { list, rejected } = sanitizeShoppingList<{ items: { id: string }[] }>({ items: [raw(), raw({ name: 'Brot' })] });
    expect(rejected).toHaveLength(0);
    expect(list!.items.map((i) => typeof i.id)).toEqual(['string', 'string']);
    expect(list!.items[0].id).not.toBe(list!.items[1].id);
  });

  it('bricht nicht bei einer Position mit unsinniger id, sondern vergibt eine neue', () => {
    const { list } = sanitizeShoppingList<{ items: { id: string }[] }>({ items: [raw({ id: { x: 1 } })] });
    expect(typeof list!.items[0].id).toBe('string');
  });
});

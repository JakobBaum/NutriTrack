import { describe, expect, it } from 'vitest';
import { DEBUG_STORAGE_KEY, resolveDebugMode, safeLocalStorage } from './debug-flag';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('resolveDebugMode', () => {
  it('is off without parameter or stored flag', () => {
    // Arrange
    const storage = memoryStorage();
    // Act / Assert
    expect(resolveDebugMode('', storage)).toBe(false);
  });

  it('turns on and persists with ?debug=1', () => {
    const storage = memoryStorage();
    expect(resolveDebugMode('?debug=1', storage)).toBe(true);
    expect(storage.getItem(DEBUG_STORAGE_KEY)).toBe('1');
  });

  it('stays on after navigation when the flag is stored', () => {
    const storage = memoryStorage({ [DEBUG_STORAGE_KEY]: '1' });
    expect(resolveDebugMode('', storage)).toBe(true);
  });

  it('turns off and clears the flag with ?debug=0', () => {
    const storage = memoryStorage({ [DEBUG_STORAGE_KEY]: '1' });
    expect(resolveDebugMode('?debug=0', storage)).toBe(false);
    expect(storage.getItem(DEBUG_STORAGE_KEY)).toBeNull();
  });

  it('still honours ?debug=1 when storage throws', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(resolveDebugMode('?debug=1', broken)).toBe(true);
    expect(resolveDebugMode('', broken)).toBe(false);
  });

  it('is off without storage', () => {
    expect(resolveDebugMode('', null)).toBe(false);
  });
});

describe('safeLocalStorage', () => {
  it('returns null when window is missing', () => {
    expect(safeLocalStorage(null)).toBeNull();
  });
});

import { convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { clearQueryParams, pickParam } from './query-params';

describe('pickParam', () => {
  it('liefert den Wert, wenn er erlaubt ist', () => {
    const params = convertToParamMap({ view: 'meals' });
    expect(pickParam(params, 'view', ['meals', 'recipes'])).toBe('meals');
  });

  it('liefert null bei fehlendem oder unbekanntem Wert', () => {
    expect(pickParam(convertToParamMap({}), 'view', ['meals'])).toBeNull();
    expect(pickParam(convertToParamMap({ view: 'x' }), 'view', ['meals'])).toBeNull();
    expect(pickParam(null, 'view', ['meals'])).toBeNull();
  });
});

describe('clearQueryParams', () => {
  it('entfernt die Parameter per replaceUrl und behält die übrigen', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await clearQueryParams({ navigate } as never, ['open', 'view']);
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { open: null, view: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
});

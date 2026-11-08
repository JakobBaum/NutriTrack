import { describe, expect, it } from 'vitest';
import { resolveRecipeSearchAccess } from './recipe-search-access';

const SPOON = 'https://api.spoonacular.com';
const WORKER = 'https://nutritrack.example.workers.dev/';

describe('resolveRecipeSearchAccess', () => {
  it('prefers an own key and uses the configured base url', () => {
    expect(resolveRecipeSearchAccess({ apiKey: ' k ', baseUrl: SPOON + '/' }, WORKER)).toEqual({
      mode: 'ownKey', baseUrl: SPOON, apiKey: 'k',
    });
  });

  it('uses the worker without a key when no own key is set', () => {
    expect(resolveRecipeSearchAccess({ apiKey: '  ', baseUrl: SPOON }, WORKER)).toEqual({
      mode: 'worker', baseUrl: 'https://nutritrack.example.workers.dev', apiKey: '',
    });
  });

  it('is none without key and without worker url', () => {
    expect(resolveRecipeSearchAccess({ apiKey: '', baseUrl: SPOON }, ' ')).toEqual({ mode: 'none', baseUrl: '', apiKey: '' });
  });
});

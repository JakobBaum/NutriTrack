import { describe, expect, it } from 'vitest';
import { resolveRecipeSearchAccess } from './recipe-search-access';

const WORKER = 'https://nutritrack.example.workers.dev/';

describe('resolveRecipeSearchAccess', () => {
  it('uses the global worker without trailing slash', () => {
    expect(resolveRecipeSearchAccess(WORKER)).toEqual({ available: true, baseUrl: 'https://nutritrack.example.workers.dev' });
  });

  it('is unavailable without worker url', () => {
    expect(resolveRecipeSearchAccess(' ')).toEqual({ available: false, baseUrl: '' });
  });
});

import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, Migration, applyMigrations, readSchemaVersion } from './storage-schema';

describe('readSchemaVersion', () => {
  it.each([
    [undefined, 0],
    [null, 0],
    ['2', 0],
    [-1, 0],
    [1.5, 0],
    [1, 1],
    [3, 3],
  ])('liest %s als Version %s', (raw, expected) => {
    expect(readSchemaVersion(raw)).toBe(expected);
  });
});

describe('applyMigrations', () => {
  const rename: Migration = (data) => ({ renamed: data['old'], old: undefined });
  const addFlag: Migration = () => ({ flag: true });

  it('führt nur die Schritte oberhalb der gespeicherten Version aus, in Reihenfolge', () => {
    const result = applyMigrations({ old: 'x' }, 0, 2, { 1: rename, 2: addFlag });
    expect(result.version).toBe(2);
    expect(result.patch).toEqual({ renamed: 'x', old: undefined, flag: true });
  });

  it('überspringt bereits angewendete Schritte', () => {
    const result = applyMigrations({}, 1, 2, { 1: rename, 2: addFlag });
    expect(result.patch).toEqual({ flag: true });
  });

  it('lässt Daten unverändert, wenn die Version aktuell ist', () => {
    expect(applyMigrations({ a: 1 }, 2, 2, { 1: rename, 2: addFlag })).toEqual({ version: 2, patch: {}, newer: false });
  });

  it('meldet Daten aus einer neueren App-Version und ändert nichts', () => {
    const result = applyMigrations({ a: 1 }, 5, 2, { 1: rename });
    expect(result).toEqual({ version: 5, patch: {}, newer: true });
  });

  it('gibt spätere Schritte den Stand nach den früheren', () => {
    const seen: unknown[] = [];
    const spy: Migration = (data) => { seen.push(data['n']); return {}; };
    applyMigrations({ n: 1 }, 0, 2, { 1: () => ({ n: 2 }), 2: spy });
    expect(seen).toEqual([2]);
  });

  it('überspringt fehlende Schritte in der Tabelle', () => {
    expect(applyMigrations({}, 0, 3, { 3: addFlag }).patch).toEqual({ flag: true });
  });
});

describe('Migrationstabelle', () => {
  it('hat zu jeder Version bis CURRENT_SCHEMA_VERSION einen Schritt', () => {
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  it('Schritt 1 (Bestandsdaten ohne Version) ändert nichts und ist wiederholbar', () => {
    const data = { diary: [{ id: 'd1' }], profile: null };
    expect(MIGRATIONS[1](data)).toEqual({});
    expect(MIGRATIONS[1](data)).toEqual({});
  });
});

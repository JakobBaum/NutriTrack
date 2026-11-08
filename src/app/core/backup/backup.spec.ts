import { describe, expect, it } from 'vitest';
import {
  BACKUP_ERRORS,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  LAST_BACKUP_KEY,
  backupFileName,
  buildBackup,
  countBackup,
  describeCounts,
  formatBackupDate,
  parseBackup,
  prepareRestore,
  serializeBackup,
  validateBackup,
} from './backup';

const NOW = new Date(2026, 10, 6, 14, 5, 0);

function validFile(data: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: NOW.toISOString(), data, ...overrides };
}

const entry = (id: string): Record<string, unknown> => ({
  id,
  dateISO: '2026-11-06',
  meal: 'lunch',
  label: 'Reis',
  ref: { kind: 'manual' },
  facts: { kcal: 100, proteinG: 2, carbsG: 20, fatG: 1, basis: 'perPortion' },
  createdAt: '2026-11-06T10:00:00.000Z',
});

const sampleData = {
  diary: [entry('d1'), entry('d2'), entry('d3')],
  recipes: [{ id: 'r1', title: 'Pasta', servings: 2, ingredients: [{ name: 'Nudeln', amount: 200, unit: 'g' }], steps: [] }],
  savedMeals: [],
  customFoods: [
    { id: 'c1', name: 'A', facts: { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion' } },
    { id: 'c2', name: 'B', facts: { kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, basis: 'perPortion' } },
  ],
  profile: { weightKg: 80 },
  shopping: { id: 's', items: [{ name: 'Milch', amount: 1, unit: 'l', checked: false }] },
  'ai-config': { provider: 'gemini', apiKey: 'geheim', proxyUrl: '' },
};

describe('backupFileName', () => {
  it('uses the local date with zero padding', () => {
    expect(backupFileName(new Date(2026, 0, 3))).toBe('nutritrack-backup-2026-01-03.json');
  });
});

describe('buildBackup', () => {
  it('adds format, version and export date', () => {
    const backup = buildBackup({ diary: [] }, NOW);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe(NOW.toISOString());
    expect(backup.data).toEqual({ diary: [] });
  });

  it('excludes the last-backup meta key', () => {
    const backup = buildBackup({ diary: [], [LAST_BACKUP_KEY]: '2026-01-01T00:00:00.000Z' }, NOW);
    expect(Object.keys(backup.data)).toEqual(['diary']);
  });

  it('blanks the API key without mutating the input', () => {
    const input = { 'ai-config': { provider: 'gemini', apiKey: 'geheim' } };
    const backup = buildBackup(input, NOW);
    expect(backup.data['ai-config']).toEqual({ provider: 'gemini', apiKey: '' });
    expect(input['ai-config'].apiKey).toBe('geheim');
  });

  it('round-trips through serialize and parse', () => {
    const backup = buildBackup(sampleData, NOW);
    const result = parseBackup(serializeBackup(backup));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup).toEqual(backup);
  });
});

describe('parseBackup', () => {
  it('rejects empty text', () => {
    expect(parseBackup('  ')).toEqual({ ok: false, error: BACKUP_ERRORS.empty });
  });

  it('rejects invalid JSON', () => {
    expect(parseBackup('{nope')).toEqual({ ok: false, error: BACKUP_ERRORS.notJson });
  });

  it('rejects foreign JSON', () => {
    expect(parseBackup('{"hello":"world"}')).toEqual({ ok: false, error: BACKUP_ERRORS.foreign });
    expect(parseBackup('[1,2]')).toEqual({ ok: false, error: BACKUP_ERRORS.foreign });
    expect(parseBackup('null')).toEqual({ ok: false, error: BACKUP_ERRORS.foreign });
  });
});

describe('validateBackup', () => {
  it('accepts a valid backup', () => {
    const result = validateBackup(validFile(sampleData));
    expect(result.ok).toBe(true);
  });

  it('accepts unknown but well-formed keys', () => {
    expect(validateBackup(validFile({ weightLog: [1, 2] })).ok).toBe(true);
  });

  it('rejects a newer version with an update hint', () => {
    expect(validateBackup(validFile({}, { version: BACKUP_VERSION + 1 }))).toEqual({
      ok: false,
      error: BACKUP_ERRORS.newerVersion,
    });
  });

  it.each([0, -1, 1.5, '1', null, undefined])('rejects version %s', (version) => {
    expect(validateBackup(validFile({}, { version }))).toEqual({ ok: false, error: BACKUP_ERRORS.badVersion });
  });

  it.each(['', 'gestern', '2026-11-06', 123, null])('rejects export date %s', (exportedAt) => {
    expect(validateBackup(validFile({}, { exportedAt }))).toEqual({ ok: false, error: BACKUP_ERRORS.badDate });
  });

  it.each([null, [], 'x', 5])('rejects data %s', (data) => {
    expect(validateBackup(validFile({}, { data }))).toEqual({ ok: false, error: BACKUP_ERRORS.badData });
  });

  it('rejects wrongly typed known keys', () => {
    const bad = [
      { diary: {} },
      { diary: [1, 2] },
      { recipes: 'x' },
      { profile: [] },
      { shopping: 'x' },
      { 'ai-config': null },
    ];
    bad.forEach((data) => expect(validateBackup(validFile(data)).ok).toBe(false));
  });

  it('accepts null profile and shopping list', () => {
    expect(validateBackup(validFile({ profile: null, shopping: null })).ok).toBe(true);
  });

  it('rejects dangerous or malformed keys', () => {
    expect(parseBackup(JSON.stringify(validFile()).replace('"data":{}', '"data":{"__proto__":{}}')).ok).toBe(false);
    expect(validateBackup(validFile({ 'a b': 1 })).ok).toBe(false);
    expect(validateBackup(validFile({ ['x'.repeat(65)]: 1 })).ok).toBe(false);
  });
});

describe('validateBackup Inhaltsprüfung (QAE-01)', () => {
  const bad = (data: Record<string, unknown>) => validateBackup(validFile(data));

  it('lehnt Tagebuch-Einträge ohne createdAt ab (würde entriesForDate abstürzen lassen)', () => {
    const { createdAt: _drop, ...noCreatedAt } = entry('d1');
    expect(bad({ diary: [noCreatedAt] })).toEqual({ ok: false, error: BACKUP_ERRORS.badContent });
  });

  it.each([
    ['ohne id', { id: undefined }],
    ['falsche Mahlzeit', { meal: 'brunch' }],
    ['kaputtes Datum', { dateISO: 'heute' }],
    ['Name keine Zeichenkette', { label: 5 }],
    ['kcal nicht endlich', { facts: { kcal: null, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' } }],
    ['facts fehlen', { facts: undefined }],
  ])('lehnt Tagebuch-Eintrag %s ab', (_name, patch) => {
    expect(bad({ diary: [{ ...entry('d1'), ...patch }] }).ok).toBe(false);
  });

  it('lehnt Rezepte ohne Titel oder mit kaputten Zutaten ab', () => {
    expect(bad({ recipes: [{ id: 'r', servings: 2, ingredients: [] }] }).ok).toBe(false);
    expect(bad({ recipes: [{ id: 'r', title: 'X', servings: 2, ingredients: [{ name: 'a', amount: 'viel', unit: 'g' }] }] }).ok).toBe(false);
  });

  it('lehnt Einkaufspositionen ohne Menge oder Namen ab', () => {
    expect(bad({ shopping: { items: [{ name: 'Milch', unit: 'l', checked: false }] } }).ok).toBe(false);
    expect(bad({ shopping: { items: [{ amount: 1, unit: 'l', checked: false }] } }).ok).toBe(false);
  });

  it('lehnt eigene Lebensmittel und gespeicherte Mahlzeiten ohne Pflichtfelder ab', () => {
    expect(bad({ customFoods: [{ id: 'c' }] }).ok).toBe(false);
    expect(bad({ savedMeals: [{ id: 'm', name: 'M' }] }).ok).toBe(false);
  });

  it('akzeptiert vollständige Datensätze', () => {
    expect(bad({ diary: [entry('d1')] }).ok).toBe(true);
  });
});

describe('countBackup / describeCounts', () => {
  it('counts all record types', () => {
    expect(countBackup(sampleData)).toEqual({
      diary: 3,
      recipes: 1,
      savedMeals: 0,
      customFoods: 2,
      shoppingItems: 1,
      hasProfile: true,
    });
  });

  it('treats missing keys as zero', () => {
    expect(countBackup({})).toEqual({
      diary: 0, recipes: 0, savedMeals: 0, customFoods: 0, shoppingItems: 0, hasProfile: false,
    });
  });

  it('builds a German summary with singular and plural', () => {
    expect(describeCounts(countBackup(sampleData))).toBe(
      '3 Tagebucheinträge, 1 Rezept, 0 gespeicherte Mahlzeiten, 2 eigene Lebensmittel, 1 Einkaufsposition, Profil',
    );
    expect(describeCounts({ diary: 1, recipes: 4, savedMeals: 1, customFoods: 1, shoppingItems: 0, hasProfile: false })).toBe(
      '1 Tagebucheintrag, 4 Rezepte, 1 gespeicherte Mahlzeit, 1 eigenes Lebensmittel',
    );
  });
});

describe('prepareRestore', () => {
  it('keeps the local API key when the backup has none', () => {
    const restored = prepareRestore({ 'ai-config': { provider: 'gemini', apiKey: '' } }, { 'ai-config': { apiKey: 'lokal' } });
    expect(restored['ai-config']).toEqual({ provider: 'gemini', apiKey: 'lokal' });
  });

  it('prefers an API key contained in the backup', () => {
    const restored = prepareRestore({ 'ai-config': { apiKey: 'backup' } }, { 'ai-config': { apiKey: 'lokal' } });
    expect(restored['ai-config']).toEqual({ apiKey: 'backup' });
  });

  it('verwirft endpoint und proxyUrl aus dem Backup und behält die lokalen (SEC-01)', () => {
    const restored = prepareRestore(
      { 'ai-config': { provider: 'gemini', apiKey: '', endpoint: 'https://evil.example', proxyUrl: 'https://evil.example' } },
      { 'ai-config': { apiKey: 'lokal', endpoint: '', proxyUrl: 'https://mein-worker.example' } },
    );
    expect(restored['ai-config']).toEqual({ provider: 'gemini', apiKey: 'lokal', endpoint: '', proxyUrl: 'https://mein-worker.example' });
  });

  it('entfernt endpoint, proxyUrl und baseUrl ganz, wenn lokal keine existieren (SEC-01)', () => {
    const restored = prepareRestore(
      {
        'ai-config': { provider: 'gemini', apiKey: 'k', endpoint: 'https://evil.example', proxyUrl: 'https://evil.example' },
        'recipe-search-config': { apiKey: 'k', baseUrl: 'https://evil.example' },
      },
      {},
    );
    expect(restored['ai-config']).toEqual({ provider: 'gemini', apiKey: 'k' });
    expect(restored['recipe-search-config']).toEqual({ apiKey: 'k' });
  });

  it('drops the last-backup key and leaves other data untouched', () => {
    const restored = prepareRestore({ diary: [entry('d')], [LAST_BACKUP_KEY]: 'x' }, {});
    expect(restored).toEqual({ diary: [entry('d')] });
  });
});

describe('formatBackupDate', () => {
  it('formats a valid ISO date in German style', () => {
    expect(formatBackupDate(NOW.toISOString())).toBe('06.11.2026, 14:05');
  });

  it('returns null for invalid input', () => {
    expect(formatBackupDate(null)).toBeNull();
    expect(formatBackupDate('kaputt')).toBeNull();
  });
});

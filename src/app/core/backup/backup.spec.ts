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

  it('exportiert keine KI-Verbindungsfelder (ai-config)', () => {
    const backup = buildBackup({ diary: [], 'ai-config': { provider: 'gemini', apiKey: 'geheim' } }, NOW);
    expect(Object.keys(backup.data)).toEqual(['diary']);
  });

  it('blanks the recipe search API key without mutating the input', () => {
    const input = { 'recipe-search-config': { apiKey: 'geheim', baseUrl: '' } };
    const backup = buildBackup(input, NOW);
    expect(backup.data['recipe-search-config']).toEqual({ apiKey: '', baseUrl: '' });
    expect(input['recipe-search-config'].apiKey).toBe('geheim');
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

    ];
    bad.forEach((data) => expect(validateBackup(validFile(data)).ok).toBe(false));
  });

  it('akzeptiert alte Backups mit ai-config (wird beim Import ignoriert)', () => {
    expect(validateBackup(validFile({ 'ai-config': { provider: 'gemini', apiKey: 'x' } })).ok).toBe(true);
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

describe('validateBackup Inhaltsprüfung (QAE-01, Welle A)', () => {
  const run = (data: Record<string, unknown>) => validateBackup(validFile(data));
  const cleanupOf = (data: Record<string, unknown>) => {
    const r = run(data);
    if (!r.ok) throw new Error('erwartet ok');
    return r;
  };

  it('repariert Tagebuch-Einträge ohne createdAt statt das Backup abzulehnen', () => {
    const { createdAt: _drop, ...noCreatedAt } = entry('d1');
    const r = cleanupOf({ diary: [noCreatedAt] });
    expect((r.backup.data['diary'] as Array<{ createdAt: string }>)[0].createdAt).toEqual(expect.any(String));
    expect(r.cleanup.repaired).toBe(1);
    expect(r.cleanup.skipped).toBe(0);
  });

  it.each([
    ['ohne id', { id: undefined }],
    ['falsche Mahlzeit', { meal: 'brunch' }],
    ['Name keine Zeichenkette', { label: 5 }],
  ])('repariert Tagebuch-Eintrag %s', (_name, patch) => {
    const r = cleanupOf({ diary: [{ ...entry('d1'), ...patch }] });
    expect(r.cleanup.repaired).toBe(1);
    expect(r.backup.data['diary']).toHaveLength(1);
  });

  it.each([
    ['kaputtes Datum ohne createdAt', { dateISO: 'heute', createdAt: undefined }],
    ['kcal nicht endlich', { facts: { kcal: null, proteinG: 1, carbsG: 1, fatG: 1, basis: 'perPortion' } }],
    ['facts fehlen', { facts: undefined }],
  ])('sortiert Tagebuch-Eintrag %s in die Quarantäne', (_name, patch) => {
    const r = cleanupOf({ diary: [{ ...entry('d1'), ...patch }] });
    expect(r.backup.data['diary']).toEqual([]);
    expect(r.cleanup.skipped).toBe(1);
    expect(r.cleanup.quarantined['diary']).toHaveLength(1);
  });

  it('sortiert Rezepte ohne Titel oder mit kaputten Zutaten aus, behält aber das Backup', () => {
    const r = cleanupOf({
      recipes: [
        { id: 'r', servings: 2, ingredients: [] },
        { id: 'r2', title: 'X', servings: 2, ingredients: [{ name: 'a', amount: 'viel', unit: 'g' }] },
        { id: 'r3', title: 'Gut', servings: 2, ingredients: [] },
      ],
    });
    expect(r.backup.data['recipes']).toHaveLength(1);
    expect(r.cleanup.skipped).toBe(2);
  });

  it('filtert Einkaufspositionen ohne Menge oder Namen', () => {
    const r = cleanupOf({ shopping: { items: [{ name: 'Milch', unit: 'l', checked: false }, { amount: 1, unit: 'l', checked: false }] } });
    expect(r.backup.data['shopping']).toEqual({ items: [] });
    expect(r.cleanup.skipped).toBe(2);
  });

  it('sortiert eigene Lebensmittel und gespeicherte Mahlzeiten ohne Pflichtfelder aus', () => {
    const r = cleanupOf({ customFoods: [{ id: 'c' }], savedMeals: [{ id: 'm', name: 'M' }] });
    expect(r.cleanup.skipped).toBe(2);
  });

  it('akzeptiert vollständige Datensätze ohne Bereinigung', () => {
    const r = cleanupOf({ diary: [entry('d1')] });
    expect(r.cleanup).toEqual({ repaired: 0, skipped: 0, quarantined: {} });
  });

  it('lässt Geräte-interne Schlüssel (Version, Auto-Sicherung, Quarantäne) beim Export und Import weg', () => {
    const data = { diary: [], schemaVersion: 1, autosnapshot: { x: 1 }, 'quarantine.diary.1': {}, backupReminderSnooze: 'x' };
    expect(Object.keys(buildBackup(data, new Date()).data)).toEqual(['diary']);
    expect(Object.keys(prepareRestore(data, {}))).toEqual(['diary']);
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
      weightEntries: 0,
      favorites: 0,
    });
  });

  it('treats missing keys as zero', () => {
    expect(countBackup({})).toEqual({
      diary: 0, recipes: 0, savedMeals: 0, customFoods: 0, shoppingItems: 0, hasProfile: false, weightEntries: 0, favorites: 0,
    });
  });

  it('builds a German summary with singular and plural', () => {
    expect(describeCounts(countBackup(sampleData))).toBe(
      '3 Tagebucheinträge, 1 Rezept, 0 gespeicherte Mahlzeiten, 2 eigene Lebensmittel, 1 Einkaufsposition, Profil',
    );
    expect(describeCounts({ diary: 1, recipes: 4, savedMeals: 1, customFoods: 1, shoppingItems: 0, hasProfile: false, weightEntries: 0, favorites: 0 })).toBe(
      '1 Tagebucheintrag, 4 Rezepte, 1 gespeicherte Mahlzeit, 1 eigenes Lebensmittel',
    );
  });
});

describe('Gewicht und Favoriten im Backup', () => {
  const fav = { id: 'f1', label: 'Skyr', facts: { kcal: 60, proteinG: 11, carbsG: 4, fatG: 0.2, basis: 'perPortion' }, createdAt: '2026-11-06T10:00:00.000Z' };

  it('akzeptiert gültige Gewichtseinträge und Favoriten', () => {
    const data = { weight: [{ dateISO: '2026-11-05', kg: 80.2 }], favorites: [fav] };
    expect(parseBackup(JSON.stringify(validFile(data))).ok).toBe(true);
  });

  it.each([
    ['Gewicht zu klein', { weight: [{ dateISO: '2026-11-05', kg: 5 }] }],
    ['Gewicht zu groß', { weight: [{ dateISO: '2026-11-05', kg: 401 }] }],
    ['Datum kaputt', { weight: [{ dateISO: 'gestern', kg: 80 }] }],
    ['Gewicht kein Zahlenwert', { weight: [{ dateISO: '2026-11-05', kg: '80' }] }],
    ['zwei Einträge am selben Tag', { weight: [{ dateISO: '2026-11-05', kg: 80 }, { dateISO: '2026-11-05', kg: 81 }] }],
    ['Favorit ohne Namen', { favorites: [{ ...fav, label: undefined }] }],
    ['Favorit ohne Nährwerte', { favorites: [{ id: 'f', label: 'X' }] }],
  ])('sortiert aus (Backup bleibt importierbar): %s', (_name, data) => {
    const r = parseBackup(JSON.stringify(validFile(data)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cleanup.skipped).toBeGreaterThan(0);
  });

  it('zählt Gewichtseinträge und Favoriten in der Vorschau', () => {
    const counts = countBackup({ weight: [{ dateISO: '2026-11-05', kg: 80 }], favorites: [fav, fav] });
    expect(counts.weightEntries).toBe(1);
    expect(counts.favorites).toBe(2);
    expect(describeCounts(counts)).toContain('1 Gewichtseintrag');
    expect(describeCounts(counts)).toContain('2 Favoriten');
  });
});

describe('prepareRestore', () => {
  it('ignoriert ai-config aus dem Backup vollständig', () => {
    const restored = prepareRestore({ diary: [], 'ai-config': { provider: 'gemini', apiKey: 'fremd', proxyUrl: 'https://evil.example' } }, { 'ai-config': { apiKey: 'lokal' } });
    expect(restored).toEqual({ diary: [] });
  });

  it('keeps the local recipe search key when the backup has none', () => {
    const restored = prepareRestore({ 'recipe-search-config': { apiKey: '' } }, { 'recipe-search-config': { apiKey: 'lokal' } });
    expect(restored['recipe-search-config']).toEqual({ apiKey: 'lokal' });
  });

  it('verwirft baseUrl aus dem Backup und behält die lokale (SEC-01)', () => {
    const restored = prepareRestore(
      { 'recipe-search-config': { apiKey: '', baseUrl: 'https://evil.example' } },
      { 'recipe-search-config': { apiKey: 'lokal', baseUrl: 'https://mein.example' } },
    );
    expect(restored['recipe-search-config']).toEqual({ apiKey: 'lokal', baseUrl: 'https://mein.example' });
  });

  it('entfernt baseUrl ganz, wenn lokal keine existiert (SEC-01)', () => {
    const restored = prepareRestore(
      {
        'recipe-search-config': { apiKey: 'k', baseUrl: 'https://evil.example' },
      },
      {},
    );
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

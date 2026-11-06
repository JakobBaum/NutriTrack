import { pickedDay } from './date-nav.component';

describe('pickedDay', () => {
  it('reads an ISO datetime string', () => {
    expect(pickedDay('2026-11-02T10:00:00', '2026-11-06')).toBe('2026-11-02');
  });

  it('reads the first entry of a list', () => {
    expect(pickedDay(['2026-11-03'], '2026-11-06')).toBe('2026-11-03');
  });

  it('clamps future days to the maximum', () => {
    expect(pickedDay('2026-12-24', '2026-11-06')).toBe('2026-11-06');
  });

  it('returns null for invalid values', () => {
    expect(pickedDay(undefined, '2026-11-06')).toBeNull();
    expect(pickedDay('morgen', '2026-11-06')).toBeNull();
  });
});

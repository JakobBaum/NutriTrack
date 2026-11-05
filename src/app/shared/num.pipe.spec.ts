import { formatNum } from './num.pipe';

describe('formatNum', () => {
  it('formats with decimal comma and up to one fraction digit by default', () => {
    expect(formatNum(16.64)).toBe('16,6');
    expect(formatNum(44)).toBe('44');
  });

  it('supports fixed fraction digits for prices', () => {
    expect(formatNum(54.3, 2, 2)).toBe('54,30');
  });

  it('returns a dash for missing values', () => {
    expect(formatNum(undefined)).toBe('–');
    expect(formatNum(Number.NaN)).toBe('–');
  });
});

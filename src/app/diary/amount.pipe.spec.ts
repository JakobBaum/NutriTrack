import { describe, expect, it } from 'vitest';
import { AmountPipe } from './amount.pipe';

describe('AmountPipe', () => {
  const pipe = new AmountPipe();

  it('formats grams by default', () => {
    expect(pipe.transform(150)).toBe('150 g');
  });

  it('converts to the entry unit', () => {
    expect(pipe.transform(250, 'kg')).toBe('0,25 kg');
  });
});

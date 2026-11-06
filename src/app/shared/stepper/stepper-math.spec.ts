import { stepValue } from './stepper-math';

describe('stepValue', () => {
  const b = { min: 30, max: 300, step: 0.5, start: 75 };

  it('jumps to start when empty', () => {
    expect(stepValue(null, 1, b)).toBe(75);
    expect(stepValue(null, -1, b)).toBe(75);
  });

  it('steps by step size', () => {
    expect(stepValue(75, 1, b)).toBe(75.5);
    expect(stepValue(75, -1, b)).toBe(74.5);
  });

  it('clamps to min and max', () => {
    expect(stepValue(30, -1, b)).toBe(30);
    expect(stepValue(300, 1, b)).toBe(300);
  });

  it('avoids float noise', () => {
    expect(stepValue(0.1, 1, { min: 0, max: 1, step: 0.1, start: 0.5 })).toBe(0.2);
    expect(stepValue(0.2, 1, { min: 0, max: 1, step: 0.1, start: 0.5 })).toBe(0.3);
  });
});

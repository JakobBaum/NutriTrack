import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrTimeoutError, withTimeout } from './label-ocr.service';

describe('withTimeout (K18)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('liefert das Ergebnis, wenn es rechtzeitig kommt', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'zu lang')).resolves.toBe('ok');
  });

  it('wirft einen OcrTimeoutError, wenn das Zeitlimit überschritten wird', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 1000, 'zu lang');
    const assertion = expect(result).rejects.toBeInstanceOf(OcrTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });
});

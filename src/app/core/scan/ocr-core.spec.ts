import { describe, expect, it } from 'vitest';
import { CORE_PLAIN_FILE, CORE_SIMD_FILE, coreFileName, supportsWasmSimd } from './ocr-core';

describe('coreFileName', () => {
  it('uses the SIMD core when supported', () => {
    expect(coreFileName(true)).toBe(CORE_SIMD_FILE);
  });
  it('falls back to the plain core without SIMD', () => {
    expect(coreFileName(false)).toBe(CORE_PLAIN_FILE);
  });
  it('detects SIMD support without throwing', () => {
    expect(typeof supportsWasmSimd()).toBe('boolean');
  });
});

/**
 * Auswahl der Tesseract-Core-Variante. Ausgeliefert werden nur "simd-lstm" (alle
 * heutigen Browser/WebViews) und "lstm" (Fallback ohne WASM-SIMD, z. B. iOS < 16.4);
 * die relaxedsimd-Varianten entfallen (spart ~3,9 MB, kaum Tempo-Unterschied).
 */
export const CORE_SIMD_FILE = 'tesseract-core-simd-lstm.wasm.js';
export const CORE_PLAIN_FILE = 'tesseract-core-lstm.wasm.js';

/** Minimales WASM-Modul mit einer v128-Instruktion (wasm-feature-detect "simd"). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

export function supportsWasmSimd(): boolean {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

export function coreFileName(simd: boolean = supportsWasmSimd()): string {
  return simd ? CORE_SIMD_FILE : CORE_PLAIN_FILE;
}

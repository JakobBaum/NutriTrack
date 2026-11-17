/** Rundet auf 2 Nachkommastellen (Cent bzw. hübsche Mengenanzeige). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

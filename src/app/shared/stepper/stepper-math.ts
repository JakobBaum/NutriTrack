export interface StepperBounds {
  min: number;
  max: number;
  step: number;
  /** Wert, bei dem ein leerer Stepper beim ersten Tippen landet. */
  start: number;
}

/** Rundet auf die Nachkommastellen von `step` (verhindert 0,1 + 0,2 = 0,30000000000000004). */
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(value.toFixed(decimals));
}

/** Nächster Wert nach −/+; ein leerer Wert springt auf `start`. Immer innerhalb [min, max]. */
export function stepValue(current: number | null, direction: 1 | -1, b: StepperBounds): number {
  const base = current === null || !Number.isFinite(current) ? b.start : current + direction * b.step;
  return Math.min(b.max, Math.max(b.min, roundToStep(base, b.step)));
}

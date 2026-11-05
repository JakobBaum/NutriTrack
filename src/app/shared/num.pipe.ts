import { Pipe, PipeTransform } from '@angular/core';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(minDigits: number, maxDigits: number): Intl.NumberFormat {
  const key = `${minDigits}-${maxDigits}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('de-AT', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
    formatters.set(key, fmt);
  }
  return fmt;
}

/** Zahl im österreichischen Format (Dezimalkomma), z. B. `{{ 16.6 | ntNum }}` → „16,6“, `{{ 54.3 | ntNum:2:2 }}` → „54,30“. */
export function formatNum(value: number | null | undefined, maxDigits = 1, minDigits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  return formatter(minDigits, maxDigits).format(value);
}

@Pipe({ name: 'ntNum', standalone: true })
export class NumPipe implements PipeTransform {
  transform(value: number | null | undefined, maxDigits = 1, minDigits = 0): string {
    return formatNum(value, maxDigits, minDigits);
  }
}

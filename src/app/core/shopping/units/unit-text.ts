import { UnitSystem } from './unit-format';
import { CM_PER_INCH } from './unit-convert';

const TEMP_STEP = 5;
const FAHRENHEIT_OFFSET = 32;
const FAHRENHEIT_RATIO = 9 / 5;

/** „350 F“, „350 degrees F“, „350°F“, „350 Grad Fahrenheit“. */
const FAHRENHEIT_RE = /(\d{2,3})\s*(?:°|º|degrees?|grad)?\s*(?:F\b|Fahrenheit)/gi;
/** „180 °C“, „180 Grad C“, „180 Grad Celsius“ (nur mit Gradzeichen oder Wort, damit „5 C“ unberührt bleibt). */
const CELSIUS_RE = /(\d{2,3})\s*(?:°|º|grad)\s*C(?:elsius)?\b/gi;
/** „2 inch“, „1/2 inches“, „3-inch“, „2 in.“ (Bruch oder Dezimalzahl). */
const INCH_RE = /(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)[\s-]*(?:inch(?:es)?|zoll)\b/gi;

function parseQuantity(raw: string): number {
  const fraction = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(raw.replace(',', '.'));
}

/** Fahrenheit → Celsius, auf 5 Grad gerundet. */
export function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - FAHRENHEIT_OFFSET) / FAHRENHEIT_RATIO) / TEMP_STEP) * TEMP_STEP;
}

/** Celsius → Fahrenheit, auf 5 Grad gerundet. */
export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * FAHRENHEIT_RATIO + FAHRENHEIT_OFFSET) / TEMP_STEP) * TEMP_STEP;
}

/** Zentimeter auf 0,5 gerundet, als Text mit Dezimalkomma. */
function cmText(inches: number): string {
  const cm = Math.round(inches * CM_PER_INCH * 2) / 2;
  return `${cm.toLocaleString('de-AT', { maximumFractionDigits: 1 })} cm`;
}

/**
 * Rechnet Temperaturen und Längen in einem Schritt-Text um: metrisch ergibt °C und cm
 * (aus „350 degrees F“ wird „180 °C“, aus „2 inch“ „5 cm“), imperial ergibt °F (aus „180 °C“ „355 °F“).
 */
export function convertStepText(text: string, system: UnitSystem): string {
  if (system === 'imperial') {
    return text.replace(CELSIUS_RE, (_m, c: string) => `${celsiusToFahrenheit(Number(c))} °F`);
  }
  return text
    .replace(FAHRENHEIT_RE, (_m, f: string) => `${fahrenheitToCelsius(Number(f))} °C`)
    .replace(INCH_RE, (_m, q: string) => cmText(parseQuantity(q)));
}

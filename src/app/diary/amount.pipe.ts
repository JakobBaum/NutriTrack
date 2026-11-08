import { Pipe, PipeTransform } from '@angular/core';
import { AmountUnit } from '../core/models';
import { formatAmount } from './diary-helpers';

/** Menge samt Einheit, z. B. `{{ entry.amountG | ntAmount:entry.unit }}` → „150 g“. Pure: rechnet nur bei geänderten Werten neu. */
@Pipe({ name: 'ntAmount', standalone: true })
export class AmountPipe implements PipeTransform {
  transform(amountG: number, unit?: AmountUnit): string {
    return formatAmount(amountG, unit);
  }
}

import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { NumPipe } from '../shared/num.pipe';

import { AddEntrySheetComponent } from './add-entry-sheet/add-entry-sheet.component';
import { AmountChipsComponent } from './amount-chips/amount-chips.component';
import { FastfoodFormComponent } from './fastfood-form.component';
import { FastfoodSheetComponent } from './fastfood-sheet/fastfood-sheet.component';

/** Wiederverwendbare Eintrags-Sheets (Eintragen, Fastfood) für Tagebuch und „Heute“. */
@NgModule({
  imports: [SharedModule, NumPipe],
  declarations: [AddEntrySheetComponent, AmountChipsComponent, FastfoodFormComponent, FastfoodSheetComponent],
  exports: [AddEntrySheetComponent, AmountChipsComponent, FastfoodSheetComponent],
})
export class EntrySheetsModule {}

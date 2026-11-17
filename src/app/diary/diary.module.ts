import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { DiaryPageRoutingModule } from './diary-routing.module';
import { EntrySheetsModule } from './entry-sheets.module';
import { NumPipe } from '../shared/num.pipe';
import { AmountPipe } from './amount.pipe';
import { WeekViewComponent } from './week-view/week-view.component';
import { EditEntrySheetComponent } from './edit-entry-sheet/edit-entry-sheet.component';

@NgModule({
  imports: [SharedModule, NumPipe, AmountPipe, EntrySheetsModule, DiaryPageRoutingModule],
  declarations: [DiaryPage, WeekViewComponent, EditEntrySheetComponent],
})
export class DiaryPageModule {}

import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { DiaryPageRoutingModule } from './diary-routing.module';
import { EntrySheetsModule } from './entry-sheets.module';
import { NumPipe } from '../shared/num.pipe';
import { WeekViewComponent } from './week-view/week-view.component';

@NgModule({
  imports: [SharedModule, NumPipe, EntrySheetsModule, DiaryPageRoutingModule],
  declarations: [DiaryPage, WeekViewComponent],
})
export class DiaryPageModule {}

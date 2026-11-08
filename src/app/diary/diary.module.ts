import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { DiaryPageRoutingModule } from './diary-routing.module';
import { EntrySheetsModule } from './entry-sheets.module';
import { NumPipe } from '../shared/num.pipe';

@NgModule({
  imports: [SharedModule, NumPipe, EntrySheetsModule, DiaryPageRoutingModule],
  declarations: [DiaryPage],
})
export class DiaryPageModule {}

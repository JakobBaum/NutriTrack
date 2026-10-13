import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { DiaryPageRoutingModule } from './diary-routing.module';

@NgModule({
  imports: [SharedModule, DiaryPageRoutingModule],
  declarations: [DiaryPage],
})
export class DiaryPageModule {}

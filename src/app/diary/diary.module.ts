import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { AmountRowComponent } from './amount-row.component';
import { DiaryPageRoutingModule } from './diary-routing.module';
import { NumPipe } from '../shared/num.pipe';

@NgModule({
  imports: [SharedModule, NumPipe, DiaryPageRoutingModule],
  declarations: [DiaryPage, AmountRowComponent],
})
export class DiaryPageModule {}

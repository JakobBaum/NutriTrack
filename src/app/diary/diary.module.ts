import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DiaryPage } from './diary.page';
import { AmountRowComponent } from './amount-row.component';
import { FastfoodFormComponent } from './fastfood-form.component';
import { DiaryPageRoutingModule } from './diary-routing.module';
import { NumPipe } from '../shared/num.pipe';

@NgModule({
  imports: [SharedModule, NumPipe, DiaryPageRoutingModule],
  declarations: [DiaryPage, AmountRowComponent, FastfoodFormComponent],
})
export class DiaryPageModule {}

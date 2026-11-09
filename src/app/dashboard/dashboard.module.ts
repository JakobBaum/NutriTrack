import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DashboardPage } from './dashboard.page';
import { DashboardPageRoutingModule } from './dashboard-routing.module';
import { EntrySheetsModule } from '../diary/entry-sheets.module';
import { NumPipe } from '../shared/num.pipe';
import { WeightModule } from '../weight/weight.module';
import { WeekStripComponent } from './week-strip.component';

@NgModule({
  imports: [SharedModule, NumPipe, EntrySheetsModule, WeightModule, DashboardPageRoutingModule],
  declarations: [DashboardPage, WeekStripComponent],
})
export class DashboardPageModule {}

import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DashboardPage } from './dashboard.page';
import { DashboardPageRoutingModule } from './dashboard-routing.module';
import { EntrySheetsModule } from '../diary/entry-sheets.module';
import { NumPipe } from '../shared/num.pipe';

@NgModule({
  imports: [SharedModule, NumPipe, EntrySheetsModule, DashboardPageRoutingModule],
  declarations: [DashboardPage],
})
export class DashboardPageModule {}

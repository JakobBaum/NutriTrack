import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { DashboardPage } from './dashboard.page';
import { DashboardPageRoutingModule } from './dashboard-routing.module';

@NgModule({
  imports: [SharedModule, DashboardPageRoutingModule],
  declarations: [DashboardPage],
})
export class DashboardPageModule {}

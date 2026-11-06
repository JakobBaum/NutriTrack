import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { NumPipe } from '../shared/num.pipe';
import { SettingsPage } from './settings.page';
import { SettingsPageRoutingModule } from './settings-routing.module';

@NgModule({
  imports: [SharedModule, NumPipe, SettingsPageRoutingModule],
  declarations: [SettingsPage],
})
export class SettingsPageModule {}

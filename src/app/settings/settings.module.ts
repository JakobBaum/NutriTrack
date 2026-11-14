import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { NumPipe } from '../shared/num.pipe';
import { SettingsPage } from './settings.page';
import { ProfileSheetComponent } from './profile-sheet/profile-sheet.component';
import { AiStatusRowComponent } from './ai-status-row/ai-status-row.component';
import { SettingsPageRoutingModule } from './settings-routing.module';
import { WeightModule } from '../weight/weight.module';

@NgModule({
  imports: [SharedModule, NumPipe, WeightModule, SettingsPageRoutingModule],
  declarations: [SettingsPage, ProfileSheetComponent, AiStatusRowComponent],
})
export class SettingsPageModule {}

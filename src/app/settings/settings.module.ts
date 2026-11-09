import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { NumPipe } from '../shared/num.pipe';
import { SettingsPage } from './settings.page';
import { RecipeSearchSettingsComponent } from './recipe-search-settings/recipe-search-settings.component';
import { ProfileSheetComponent } from './profile-sheet/profile-sheet.component';
import { AiStatusRowComponent } from './ai-status-row/ai-status-row.component';
import { SettingsPageRoutingModule } from './settings-routing.module';
import { WeightModule } from '../weight/weight.module';

@NgModule({
  imports: [SharedModule, NumPipe, WeightModule, SettingsPageRoutingModule],
  declarations: [SettingsPage, RecipeSearchSettingsComponent, ProfileSheetComponent, AiStatusRowComponent],
})
export class SettingsPageModule {}

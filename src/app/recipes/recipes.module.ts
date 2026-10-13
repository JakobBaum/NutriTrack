import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { RecipesPage } from './recipes.page';
import { RecipesPageRoutingModule } from './recipes-routing.module';

@NgModule({
  imports: [SharedModule, RecipesPageRoutingModule],
  declarations: [RecipesPage],
})
export class RecipesPageModule {}

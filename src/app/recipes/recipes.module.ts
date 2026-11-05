import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { NumPipe } from '../shared/num.pipe';
import { MealsListComponent } from '../meals/meals-list.component';

import { RecipesPage } from './recipes.page';
import { RecipesPageRoutingModule } from './recipes-routing.module';

@NgModule({
  imports: [SharedModule, NumPipe, MealsListComponent, RecipesPageRoutingModule],
  declarations: [RecipesPage],
})
export class RecipesPageModule {}

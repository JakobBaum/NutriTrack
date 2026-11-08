import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { NumPipe } from '../shared/num.pipe';
import { MealsListComponent } from '../meals/meals-list.component';

import { RecipesPage } from './recipes.page';
import { OnlineSearchComponent } from './online-search/online-search.component';
import { RecipesPageRoutingModule } from './recipes-routing.module';

@NgModule({
  imports: [SharedModule, NumPipe, MealsListComponent, RecipesPageRoutingModule],
  declarations: [RecipesPage, OnlineSearchComponent],
})
export class RecipesPageModule {}

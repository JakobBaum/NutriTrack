import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';

import { NumPipe } from '../shared/num.pipe';
import { ShoppingPage } from './shopping.page';
import { WeekPlanCardsComponent } from './week-plan/week-plan-cards.component';
import { WeekRecipeSheetComponent } from './week-plan/week-recipe-sheet.component';
import { ShoppingPageRoutingModule } from './shopping-routing.module';

@NgModule({
  imports: [SharedModule, RouterModule, ShoppingPageRoutingModule, NumPipe],
  declarations: [ShoppingPage, WeekPlanCardsComponent, WeekRecipeSheetComponent],
})
export class ShoppingPageModule {}

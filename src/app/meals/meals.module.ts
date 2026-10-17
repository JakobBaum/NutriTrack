import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { MealsPage } from './meals.page';
import { MealsPageRoutingModule } from './meals-routing.module';

@NgModule({
  imports: [SharedModule, MealsPageRoutingModule],
  declarations: [MealsPage],
})
export class MealsPageModule {}

import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { ShoppingPage } from './shopping.page';
import { ShoppingPageRoutingModule } from './shopping-routing.module';

@NgModule({
  imports: [SharedModule, ShoppingPageRoutingModule],
  declarations: [ShoppingPage],
})
export class ShoppingPageModule {}

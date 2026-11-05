import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';

import { NumPipe } from '../shared/num.pipe';
import { ShoppingPage } from './shopping.page';
import { ShoppingPageRoutingModule } from './shopping-routing.module';

@NgModule({
  imports: [SharedModule, ShoppingPageRoutingModule, NumPipe],
  declarations: [ShoppingPage],
})
export class ShoppingPageModule {}

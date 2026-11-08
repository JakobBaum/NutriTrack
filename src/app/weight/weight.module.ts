import { NgModule } from '@angular/core';
import { NumPipe } from '../shared/num.pipe';
import { SharedModule } from '../shared/shared.module';
import { WeightCardComponent } from './weight-card.component';

/** Gewichtsverlauf (Karte mit Diagramm und Erfassen-Sheet); wird im Profil eingebunden. */
@NgModule({
  imports: [SharedModule, NumPipe],
  declarations: [WeightCardComponent],
  exports: [WeightCardComponent],
})
export class WeightModule {}

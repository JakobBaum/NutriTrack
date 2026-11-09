import { NgModule } from '@angular/core';
import { NumPipe } from '../shared/num.pipe';
import { SharedModule } from '../shared/shared.module';
import { WeightCardComponent } from './weight-card.component';
import { WeightSheetComponent } from './weight-sheet.component';
import { WeightTileComponent } from './weight-tile.component';

/** Gewichtsverlauf (Karte mit Diagramm und Erfassen-Sheet); wird im Profil eingebunden. */
@NgModule({
  imports: [SharedModule, NumPipe],
  declarations: [WeightCardComponent, WeightSheetComponent, WeightTileComponent],
  exports: [WeightCardComponent, WeightTileComponent],
})
export class WeightModule {}

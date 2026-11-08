import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';

import { ProgressRingComponent } from './progress-ring/progress-ring.component';
import { NtFoodRowComponent } from './food-row/food-row.component';
import { NtStepperComponent } from './stepper/stepper.component';
import { NtDateNavComponent } from './date-nav/date-nav.component';
import { NtFoodSearchComponent } from './food-search/food-search.component';
import { AmountRowComponent } from './amount-row/amount-row.component';
import { NtBarcodeScannerComponent } from './barcode-scanner/barcode-scanner.component';
import { NtFoodSourcesComponent } from './food-sources/food-sources.component';

/**
 * Bündelt wiederverwendbare UI-Bausteine und die üblichen Standard-Module,
 * damit Feature-Module nur `SharedModule` importieren müssen.
 */
@NgModule({
  declarations: [ProgressRingComponent, NtFoodRowComponent, NtStepperComponent, NtDateNavComponent, NtFoodSearchComponent, AmountRowComponent, NtBarcodeScannerComponent, NtFoodSourcesComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [CommonModule, FormsModule, IonicModule, ProgressRingComponent, NtFoodRowComponent, NtStepperComponent, NtDateNavComponent, NtFoodSearchComponent, AmountRowComponent, NtBarcodeScannerComponent, NtFoodSourcesComponent],
})
export class SharedModule {}

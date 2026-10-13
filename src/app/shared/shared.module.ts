import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';

import { ProgressRingComponent } from './progress-ring/progress-ring.component';

/**
 * Bündelt wiederverwendbare UI-Bausteine und die üblichen Standard-Module,
 * damit Feature-Module nur `SharedModule` importieren müssen.
 */
@NgModule({
  declarations: [ProgressRingComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [CommonModule, FormsModule, IonicModule, ProgressRingComponent],
})
export class SharedModule {}

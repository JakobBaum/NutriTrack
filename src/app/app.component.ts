import { Component, DestroyRef, inject } from '@angular/core';
import { showKeyboardDoneBar } from './core/keyboard/keyboard-accessory';
import { reducedMotionQuery, setIonicAnimated, watchReducedMotion } from './core/motion/reduced-motion';
import { StoragePersistenceService } from './core/storage/storage-persistence.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    void inject(StoragePersistenceService).request();
    void showKeyboardDoneBar();
    // Systemwunsch „Bewegung reduzieren“ auch zur Laufzeit übernehmen (Ionic-Animationen).
    const stop = watchReducedMotion(reducedMotionQuery, setIonicAnimated);
    inject(DestroyRef).onDestroy(stop);
  }
}

import { Component, inject } from '@angular/core';
import { showKeyboardDoneBar } from './core/keyboard/keyboard-accessory';
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
  }
}

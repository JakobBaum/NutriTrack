import { DestroyRef, DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

/** Verbindungszustand der App, gespeist aus den Ereignissen `online` und `offline` des Fensters. */
@Injectable({ providedIn: 'root' })
export class OnlineStatusService {
  private readonly win = inject(DOCUMENT).defaultView;
  private readonly isOnline = signal(this.win?.navigator.onLine !== false);

  /** True, solange der Browser keine Verbindung meldet. */
  readonly isOffline = computed(() => !this.isOnline());

  constructor() {
    const win = this.win;
    if (!win) return;
    const goOnline = (): void => this.isOnline.set(true);
    const goOffline = (): void => this.isOnline.set(false);
    win.addEventListener('online', goOnline);
    win.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline);
      win.removeEventListener('offline', goOffline);
    });
  }
}

import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';

/** Abonniert Vordergrund-Wechsel; liefert eine Funktion zum Abmelden. */
export type ResumeSource = (onResume: () => void) => () => void;

/** Standardquelle: Capacitor appStateChange (nativ) plus visibilitychange (Web). */
export const defaultResumeSource: ResumeSource = (onResume) => {
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') onResume();
  };
  document.addEventListener('visibilitychange', onVisibility);

  let handle: { remove: () => Promise<void> } | null = null;
  let removed = false;
  App.addListener('appStateChange', (state) => {
    if (state.isActive) onResume();
  })
    .then((h) => {
      if (removed) void h.remove();
      else handle = h;
    })
    .catch((e: unknown) => console.error('NutriTrack: appStateChange-Listener nicht verfügbar', e));

  return () => {
    removed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    if (handle) void handle.remove();
  };
};

export const RESUME_SOURCE = new InjectionToken<ResumeSource>('RESUME_SOURCE', {
  providedIn: 'root',
  factory: () => defaultResumeSource,
});

/**
 * Meldet, wenn die App wieder in den Vordergrund kommt (Tageswechsel nach Mitternacht).
 * `resumeCount` zählt hoch; Seiten reagieren per effect und berechnen ihr "Heute" neu.
 */
@Injectable({ providedIn: 'root' })
export class AppResumeService {
  private readonly count = signal(0);
  readonly resumeCount = this.count.asReadonly();

  constructor() {
    const stop = inject(RESUME_SOURCE)(() => this.count.update((n) => n + 1));
    inject(DestroyRef).onDestroy(stop);
  }
}

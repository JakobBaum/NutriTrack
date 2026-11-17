import { Signal, effect, inject, signal, untracked } from '@angular/core';
import { AppResumeService } from '../../core/app-resume/app-resume.service';
import { toDateISO } from '../../core/util/date';

/**
 * Signal mit dem heutigen Tag (ISO). Rechnet beim Zurückkehren in die App neu,
 * damit Ansichten nach Mitternacht nicht am Vortag hängen bleiben. Nur im Injektionskontext aufrufen.
 */
export function injectToday(): Signal<string> {
  const resume = inject(AppResumeService);
  const today = signal(toDateISO());
  effect(() => {
    if (resume.resumeCount() > 0) untracked(() => today.set(toDateISO()));
  });
  return today.asReadonly();
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { CONSENT_KEY, ConsentRecord, NO_CONSENT, buildConsent, isConsentGranted, parseConsent } from './consent.model';

/**
 * Persistente Zustimmung zu den KI- und Online-Funktionen (Version, Zeitpunkt, 18+-Bestätigung).
 * Gehört nicht ins Backup (siehe `isNeverBackedUp`).
 */
@Injectable({ providedIn: 'root' })
export class ConsentStore {
  private readonly storage = inject(StorageService);
  private readonly record = signal<ConsentRecord>(parseConsent(this.storage.get<unknown>(CONSENT_KEY, null)));

  /** True, wenn eine gültige Zustimmung zur aktuellen Textversion vorliegt. */
  readonly granted = computed(() => isConsentGranted(this.record()));
  /** ISO-Zeitpunkt der Zustimmung oder `null`. */
  readonly acceptedAt = computed(() => this.record().acceptedAt);

  /** Speichert die Zustimmung; `false`, wenn die Volljährigkeit nicht bestätigt wurde. */
  grant(now: Date, isAdultConfirmed: boolean): boolean {
    const next = buildConsent(now, isAdultConfirmed);
    if (!next) return false;
    this.record.set(next);
    this.storage.set(CONSENT_KEY, next);
    return true;
  }

  /** Widerruft die Zustimmung (auch für "Daten zurücksetzen"). */
  revoke(): void {
    this.record.set(NO_CONSENT);
    this.storage.remove(CONSENT_KEY);
  }
}

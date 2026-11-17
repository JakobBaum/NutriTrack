import { CONSENT_KEY } from '../consent/consent.model';
import { isNeverBackedUp } from '../backup/backup';
import { SCHEMA_KEY } from './storage-schema';

/**
 * UI-Merker (Gewichts-Drift-Hinweis weggeklickt). Er wird anders als Meta-Daten durchaus exportiert und importiert,
 * ist aber bewusst von der Fremdfenster-Sperre ausgenommen: ein verlorener Merker kostet höchstens einen erneuten Hinweis.
 */
const WEIGHT_HINT_KEY = 'weightHintDismissedAtKg';

/**
 * Schlüssel, deren Änderung in einem anderen Fenster dieses Fenster NICHT sperren muss:
 * Cache und Meta-Daten (nie im Backup). Die Schema-Version bleibt ausgenommen, denn eine neuere App
 * in einem anderen Fenster muss weiterhin sperren.
 */
export function isLockExemptKey(key: string): boolean {
  return key !== SCHEMA_KEY && (isNeverBackedUp(key) || key === WEIGHT_HINT_KEY);
}

/** Die Zustimmung wird bei fremder Änderung neu eingelesen statt zu sperren. */
export const isConsentKey = (key: string): boolean => key === CONSENT_KEY;

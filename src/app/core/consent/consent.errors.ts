import { STATE_MESSAGES } from '../messages/state-messages';

/** Die Funktion braucht die Zustimmung zu den Online-Funktionen, die nicht (oder nicht mehr) vorliegt. */
export class ConsentRequiredError extends Error {
  constructor(message: string = STATE_MESSAGES.consentRequired) {
    super(message);
    this.name = 'ConsentRequiredError';
  }
}

export function isConsentRequiredError(err: unknown): err is ConsentRequiredError {
  return err instanceof ConsentRequiredError;
}

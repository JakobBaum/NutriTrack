/** Wird geworfen, wenn eine Erzeugung abgebrochen wurde (Nutzer tippt „Abbrechen“); das Ergebnis wird verworfen. */
export class GenerationCancelledError extends Error {
  constructor() {
    super('Erzeugen abgebrochen');
    this.name = 'GenerationCancelledError';
  }
}

/** Wirft {@link GenerationCancelledError}, wenn die Anfrage nicht mehr aktuell ist. */
export function assertCurrent(isCurrent: (() => boolean) | undefined): void {
  if (isCurrent && !isCurrent()) throw new GenerationCancelledError();
}

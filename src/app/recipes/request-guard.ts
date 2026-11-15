/**
 * Wirft veraltete Antworten weg: jede neue Anfrage bekommt eine Nummer, nur die letzte gilt.
 * `cancel()` entwertet alle laufenden Anfragen (z. B. beim Schließen eines Sheets).
 */
export class RequestGuard {
  private seq = 0;

  /** Startet eine Anfrage und liefert ihre Nummer. */
  begin(): number {
    this.seq += 1;
    return this.seq;
  }

  /** True, solange seit `begin()` keine neuere Anfrage und kein `cancel()` kam. */
  isCurrent(token: number): boolean {
    return token === this.seq;
  }

  /** Entwertet alle laufenden Anfragen. */
  cancel(): void {
    this.seq += 1;
  }
}

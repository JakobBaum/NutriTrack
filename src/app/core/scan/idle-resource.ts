/** Ressource mit Idle-Timeout. */
export interface Disposable {
  terminate(): Promise<unknown>;
}

/**
 * Hält eine teure Ressource (z. B. den Tesseract-Worker) als lazy Singleton:
 * Sie wird beim ersten Zugriff erzeugt, für folgende Aufrufe wiederverwendet und
 * nach `idleMs` ohne Nutzung beendet. Ein fehlgeschlagener Aufruf verwirft sie,
 * damit der nächste Scan mit einer frischen Instanz startet.
 */
export class IdleResource<R extends Disposable> {
  private pending?: Promise<R>;
  private active = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly create: () => Promise<R>,
    private readonly idleMs: number,
  ) {}

  async use<T>(job: (resource: R) => Promise<T>): Promise<T> {
    clearTimeout(this.timer);
    this.active++;
    const pending = (this.pending ??= this.create());
    try {
      const resource = await pending;
      return await job(resource);
    } catch (e: unknown) {
      if (this.pending === pending) {
        this.pending = undefined;
        void pending.then((r) => r.terminate()).catch(() => undefined);
      }
      throw e;
    } finally {
      this.active--;
      if (this.active === 0) this.scheduleDispose();
    }
  }

  /** True, solange eine Instanz gehalten wird (für Tests/Diagnose). */
  get isAlive(): boolean {
    return this.pending !== undefined;
  }

  private scheduleDispose(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const pending = this.pending;
      this.pending = undefined;
      void pending?.then((r) => r.terminate()).catch(() => undefined);
    }, this.idleMs);
  }
}

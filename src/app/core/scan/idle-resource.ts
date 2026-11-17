/** Ressource mit Idle-Timeout. */
export interface Disposable {
  terminate(): Promise<unknown>;
}

/** Eine erzeugte Instanz samt Anzahl laufender Jobs; `retired` = darf nicht mehr neu vergeben werden. */
interface Slot<R> {
  readonly promise: Promise<R>;
  users: number;
  retired: boolean;
}

/**
 * Hält eine teure Ressource (z. B. den Tesseract-Worker) als lazy Singleton:
 * Sie wird beim ersten Zugriff erzeugt, für folgende Aufrufe wiederverwendet und
 * nach `idleMs` ohne Nutzung beendet. Ein fehlgeschlagener Job verwirft die Instanz für NEUE Jobs;
 * beendet wird sie erst, wenn kein anderer Job sie mehr nutzt (K18), damit parallele Jobs nicht abbrechen.
 */
export class IdleResource<R extends Disposable> {
  private current?: Slot<R>;
  private active = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly create: () => Promise<R>,
    private readonly idleMs: number,
  ) {}

  async use<T>(job: (resource: R) => Promise<T>): Promise<T> {
    clearTimeout(this.timer);
    this.active++;
    const slot = (this.current ??= { promise: this.create(), users: 0, retired: false });
    slot.users++;
    try {
      return await job(await slot.promise);
    } catch (e: unknown) {
      this.retire(slot);
      throw e;
    } finally {
      slot.users--;
      this.active--;
      this.disposeIfUnused(slot);
      if (this.active === 0) this.scheduleDispose();
    }
  }

  /** True, solange eine Instanz gehalten wird (für Tests/Diagnose). */
  get isAlive(): boolean {
    return this.current !== undefined;
  }

  private retire(slot: Slot<R>): void {
    slot.retired = true;
    if (this.current === slot) this.current = undefined;
  }

  private disposeIfUnused(slot: Slot<R>): void {
    if (slot.retired && slot.users === 0) void slot.promise.then((r) => r.terminate()).catch(() => undefined);
  }

  private scheduleDispose(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const slot = this.current;
      if (!slot) return;
      this.retire(slot);
      this.disposeIfUnused(slot);
    }, this.idleMs);
  }
}

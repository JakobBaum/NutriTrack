import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOD_PROVIDER } from '../../core/food/food-provider';
import { FoodLookupError } from '../../core/food/food-errors';
import { BarcodeScannerService } from '../../core/scan/barcode-scanner.service';
import { NtBarcodeScannerComponent, RESCAN_DELAY_MS } from './barcode-scanner.component';

type Internals = {
  onPresent(): Promise<void>;
  onDismiss(): void;
  error(): string | null;
  modal?: { dismiss: () => Promise<boolean> };
  found: { subscribe(fn: (hit: unknown) => void): unknown };
};

const lookupByBarcode = vi.fn();
const start = vi.fn();
let onCode: (code: string) => void = () => undefined;

function create(): Internals {
  const fixture = TestBed.createComponent(NtBarcodeScannerComponent);
  return fixture.componentInstance as unknown as Internals;
}

beforeEach(() => {
  vi.useFakeTimers();
  lookupByBarcode.mockReset();
  start.mockReset();
  start.mockImplementation(async (_v: unknown, cb: (code: string) => void) => {
    onCode = cb;
    return { stop: vi.fn() };
  });
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [NtBarcodeScannerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: FOOD_PROVIDER, useValue: { lookupByBarcode } },
      { provide: BarcodeScannerService, useValue: { isSupported: () => true, start } },
    ],
  });
  document.body.insertAdjacentHTML('beforeend', '<video id="ntBarcodeVideo"></video>');
});

afterEach(() => {
  document.getElementById('ntBarcodeVideo')?.remove();
  vi.useRealTimers();
});

describe('NtBarcodeScannerComponent — erneuter Scan (FDB-03)', () => {
  it('startet die Kamera nach "nicht gefunden" erneut und zeigt eine eigene Meldung', async () => {
    // Arrange
    lookupByBarcode.mockResolvedValue(null);
    const cmp = create();
    await cmp.onPresent();

    // Act
    onCode('4000');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(RESCAN_DELAY_MS + 1);

    // Assert
    expect(cmp.error()).toContain('Kein Produkt zu Barcode 4000');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('startet nach einem Netzfehler erneut und nennt den Fehler statt "nicht gefunden"', async () => {
    lookupByBarcode.mockRejectedValue(new FoodLookupError('timeout', 'x'));
    const cmp = create();
    await cmp.onPresent();

    onCode('4000');
    await vi.advanceTimersByTimeAsync(RESCAN_DELAY_MS + 1);

    expect(cmp.error()).toContain('antwortet gerade nicht');
    expect(cmp.error()).not.toContain('Kein Produkt');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('startet nach dem Schließen nicht mehr neu', async () => {
    lookupByBarcode.mockResolvedValue(null);
    const cmp = create();
    await cmp.onPresent();

    onCode('4000');
    await vi.advanceTimersByTimeAsync(0);
    cmp.onDismiss();
    await vi.advanceTimersByTimeAsync(RESCAN_DELAY_MS + 1);

    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe("NtBarcodeScannerComponent — Treffer erst nach dem Schließen (Absturz nach Scan)", () => {
  const ITEM = { id: "x", name: "Haferdrink" };

  it("schließt zuerst das Modal und meldet den Treffer erst nach didDismiss", async () => {
    // Arrange
    lookupByBarcode.mockResolvedValue(ITEM);
    const cmp = create();
    const dismiss = vi.fn(async () => true);
    cmp.modal = { dismiss };
    const found = vi.fn();
    cmp.found.subscribe(found);
    await cmp.onPresent();

    // Act
    onCode("4000");
    await vi.advanceTimersByTimeAsync(0);

    // Assert: noch kein Treffer, solange das Modal schließt
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(found).not.toHaveBeenCalled();
    cmp.onDismiss();
    await vi.advanceTimersByTimeAsync(0);
    expect(found).toHaveBeenCalledWith({ item: ITEM, code: "4000" });
  });

  it("meldet den Treffer direkt, wenn kein Modal vorhanden ist", async () => {
    lookupByBarcode.mockResolvedValue(ITEM);
    const cmp = create();
    const found = vi.fn();
    cmp.found.subscribe(found);
    await cmp.onPresent();

    onCode("4000");
    await vi.advanceTimersByTimeAsync(0);

    expect(found).toHaveBeenCalledWith({ item: ITEM, code: "4000" });
  });

  it("meldet einen Treffer nur einmal", async () => {
    lookupByBarcode.mockResolvedValue(ITEM);
    const cmp = create();
    cmp.modal = { dismiss: vi.fn(async () => true) };
    const found = vi.fn();
    cmp.found.subscribe(found);
    await cmp.onPresent();
    onCode("4000");
    await vi.advanceTimersByTimeAsync(0);

    cmp.onDismiss();
    cmp.onDismiss();
    await vi.advanceTimersByTimeAsync(0);

    expect(found).toHaveBeenCalledTimes(1);
  });
});

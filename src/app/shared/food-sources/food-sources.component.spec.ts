import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from '../../core/ai/ai.service';
import { ConsentService } from '../../core/consent/consent.service';
import { BarcodeScannerService } from '../../core/scan/barcode-scanner.service';
import { CameraService } from '../../core/scan/camera.service';
import { LabelOcrService } from '../../core/scan/label-ocr.service';
import {
  NtFoodSourcesComponent, SLOW_AI_HINT_MS, STATUS_PREPARING, STATUS_READING, STATUS_SLOW,
} from './food-sources.component';

type Internals = { shrink: (b: string) => Promise<string>; run(get: () => Promise<string>, msg: string): Promise<void>; scanStatus(): string | null };

const recognizeLabel = vi.fn();
const recognizeText = vi.fn();
let consentGranted = true;

function create(): Internals {
  const cmp = TestBed.createComponent(NtFoodSourcesComponent).componentInstance as unknown as Internals;
  cmp.shrink = async (b) => b;
  return cmp;
}

beforeEach(() => {
  vi.useFakeTimers();
  recognizeLabel.mockReset();
  recognizeText.mockReset();
  consentGranted = true;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    declarations: [NtFoodSourcesComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: AiService, useValue: { isLive: () => true, recognizeLabel } },
      { provide: CameraService, useValue: { isNativeCameraAvailable: () => false } },
      { provide: BarcodeScannerService, useValue: { preload: vi.fn() } },
      { provide: LabelOcrService, useValue: { recognizeText } },
      { provide: ConsentService, useValue: { isGranted: () => consentGranted } },
    ],
  });
});

afterEach(() => vi.useRealTimers());

describe('NtFoodSourcesComponent — Fortschritt der Etikett-Erkennung', () => {
  it('zeigt erst "vorbereitet", dann "KI liest" und danach nichts mehr', async () => {
    // Arrange
    let finish: (v: unknown) => void = () => undefined;
    recognizeLabel.mockReturnValue(new Promise((r) => { finish = r; }));
    const cmp = create();

    // Act
    const running = cmp.run(async () => 'IMG', 'x');
    expect(cmp.scanStatus()).toBe(STATUS_PREPARING);
    await vi.waitFor(() => expect(cmp.scanStatus()).toBe(STATUS_READING));

    // Assert
    finish({ name: 'n', facts: {} });
    await running;
    expect(cmp.scanStatus()).toBeNull();
  });

  it('weist nach einer langen Wartezeit auf die Dauer hin', async () => {
    recognizeLabel.mockReturnValue(new Promise(() => undefined));
    const cmp = create();
    void cmp.run(async () => 'IMG', 'x');
    await vi.waitFor(() => expect(cmp.scanStatus()).toBe(STATUS_READING));
    await vi.advanceTimersByTimeAsync(SLOW_AI_HINT_MS + 1);

    expect(cmp.scanStatus()).toBe(STATUS_SLOW);
  });

  it('räumt den Status auch nach einem Fehler auf', async () => {
    recognizeLabel.mockRejectedValue(new Error('KI nicht erreichbar'));
    const cmp = create();

    await cmp.run(async () => 'IMG', 'x');

    expect(cmp.scanStatus()).toBeNull();
  });
});

describe('NtFoodSourcesComponent — ohne Zustimmung', () => {
  it('liest das Etikett nur auf dem Gerät und sendet nichts an die KI', async () => {
    // Arrange
    consentGranted = false;
    recognizeText.mockResolvedValue('Brennwert 100 kcal');
    const cmp = create();

    // Act
    await cmp.run(async () => 'IMG', 'x');

    // Assert
    expect(recognizeText).toHaveBeenCalledWith('IMG');
    expect(recognizeLabel).not.toHaveBeenCalled();
  });

  it('nutzt mit Zustimmung weiter die KI', async () => {
    recognizeLabel.mockResolvedValue({ name: 'n', facts: {} });
    const cmp = create();

    await cmp.run(async () => 'IMG', 'x');

    expect(recognizeLabel).toHaveBeenCalledTimes(1);
    expect(recognizeText).not.toHaveBeenCalled();
  });
});

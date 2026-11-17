import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  CAMERA_DENIED_MESSAGE, CameraCancelledError, CameraDeniedError, isCameraDenied, toCameraError,
} from './camera-errors';
import {
  BarcodeScannerService, SCAN_ATTEMPT_DELAY_MS, SCAN_FORMAT_NAMES, SCAN_VIDEO_CONSTRAINTS,
} from './barcode-scanner.service';

type DecodeCallback = (result: { getText(): string } | undefined, err: unknown) => void;

describe('BarcodeScannerService.start', () => {
  let service: BarcodeScannerService;
  let callback: DecodeCallback;
  let decodeFromConstraints: ReturnType<typeof vi.fn>;
  const controls = { stop: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BarcodeScannerService);
    decodeFromConstraints = vi.fn(async (_c: unknown, _v: unknown, cb: unknown) => {
      callback = cb as DecodeCallback;
      return controls;
    });
    vi.spyOn(service as unknown as { loadReader(): Promise<unknown> }, 'loadReader')
      .mockResolvedValue({ decodeFromConstraints });
  });

  it('nutzt die Rückkamera und gibt die Controls zurück', async () => {
    const video = document.createElement('video');
    const res = await service.start(video, () => undefined);
    expect(res).toBe(controls);
    expect(decodeFromConstraints.mock.calls[0][0]).toEqual({ video: SCAN_VIDEO_CONSTRAINTS });
  });

  it('fragt Rückkamera in 720p an (iOS liefert sonst 640x480, zu grob für EAN)', () => {
    expect(SCAN_VIDEO_CONSTRAINTS).toEqual({ facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } });
  });

  it('nennt nur Handelscode-Formate (EAN/UPC/Code 128), keine 2D-Codes', () => {
    expect(SCAN_FORMAT_NAMES).toEqual(['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128']);
    expect(SCAN_ATTEMPT_DELAY_MS).toBeLessThanOrEqual(150);
  });

  it('meldet erkannte Codes', async () => {
    const onResult = vi.fn();
    await service.start(document.createElement('video'), onResult);
    callback({ getText: () => '4006381333931' }, undefined);
    expect(onResult).toHaveBeenCalledWith('4006381333931');
  });

  it('gibt nur echte Kamerafehler (DOMException) weiter', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    await service.start(document.createElement('video'), onResult, onError);
    callback(undefined, new Error('NotFoundException'));
    callback(undefined, undefined);
    expect(onError).not.toHaveBeenCalled();
    const denied = new DOMException('denied', 'NotAllowedError');
    callback(undefined, denied);
    expect(onError).toHaveBeenCalledWith(denied);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('wirft nicht ohne onError-Callback', async () => {
    await service.start(document.createElement('video'), () => undefined);
    expect(() => callback(undefined, new DOMException('x', 'NotFoundError'))).not.toThrow();
  });
});

// CameraService.takePhotoBase64 ist hier nicht testbar: Das Capacitor-Plugin ist ein Proxy,
// auf dem sich getPhoto nicht per vi.spyOn ersetzen lässt ("property not defined").

describe('BarcodeScannerService.loadReader — gescheiterter Import (K7)', () => {
  it('lädt die Bibliothek nach einem Fehlschlag beim nächsten Versuch erneut', async () => {
    // Arrange
    TestBed.configureTestingModule({});
    const service = TestBed.inject(BarcodeScannerService);
    const importZxing = vi
      .spyOn(service as unknown as { importZxing(): Promise<unknown> }, 'importZxing')
      .mockRejectedValue(new Error('Chunk fehlt'));
    const load = (): Promise<unknown> => (service as unknown as { loadReader(): Promise<unknown> }).loadReader();

    // Act
    await expect(load()).rejects.toThrow('Chunk fehlt');
    await expect(load()).rejects.toThrow('Chunk fehlt');

    // Assert: kein dauerhaft gemerktes Fehlversprechen
    expect(importZxing).toHaveBeenCalledTimes(2);
  });
});

describe('toCameraError (K2)', () => {
  it('meldet den Abbruch der nativen Kamera als CameraCancelledError', () => {
    const err = toCameraError(new Error('User cancelled photos app'));
    expect(err).toBeInstanceOf(CameraCancelledError);
  });

  it('meldet verweigerte Berechtigung mit deutscher Meldung', () => {
    const err = toCameraError(new Error('User denied access to camera'));
    expect(err).toBeInstanceOf(CameraDeniedError);
    expect(err.message).toBe(CAMERA_DENIED_MESSAGE);
  });

  it('erkennt NotAllowedError aus getUserMedia als verweigert', () => {
    expect(isCameraDenied(new DOMException('x', 'NotAllowedError'))).toBe(true);
    expect(isCameraDenied(new DOMException('x', 'NotFoundError'))).toBe(false);
  });

  it('reicht andere Fehler unverändert weiter', () => {
    const other = new Error('Kein Foto erhalten.');
    expect(toCameraError(other)).toBe(other);
  });
});

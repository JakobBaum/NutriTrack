import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BarcodeScannerService } from './barcode-scanner.service';

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
    expect(decodeFromConstraints.mock.calls[0][0]).toEqual({ video: { facingMode: 'environment' } });
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

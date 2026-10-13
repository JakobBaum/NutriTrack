import { TestBed } from '@angular/core/testing';
import { CameraService } from './camera.service';
import { BarcodeScannerService } from './barcode-scanner.service';

describe('CameraService', () => {
  let service: CameraService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CameraService);
  });

  it('reports no native camera in the (web/jsdom) test environment', () => {
    // Arrange / Act
    const available = service.isNativeCameraAvailable();

    // Assert — Capacitor is on the web platform under test → file-input fallback
    expect(available).toBe(false);
  });
});

describe('BarcodeScannerService', () => {
  let service: BarcodeScannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BarcodeScannerService);
  });

  it('reports unsupported when getUserMedia is unavailable', () => {
    // Arrange — jsdom has no navigator.mediaDevices.getUserMedia
    // Act
    const supported = service.isSupported();

    // Assert
    expect(supported).toBe(false);
  });

  it('reports supported when getUserMedia exists', () => {
    // Arrange
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve({} as MediaStream) },
    });

    // Act
    const supported = service.isSupported();

    // Assert
    expect(supported).toBe(true);

    // Cleanup
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: original,
    });
  });
});

import { Injectable } from '@angular/core';
import type { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

/** 720p statt Gerätestandard (iOS: 640x480): feine Striche der EAN-Codes bleiben lesbar. */
export const SCAN_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

/** Nur Handelscodes dekodieren; 2D-Codes (QR, DataMatrix, PDF417, Aztec) kosten je Frame Zeit und kommen auf Lebensmitteln nicht vor. */
export const SCAN_FORMAT_NAMES = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'] as const;

/** Pause zwischen zwei Dekodierversuchen (zxing-Standard: 500 ms). */
export const SCAN_ATTEMPT_DELAY_MS = 100;

/**
 * Browser-tauglicher Barcode-Scanner auf Basis von `@zxing/browser`.
 *
 * Läuft im `ng serve`-Dev-Server und auf dem Gerät (nutzt `getUserMedia`),
 * sodass der Flow ohne natives Plugin testbar bleibt. Dekodiert fortlaufend
 * aus einem `<video>`-Element und ruft bei jedem Treffer den Callback.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private reader?: Promise<BrowserMultiFormatReader>;

  /** zxing (~570 kB) wird erst bei Bedarf nachgeladen; {@link preload} holt es schon beim Antippen vor. */
  protected loadReader(): Promise<BrowserMultiFormatReader> {
    return (this.reader ??= import('@zxing/browser').then(async (m) => {
      const { DecodeHintType } = await import('@zxing/library');
      const formats = SCAN_FORMAT_NAMES.map((name) => m.BarcodeFormat[name]);
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats]]);
      return new m.BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: SCAN_ATTEMPT_DELAY_MS,
        delayBetweenScanSuccess: SCAN_ATTEMPT_DELAY_MS,
      });
    }));
  }

  /** Lädt die Bibliothek im Hintergrund, damit der Scanner nach dem Öffnen sofort startet. */
  preload(): void {
    this.loadReader().catch(() => {
      this.reader = undefined;
    });
  }

  /** True, wenn der Browser Kamerazugriff (getUserMedia) unterstützt. */
  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Startet den Scan aus der (rückseitigen, falls vorhanden) Kamera in das
   * angegebene Video-Element. Gibt die Scanner-Controls zum Stoppen zurück.
   * `onResult` wird mit dem erkannten Code aufgerufen.
   */
  async start(
    video: HTMLVideoElement,
    onResult: (code: string) => void,
    onError?: (err: unknown) => void,
  ): Promise<IScannerControls> {
    const reader = await this.loadReader();
    return reader.decodeFromConstraints(
      { video: SCAN_VIDEO_CONSTRAINTS },
      video,
      (result, err) => {
        if (result) {
          onResult(result.getText());
          return;
        }
        // zxing wirft bei jedem Frame ohne Treffer NotFoundException,
        // ChecksumException oder FormatException — alles normale Scan-Frames.
        // Nur echte Kamerafehler (DOMException: NotAllowed, NotFound …) weitergeben.
        if (err && err instanceof DOMException && onError) {
          onError(err);
        }
      },
    );
  }
}

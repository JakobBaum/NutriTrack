import { Injectable } from '@angular/core';
import type { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

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

  /** zxing (~570 kB) wird erst beim ersten Öffnen des Scanners nachgeladen. */
  protected loadReader(): Promise<BrowserMultiFormatReader> {
    return (this.reader ??= import('@zxing/browser').then((m) => new m.BrowserMultiFormatReader()));
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
      { video: { facingMode: 'environment' } },
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

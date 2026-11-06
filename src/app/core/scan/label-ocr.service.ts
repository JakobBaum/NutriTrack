import { Injectable } from '@angular/core';
import { prepareLabelImage } from './label-image';

const OCR_LANGS = ['deu', 'eng'];
/** Selbst gehostete Dateien (siehe angular.json "assets"); kein CDN nötig, läuft offline. */
const ASSET_DIR = 'assets/tesseract';

function assetUrl(path: string): string {
  return new URL(`${ASSET_DIR}/${path}`, document.baseURI).href;
}

/**
 * On-Device-OCR (tesseract.js, Deutsch + Englisch). Die Bibliothek wird erst beim
 * Scannen nachgeladen; Worker, Core und Sprachdaten kommen aus `assets/tesseract/`.
 */
@Injectable({ providedIn: 'root' })
export class LabelOcrService {
  /** Liest den Text eines Etiketten-Fotos (Base64 ohne Präfix). */
  async recognizeText(base64: string): Promise<string> {
    const canvas = await prepareLabelImage(base64);
    const mod = await import('tesseract.js');
    const createWorker = mod.createWorker ?? mod.default.createWorker;
    const worker = await createWorker(OCR_LANGS, 1, {
      workerPath: assetUrl('worker.min.js'),
      corePath: assetUrl('core'),
      langPath: assetUrl('lang'),
      gzip: true,
    });
    try {
      const { data } = await worker.recognize(canvas);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }
}

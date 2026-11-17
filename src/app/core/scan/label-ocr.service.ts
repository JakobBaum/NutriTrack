import { Injectable } from '@angular/core';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { IdleResource } from './idle-resource';
import { prepareLabelImage } from './label-image';
import { coreFileName } from './ocr-core';

const OCR_LANGS = ['deu', 'eng'];
/** Selbst gehostete Dateien (siehe angular.json "assets"); kein CDN nötig, läuft offline. */
const ASSET_DIR = 'assets/tesseract';
/** Der Worker bleibt so lange nach dem letzten Scan geladen (Mehrfach-Scans ohne Neuladen). */
export const OCR_IDLE_MS = 60_000;

/** Längste erlaubte Dauer für eine Texterkennung; danach wird der Worker verworfen (K18). */
export const OCR_TIMEOUT_MS = 45_000;

/** Die Texterkennung lief länger als erlaubt. */
export class OcrTimeoutError extends Error {}

/** Bricht ein Promise nach `ms` mit einem Fehler ab. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OcrTimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function assetUrl(path: string): string {
  return new URL(`${ASSET_DIR}/${path}`, document.baseURI).href;
}

async function createOcrWorker(): Promise<TesseractWorker> {
  const mod = await import('tesseract.js');
  const createWorker = mod.createWorker ?? mod.default.createWorker;
  return createWorker(OCR_LANGS, 1, {
    workerPath: assetUrl('worker.min.js'),
    corePath: assetUrl(`core/${coreFileName()}`),
    langPath: assetUrl('lang'),
    gzip: true,
  });
}

/**
 * On-Device-OCR (tesseract.js, Deutsch + Englisch). Die Bibliothek wird erst beim
 * Scannen nachgeladen; Worker, Core und Sprachdaten kommen aus `assets/tesseract/`.
 * Der Worker wird als lazy Singleton wiederverwendet und nach 60 s Leerlauf beendet.
 */
@Injectable({ providedIn: 'root' })
export class LabelOcrService {
  private readonly worker = new IdleResource<TesseractWorker>(createOcrWorker, OCR_IDLE_MS);

  /** Liest den Text eines Etiketten-Fotos (Base64 ohne Präfix). */
  async recognizeText(base64: string): Promise<string> {
    const canvas = await prepareLabelImage(base64);
    return this.worker.use((w) =>
      withTimeout(w.recognize(canvas).then((r) => r.data.text), OCR_TIMEOUT_MS, 'OCR-Zeitüberschreitung'),
    );
  }
}

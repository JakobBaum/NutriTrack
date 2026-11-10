/** Bild-Vorbereitung für die Etikett-OCR (Verkleinern, Graustufen, Kontrast). */

/** Längste Kante nach dem Verkleinern; mehr bringt der OCR nichts, kostet aber Zeit. */
export const OCR_MAX_EDGE_PX = 1600;

/** Skalierungsfaktor (<= 1), damit die längste Kante höchstens `maxEdge` misst. */
export function downscaleFactor(width: number, height: number, maxEdge: number = OCR_MAX_EDGE_PX): number {
  const longest = Math.max(width, height);
  if (!(longest > 0)) return 1;
  return Math.min(1, maxEdge / longest);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Das Foto konnte nicht geladen werden.'));
    img.src = src;
  });
}

/** Wandelt ein Base64-Foto (ohne data-URL-Präfix) in ein verkleinertes Graustufen-Canvas. */
export async function prepareLabelImage(base64: string): Promise<HTMLCanvasElement> {
  const src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  const img = await loadImage(src);
  const factor = downscaleFactor(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Das Foto konnte nicht verarbeitet werden.');
  ctx.filter = 'grayscale(1) contrast(1.25)';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Längste Kante für KI-Uploads: reicht für Etiketten und Rezepte, hält den Upload klein (mobiles Netz). */
export const UPLOAD_MAX_EDGE_PX = 1280;

/** JPEG-Qualität beim Verkleinern für KI-Uploads. */
export const UPLOAD_JPEG_QUALITY = 0.7;

/** Abhängigkeiten von {@link shrinkPhotoForUpload}; in Tests ersetzbar. */
export interface PhotoShrinkDeps {
  load: (src: string) => Promise<{ width: number; height: number; draw: (canvas: HTMLCanvasElement) => void }>;
  createCanvas: () => HTMLCanvasElement;
}

const browserDeps: PhotoShrinkDeps = {
  load: async (src) => {
    const img = await loadImage(src);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (canvas) => canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height),
    };
  },
  createCanvas: () => document.createElement('canvas'),
};

/**
 * Verkleinert ein Foto (Base64 ohne Präfix) vor dem KI-Upload auf höchstens `maxEdge` px
 * längste Kante (JPEG). Kleinere Fotos kommen unverändert zurück; schlägt die Aufbereitung
 * fehl, wird das Original verwendet (der Upload darf daran nicht scheitern).
 */
export async function shrinkPhotoForUpload(
  base64: string,
  maxEdge: number = UPLOAD_MAX_EDGE_PX,
  deps: PhotoShrinkDeps = browserDeps,
): Promise<string> {
  try {
    const src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    const img = await deps.load(src);
    const factor = downscaleFactor(img.width, img.height, maxEdge);
    if (factor >= 1) return base64;
    const canvas = deps.createCanvas();
    canvas.width = Math.max(1, Math.round(img.width * factor));
    canvas.height = Math.max(1, Math.round(img.height * factor));
    img.draw(canvas);
    const out = canvas.toDataURL('image/jpeg', UPLOAD_JPEG_QUALITY);
    return out.includes(',') ? out.split(',')[1] : base64;
  } catch {
    return base64;
  }
}

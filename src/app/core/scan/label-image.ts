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

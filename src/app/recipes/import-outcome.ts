import { RecipeImportResult } from '../core/ai/ai-provider';

export type ImportOrigin = 'photo' | 'tiktok' | 'url' | 'text';

/**
 * Antwort des Imports; `usedFallbackText` setzt der Worker, wenn der Link nicht abrufbar war und
 * stattdessen der eingefügte Text ausgewertet wurde. Fehlt das Feld (älterer Worker), gilt der Link als gelesen.
 */
export type ImportResponse = RecipeImportResult & { usedFallbackText?: boolean };

export interface ImportOutcome {
  readonly origin: ImportOrigin;
  readonly sourceUrl: string | undefined;
  readonly toast: string;
}

export const LINK_FALLBACK_TOAST =
  'Der Link war nicht abrufbar. Das Rezept stammt aus dem eingefügten Text — bitte prüfen und speichern.';

/** Herkunft, Quelle und Hinweis eines erfolgreichen Text- oder Link-Imports. */
export function importOutcome(
  res: ImportResponse,
  ctx: { url: string; isTikTok: boolean; isLive: boolean },
): ImportOutcome {
  const hasUrl = ctx.url !== '';
  if (hasUrl && res.usedFallbackText === true) {
    return { origin: 'text', sourceUrl: undefined, toast: LINK_FALLBACK_TOAST };
  }
  const origin: ImportOrigin = ctx.isTikTok ? 'tiktok' : hasUrl ? 'url' : 'text';
  const toast = ctx.isLive
    ? `Rezept${ctx.isTikTok ? ' aus TikTok' : ''} importiert — bitte prüfen und speichern.`
    : 'Rezept aus Text erkannt — Nährwerte je Zutat prüfen oder ergänzen.';
  return { origin, sourceUrl: hasUrl ? res.sourceUrl : undefined, toast };
}

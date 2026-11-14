import { Injectable } from '@angular/core';
import { defaultAiProxyUrl } from '../../ai/ai-endpoint';

export interface RecipeSearchAccess {
  /** Ob die Online-Suche über den globalen Worker erreichbar konfiguriert ist. */
  available: boolean;
  /** Basis-URL des Workers ohne abschließenden Schrägstrich ('' wenn nicht verfügbar). */
  baseUrl: string;
}

/** Die Suche läuft ausschließlich über den globalen Worker (kein eigener Schlüssel im Client). */
export function resolveRecipeSearchAccess(workerUrl: string): RecipeSearchAccess {
  const baseUrl = workerUrl.trim().replace(/\/+$/, '');
  return { available: baseUrl !== '', baseUrl };
}

/** Entscheidet, ob und wie die Online-Suche erreicht wird. */
@Injectable({ providedIn: 'root' })
export class RecipeSearchAccessService {
  isAvailable(): boolean {
    return this.resolve().available;
  }

  resolve(): RecipeSearchAccess {
    return resolveRecipeSearchAccess(defaultAiProxyUrl());
  }
}

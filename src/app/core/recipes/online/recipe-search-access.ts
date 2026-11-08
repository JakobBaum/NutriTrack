import { Injectable, computed, inject } from '@angular/core';
import { effectiveProxyUrl } from '../../ai/ai-endpoint';
import { RecipeSearchConfig, RecipeSearchConfigStore } from '../../state/recipe-search-config.store';
import { SettingsStore } from '../../state/settings.store';

/** Zugangsart zur Rezept-Suche: eigener Schlüssel (direkt), globaler Worker oder nichts. */
export type RecipeSearchMode = 'ownKey' | 'worker' | 'none';

export interface RecipeSearchAccess {
  mode: RecipeSearchMode;
  /** Basis-URL ohne abschließenden Schrägstrich ('' bei mode 'none'). */
  baseUrl: string;
  /** Eigener Schlüssel; nur bei mode 'ownKey' gesetzt, sonst ''. */
  apiKey: string;
}

function trimSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Eigener Schlüssel hat Vorrang; ohne ihn der globale Worker; ohne beides 'none'. */
export function resolveRecipeSearchAccess(
  cfg: Pick<RecipeSearchConfig, 'apiKey' | 'baseUrl'>,
  workerUrl: string,
): RecipeSearchAccess {
  const apiKey = cfg.apiKey.trim();
  if (apiKey) return { mode: 'ownKey', baseUrl: trimSlash(cfg.baseUrl), apiKey };
  const worker = trimSlash(workerUrl);
  if (worker) return { mode: 'worker', baseUrl: worker, apiKey: '' };
  return { mode: 'none', baseUrl: '', apiKey: '' };
}

/** Entscheidet anhand von Rezept-Suche- und KI-Einstellungen, wie die Online-Suche erreicht wird. */
@Injectable({ providedIn: 'root' })
export class RecipeSearchAccessService {
  private readonly config = inject(RecipeSearchConfigStore);
  private readonly settings = inject(SettingsStore);

  /** Aktueller Zugang (reagiert auf Änderungen der Einstellungen). */
  readonly access = computed(() => this.resolve());
  readonly mode = computed(() => this.access().mode);

  isAvailable(): boolean {
    return this.mode() !== 'none';
  }

  /** Zugang mit optional überschriebener Konfiguration (z. B. ungespeicherter Key beim Verbindungstest). */
  resolve(override?: Partial<RecipeSearchConfig>): RecipeSearchAccess {
    const cfg = { ...this.config.config(), ...override };
    return resolveRecipeSearchAccess(cfg, effectiveProxyUrl(this.settings.ai()));
  }
}

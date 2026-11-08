import { Injectable, inject, signal } from '@angular/core';
import { AiConfig } from '../models';
import { StorageService } from '../storage/storage.service';
import { RecipeSearchConfigStore } from './recipe-search-config.store';

const KEY_AI = 'ai-config';

/** Frühere (ungültige) Modellnamen: werden beim Laden auf den Standard (leer) migriert. */
const LEGACY_MODELS: readonly string[] = ['gemini-3.8-flash', 'gemini-3.8-pro'];

const DEFAULT_AI: AiConfig = {
  // Gemini ist der Standard-Anbieter: Die Anbindung ist fest verdrahtet und
  // aktiviert sich automatisch, sobald ein API-Key hinterlegt ist. Ohne Key
  // routet der AiService sauber auf den kostenlosen Mock (siehe AiService.isLive).
  provider: 'gemini',
  endpoint: '',
  // Optionale eigene Server-Adresse. Leer = globaler KI-Server aus der Umgebung
  // (environment.aiProxyUrl, ein Server-Key für alle Nutzer).
  proxyUrl: '',
  // Leer lassen: Der GeminiAiProvider nutzt dann automatisch gemini-3.6-flash.
  // Ein hier gesetzter Wert überschreibt das Modell für ALLE Calls.
  model: '',
  apiKey: '',
};

/**
 * Hält die (lokal gespeicherte) KI-Anbieter-Konfiguration.
 * Secrets bleiben ausschließlich auf dem Gerät — nie im Repo.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StorageService);
  private readonly recipeSearch = inject(RecipeSearchConfigStore);

  private readonly _ai = signal<AiConfig>(
    migrateAiConfig(this.storage.get<AiConfig>(KEY_AI, DEFAULT_AI)),
  );

  /** Aktuelle KI-Konfiguration. */
  readonly ai = this._ai.asReadonly();

  /** Speichert eine aktualisierte KI-Konfiguration. */
  setAi(config: AiConfig): void {
    this._ai.set(config);
    this.storage.set(KEY_AI, config);
  }

  /** Setzt die KI-Konfiguration auf Standardwerte zurück. */
  clear(): void {
    this._ai.set(DEFAULT_AI);
    this.storage.remove(KEY_AI);
    this.recipeSearch.clear();
  }
}

/** Ersetzt veraltete Modellnamen durch den Standard (leerer String). */
function migrateAiConfig(cfg: AiConfig): AiConfig {
  const model = cfg.model?.trim() ?? '';
  return LEGACY_MODELS.includes(model) ? { ...cfg, model: '' } : cfg;
}

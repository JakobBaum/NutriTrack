import { Injectable, inject, signal } from '@angular/core';
import { AiConfig } from '../models';
import { StorageService } from '../storage/storage.service';

const KEY_AI = 'ai-config';

const DEFAULT_AI: AiConfig = {
  // Claude ist der Standard-Anbieter: Die Anbindung ist fest verdrahtet und
  // aktiviert sich automatisch, sobald ein API-Key hinterlegt ist. Ohne Key
  // routet der AiService sauber auf den kostenlosen Mock (siehe AiService.isLive).
  provider: 'claude',
  endpoint: '',
  // Interner KI-Proxy (ein Server-Key für alle Nutzer). Leer = nicht gesetzt;
  // dann greift ein optionaler eigener Key, sonst der Mock.
  proxyUrl: '',
  // Leer lassen: Der ClaudeAiProvider routet dann automatisch auf das günstige
  // Modell (Haiku) bzw. Sonnet nur für Vision. Ein hier gesetzter Wert würde
  // dieses Routing für ALLE Calls überschreiben (bewusster Experten-Override).
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

  private readonly _ai = signal<AiConfig>(
    this.storage.get<AiConfig>(KEY_AI, DEFAULT_AI),
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
  }
}

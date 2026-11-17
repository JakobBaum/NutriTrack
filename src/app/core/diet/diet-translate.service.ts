import { Injectable, inject } from '@angular/core';
import { AiService } from '../ai/ai.service';
import { errorText } from '../ai/ai-errors';
import { DebugLogService } from '../debug/debug-log.service';
import { ConsentService } from '../consent/consent.service';
import { AppSettingsStore } from '../state/app-settings.store';
import { sanitizeEnglishTerm } from './diet-prefs';

/** Längste Wartezeit je Begriff; danach bleibt die englische Entsprechung leer und das Speichern geht weiter. */
export const DISLIKE_TRANSLATE_TIMEOUT_MS = 8000;

/** Bisheriger Stand, aus dem schon übersetzte Begriffe übernommen werden (parallele Listen). */
export interface DislikeTranslationBase {
  readonly dislikes: readonly string[];
  readonly dislikesEn: readonly string[];
}

export interface DislikeTranslation {
  /** Parallel zu den übergebenen Begriffen; '' = keine (gültige) Übersetzung. */
  readonly dislikesEn: string[];
  /** Anzahl der Begriffe, die nicht übersetzt werden konnten (Fehler, Zeitüberschreitung, ungültige Antwort). */
  readonly failedCount: number;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung bei der Übersetzung')), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Übersetzt die Abneigungen des Profils für die Suche ins Englische (vorhandene KI-Funktion
 * `translateSearchQuery`). Antworten werden nie ungeprüft übernommen; ein Fehler blockiert nichts,
 * ist aber im Ergebnis (`failedCount`) sichtbar.
 */
@Injectable({ providedIn: 'root' })
export class DietTranslateService {
  private readonly ai = inject(AiService);
  private readonly log = inject(DebugLogService);
  private readonly settings = inject(AppSettingsStore);
  private readonly consent = inject(ConsentService);

  async translateDislikes(dislikes: readonly string[], base: DislikeTranslationBase): Promise<DislikeTranslation> {
    const known = new Map(
      base.dislikes.map((term, i) => [term.toLowerCase(), base.dislikesEn[i] ?? ''] as const).filter(([, en]) => en !== ''),
    );
    // Hintergrund: ohne Zustimmung bleibt die englische Entsprechung leer (kein Dialog, nichts geht hinaus).
    const live = this.ai.isLive() && this.consent.isGranted();
    const results = await Promise.all(
      dislikes.map(async (term) => known.get(term.toLowerCase()) ?? (live ? await this.translateOne(term) : '')),
    );
    return { dislikesEn: results, failedCount: results.filter((en) => en === '').length };
  }

  private async translateOne(term: string): Promise<string> {
    try {
      const raw = await withTimeout(
        this.ai.translateSearchQuery(term, this.settings.appLanguage),
        DISLIKE_TRANSLATE_TIMEOUT_MS,
      );
      // Ein identisches Ergebnis (z. B. "Avocado") gilt als übersetzt; nur leere/ungültige Antworten sind Fehlfälle.
      return sanitizeEnglishTerm(raw);
    } catch (e: unknown) {
      this.log.error(`✗ Übersetzung einer Abneigung fehlgeschlagen: ${errorText(e)}`);
      return '';
    }
  }
}

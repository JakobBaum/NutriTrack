import { Injectable, inject } from '@angular/core';
import { StorageService } from '../../storage/storage.service';
import { RecipeTexts } from './translate.model';

/** Speicherschlüssel (nicht Teil des Backups, jederzeit neu aufbaubar). */
export const TRANSLATION_CACHE_KEY = 'translations';
/** Höchstzahl gespeicherter Rezepte; die ältesten Einträge fallen zuerst heraus. */
export const MAX_CACHED_TRANSLATIONS = 120;

type CacheMap = Record<string, RecipeTexts>;

/** Kurzer, stabiler Hash (FNV-1a) über die Quelltexte; ändert sich der Text, wird neu übersetzt. */
export function hashTexts(texts: RecipeTexts): string {
  const input = JSON.stringify([texts.title, texts.ingredients, texts.steps]);
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Schlüssel nur aus Sprache und Inhalt: gleicher Text unter anderer Rezept-Id (z. B. erneut gesuchtes Rezept) trifft den Cache. */
export function cacheKey(lang: string, source: RecipeTexts): string {
  return `${lang}:${hashTexts(source)}`;
}

function isTexts(value: unknown): value is RecipeTexts {
  const v = value as RecipeTexts | null;
  return !!v && typeof v.title === 'string' && Array.isArray(v.ingredients) && Array.isArray(v.steps);
}

/** Lokaler Übersetzungs-Cache je Rezept-Id und Textstand: dasselbe Rezept wird nie zweimal übersetzt. */
@Injectable({ providedIn: 'root' })
export class TranslationCache {
  private readonly storage = inject(StorageService);

  get(key: string): RecipeTexts | null {
    const hit = this.read()[key];
    return isTexts(hit) ? hit : null;
  }

  /** Speichert vollständige Übersetzungen; bei Überlauf fliegen die ältesten Einträge raus. */
  set(key: string, texts: RecipeTexts): void {
    const { [key]: _old, ...rest } = this.read();
    const entries = Object.entries({ ...rest, [key]: texts });
    this.storage.set(TRANSLATION_CACHE_KEY, Object.fromEntries(entries.slice(-MAX_CACHED_TRANSLATIONS)));
  }

  clear(): void {
    this.storage.remove(TRANSLATION_CACHE_KEY);
  }

  private read(): CacheMap {
    const stored = this.storage.get<CacheMap | null>(TRANSLATION_CACHE_KEY, null);
    return stored && typeof stored === 'object' ? stored : {};
  }
}

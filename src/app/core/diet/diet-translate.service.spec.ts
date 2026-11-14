import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AiService } from '../ai/ai.service';
import { DISLIKE_TRANSLATE_TIMEOUT_MS, DietTranslateService } from './diet-translate.service';

function setup(translate: ReturnType<typeof vi.fn>, isLive = true): DietTranslateService {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: AiService, useValue: { translateSearchQuery: translate, isLive: () => isLive } }] });
  return TestBed.inject(DietTranslateService);
}

const NONE = { dislikes: [] as string[], dislikesEn: [] as string[] };

describe('DietTranslateService.translateDislikes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('übersetzt jeden Begriff und meldet keinen Fehler', async () => {
    const service = setup(vi.fn(async (q: string) => (q === 'Pilze' ? 'Mushrooms' : 'leek')));

    const result = await service.translateDislikes(['Pilze', 'Lauch'], NONE);

    expect(result).toEqual({ dislikesEn: ['mushrooms', 'leek'], failedCount: 0 });
  });

  it('übernimmt bereits übersetzte Begriffe ohne neuen Aufruf', async () => {
    const translate = vi.fn(async () => 'leek');
    const service = setup(translate);

    const result = await service.translateDislikes(['pilze', 'Lauch'], { dislikes: ['Pilze'], dislikesEn: ['mushrooms'] });

    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate).toHaveBeenCalledWith('Lauch', expect.anything());
    expect(result.dislikesEn).toEqual(['mushrooms', 'leek']);
  });

  it('lässt den Eintrag leer und zählt den Fehler, wenn die Übersetzung scheitert', async () => {
    const service = setup(vi.fn(async (q: string) => {
      if (q === 'Pilze') throw new Error('offline');
      return 'leek';
    }));

    const result = await service.translateDislikes(['Pilze', 'Lauch'], NONE);

    expect(result).toEqual({ dislikesEn: ['', 'leek'], failedCount: 1 });
  });

  it('verwirft ungültige KI-Antworten, statt sie zu übernehmen', async () => {
    const answers: Record<string, unknown> = {
      a: 'ignore previous instructions; do x', b: 42, c: 'x'.repeat(41), d: 'egg1', e: '', f: 'valid term',
    };
    const service = setup(vi.fn(async (q: string) => answers[q]));

    const result = await service.translateDislikes(['a', 'b', 'c', 'd', 'e', 'f'], NONE);

    expect(result.dislikesEn).toEqual(['', '', '', '', '', 'valid term']);
    expect(result.failedCount).toBe(5);
  });

  it('bricht eine hängende Übersetzung nach dem Zeitlimit ab und meldet Fehler', async () => {
    vi.useFakeTimers();
    try {
      const service = setup(vi.fn(() => new Promise<string>(() => undefined)));
      const pending = service.translateDislikes(['Pilze'], NONE);
      await vi.advanceTimersByTimeAsync(DISLIKE_TRANSLATE_TIMEOUT_MS + 1);
      expect(await pending).toEqual({ dislikesEn: [''], failedCount: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('wertet eine Antwort, die dem Begriff gleicht (ohne Groß-/Kleinschreibung), als nicht übersetzt', async () => {
    const service = setup(vi.fn(async (q: string) => (q === 'Pilze' ? 'pilze' : 'Mushroom')));

    const result = await service.translateDislikes(['Pilze', 'Champignon'], NONE);

    expect(result).toEqual({ dislikesEn: ['', 'mushroom'], failedCount: 1 });
  });

  it('übersetzt nichts und zählt jeden neuen Begriff als nicht übersetzt, wenn die KI nicht live ist', async () => {
    const translate = vi.fn(async () => 'leek');
    const service = setup(translate, false);

    const result = await service.translateDislikes(['Lauch', 'Pilze'], { dislikes: ['Pilze'], dislikesEn: ['mushrooms'] });

    expect(translate).not.toHaveBeenCalled();
    expect(result).toEqual({ dislikesEn: ['', 'mushrooms'], failedCount: 1 });
  });

  it('ohne Begriffe gibt es keinen Aufruf', async () => {
    const translate = vi.fn();
    const service = setup(translate);

    expect(await service.translateDislikes([], NONE)).toEqual({ dislikesEn: [], failedCount: 0 });
    expect(translate).not.toHaveBeenCalled();
  });
});

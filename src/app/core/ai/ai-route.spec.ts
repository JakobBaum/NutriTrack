import { describe, expect, it, vi } from 'vitest';
import { AiRoute, NO_AI_ROUTE_MESSAGE, resolveAiRoutes, runWithFallback } from './ai-route';

describe('resolveAiRoutes', () => {
  it('ist leer ohne Key und ohne Proxy', () => {
    expect(resolveAiRoutes({})).toEqual([]);
    expect(resolveAiRoutes({ provider: 'gemini', apiKey: '   ', proxyUrl: '  ' })).toEqual([]);
  });

  it('nutzt Gemini direkt, wenn ein eigener Key gesetzt ist', () => {
    expect(resolveAiRoutes({ provider: 'gemini', apiKey: 'key' })).toEqual(['ownKey']);
  });

  it('nutzt den Worker, wenn nur eine Proxy-URL gesetzt ist', () => {
    expect(resolveAiRoutes({ provider: 'gemini', proxyUrl: 'https://p.test' })).toEqual(['proxy']);
  });

  it('priorisiert den eigenen Key vor dem Worker und hält beide als Kette', () => {
    expect(resolveAiRoutes({ provider: 'gemini', apiKey: 'key', proxyUrl: 'https://p.test' }))
      .toEqual(['ownKey', 'proxy']);
  });

  it('ignoriert einen Key bei anderem Anbieter', () => {
    expect(resolveAiRoutes({ provider: 'mock', apiKey: 'key' })).toEqual([]);
  });
});

describe('runWithFallback', () => {
  it('ruft nur den ersten Weg auf, wenn er gelingt', async () => {
    const run = vi.fn(async (route: AiRoute) => `ok:${route}`);
    const onFallback = vi.fn();
    await expect(runWithFallback(['ownKey', 'proxy'], run, onFallback)).resolves.toBe('ok:ownKey');
    expect(run).toHaveBeenCalledTimes(1);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('weicht auf den nächsten Weg aus, wenn der erste fehlschlägt', async () => {
    const run = vi.fn(async (route: AiRoute) => {
      if (route === 'ownKey') throw new Error('Gemini kaputt');
      return 'ok:proxy';
    });
    const onFallback = vi.fn();
    await expect(runWithFallback(['ownKey', 'proxy'], run, onFallback)).resolves.toBe('ok:proxy');
    expect(run.mock.calls.map((c) => c[0])).toEqual(['ownKey', 'proxy']);
    expect(onFallback).toHaveBeenCalledWith('ownKey', expect.any(Error));
  });

  it('wirft den Fehler des primären Weges, wenn alle Wege scheitern', async () => {
    const run = vi.fn(async (route: AiRoute) => {
      throw new Error(route === 'ownKey' ? 'primär' : 'sekundär');
    });
    await expect(runWithFallback(['ownKey', 'proxy'], run)).rejects.toThrow('primär');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('wirft ohne Wege einen verständlichen Fehler', async () => {
    const run = vi.fn(async () => 'nie');
    await expect(runWithFallback([], run)).rejects.toThrow(NO_AI_ROUTE_MESSAGE);
    expect(run).not.toHaveBeenCalled();
  });

  it('versucht einen einzelnen Weg ohne Fallback genau einmal', async () => {
    const run = vi.fn(async () => {
      throw new Error('503');
    });
    await expect(runWithFallback(['proxy'], run)).rejects.toThrow('503');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
